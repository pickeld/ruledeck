"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManager, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { GLOBAL_PROJECT_SLUG } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
  .max(64);

const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().default(""),
});

export async function createProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Only managers can create projects");
  }
  const parsed = projectSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
  });
  if (parsed.slug === GLOBAL_PROJECT_SLUG) {
    throw new Error("The global pack already exists — edit it from Global pack");
  }
  const project = await prisma.project.create({ data: parsed });
  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    metadata: { slug: project.slug },
  });
  revalidatePath("/");
  redirect(`/projects/${project.slug}`);
}
