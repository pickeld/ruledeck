"use server";

import { revalidatePath } from "next/cache";
import { isManager, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getPublicUrl } from "@/lib/config";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function createInviteAction(
  _prev: { error?: string; url?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const user = await requireUser();
  if (!isManager(user)) {
    return { error: "Only managers can invite" };
  }
  const projectSlug = String(formData.get("slug") ?? "");
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) {
    return { error: "Project not found" };
  }
  const token = randomToken(32);
  await prisma.invite.create({
    data: {
      tokenHash: sha256Hex(token),
      projectId: project.id,
      createdById: user.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      maxUses: 50,
    },
  });
  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "invite.created",
    entityType: "invite",
  });
  revalidatePath(`/projects/${projectSlug}/team`);
  return { url: `${getPublicUrl()}/join/${token}` };
}

export async function revokeInviteAction(projectSlug: string, inviteId: string): Promise<void> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Only managers can revoke invites");
  }
  const invite = await prisma.invite.findUniqueOrThrow({
    where: { id: inviteId },
    include: { project: true },
  });
  if (invite.project.slug !== projectSlug) {
    throw new Error("Invite mismatch");
  }
  await prisma.invite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });
  await audit({
    actorId: user.id,
    projectId: invite.projectId,
    action: "invite.revoked",
    entityType: "invite",
    entityId: invite.id,
  });
  revalidatePath(`/projects/${projectSlug}/team`);
}
