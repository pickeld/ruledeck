"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, getSessionUser, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailSchema } from "@/lib/email";
import { sha256Hex } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const joinSchema = z.object({
  token: z.string().min(16).max(128),
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(200),
});

export async function joinAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = joinSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Check name, email, and use a password of at least 8 characters." };
  }

  const invite = await prisma.invite.findUnique({
    where: { tokenHash: sha256Hex(parsed.data.token) },
    include: { project: true },
  });
  if (!invite || invite.revokedAt || invite.expiresAt.getTime() < Date.now() || invite.usedCount >= invite.maxUses) {
    return { error: "This invite is invalid or expired." };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: invite.role,
      },
    });
    await tx.membership.create({
      data: {
        projectId: invite.projectId,
        userId: created.id,
        role: invite.role,
        compliance: "PENDING",
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    });
    return created;
  });

  await createSession(user.id);
  await audit({
    actorId: user.id,
    projectId: invite.projectId,
    action: "invite.accepted",
    entityType: "membership",
    entityId: user.id,
  });
  redirect(`/onboarding/platforms?project=${invite.project.slug}`);
}

export async function acceptInviteExistingAction(token: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/join/${token}`);
  }
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { project: true },
  });
  if (!invite || invite.revokedAt || invite.expiresAt.getTime() < Date.now() || invite.usedCount >= invite.maxUses) {
    redirect("/login");
  }
  await prisma.membership.upsert({
    where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
    update: {},
    create: {
      projectId: invite.projectId,
      userId: user.id,
      role: invite.role,
      compliance: "PENDING",
    },
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedCount: { increment: 1 } },
  });
  await audit({
    actorId: user.id,
    projectId: invite.projectId,
    action: "invite.accepted",
    entityType: "membership",
    entityId: user.id,
  });
  redirect(`/onboarding/platforms?project=${invite.project.slug}`);
}
