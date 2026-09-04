"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { emailSchema } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Invalid email or password" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  const ok = user ? await verifyPassword(user.passwordHash, parsed.data.password) : false;
  if (!user || !ok) {
    await audit({
      action: "login.failed",
      entityType: "user",
      metadata: { email: parsed.data.email.toLowerCase() },
    });
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  await audit({
    actorId: user.id,
    action: "login.succeeded",
    entityType: "user",
    entityId: user.id,
  });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
