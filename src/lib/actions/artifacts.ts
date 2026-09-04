"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ArtifactType } from "@prisma/client";
import { isManager, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { TARGETS } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(64);

const artifactSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: slugSchema,
  description: z.string().trim().max(300).optional().default(""),
  type: z.enum(["RULE", "PROMPT", "PROCEDURE", "TOOL"]),
  targets: z.array(z.enum(TARGETS)).min(1),
  globs: z.string().trim().max(400).optional().default(""),
  alwaysApply: z.boolean().optional().default(false),
  content: z.string().min(1).max(80_000),
  message: z.string().trim().max(200).optional().default(""),
});

function parseTargets(formData: FormData): string[] {
  return TARGETS.filter((target) => formData.get(`target-${target}`) === "on");
}

function parseGlobs(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function createArtifactAction(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Only managers can edit the catalog");
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { slug: projectSlug } });
  const parsed = artifactSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    type: formData.get("type"),
    targets: parseTargets(formData),
    globs: String(formData.get("globs") ?? ""),
    alwaysApply: formData.get("alwaysApply") === "on",
    content: formData.get("content"),
    message: formData.get("message") ?? "Initial version",
  });

  const artifact = await prisma.artifact.create({
    data: {
      projectId: project.id,
      type: parsed.type as ArtifactType,
      slug: parsed.slug,
      title: parsed.title,
      description: parsed.description,
      targets: parsed.targets,
      globs: parseGlobs(parsed.globs),
      alwaysApply: parsed.alwaysApply,
      versions: {
        create: {
          version: 1,
          content: parsed.content,
          message: parsed.message || "Initial version",
          authorId: user.id,
        },
      },
    },
  });

  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "artifact.created",
    entityType: "artifact",
    entityId: artifact.id,
    metadata: { type: artifact.type, slug: artifact.slug },
  });
  revalidatePath(`/projects/${projectSlug}`);
  redirect(`/projects/${projectSlug}/a/${artifact.id}`);
}

export async function saveArtifactAction(projectSlug: string, artifactId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Only managers can edit the catalog");
  }
  const artifact = await prisma.artifact.findUniqueOrThrow({
    where: { id: artifactId },
    include: { project: true, versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (artifact.project.slug !== projectSlug) {
    throw new Error("Artifact does not belong to this project");
  }

  const parsed = artifactSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    type: artifact.type,
    targets: parseTargets(formData),
    globs: String(formData.get("globs") ?? ""),
    alwaysApply: formData.get("alwaysApply") === "on",
    content: formData.get("content"),
    message: formData.get("message") ?? "",
  });

  const nextVersion = (artifact.versions[0]?.version ?? 0) + 1;
  await prisma.$transaction([
    prisma.artifact.update({
      where: { id: artifact.id },
      data: {
        title: parsed.title,
        slug: parsed.slug,
        description: parsed.description,
        targets: parsed.targets,
        globs: parseGlobs(parsed.globs),
        alwaysApply: parsed.alwaysApply,
      },
    }),
    prisma.artifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: nextVersion,
        content: parsed.content,
        message: parsed.message || `v${nextVersion}`,
        authorId: user.id,
      },
    }),
  ]);

  await audit({
    actorId: user.id,
    projectId: artifact.projectId,
    action: "artifact.updated",
    entityType: "artifact",
    entityId: artifact.id,
    metadata: { version: nextVersion },
  });
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/a/${artifact.id}`);
}

export async function restoreVersionAction(
  projectSlug: string,
  artifactId: string,
  versionId: string,
): Promise<void> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Only managers can restore versions");
  }
  const current = await prisma.artifact.findUniqueOrThrow({
    where: { id: artifactId },
    include: { project: true, versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const source = await prisma.artifactVersion.findUniqueOrThrow({ where: { id: versionId } });
  if (source.artifactId !== artifactId || current.project.slug !== projectSlug) {
    throw new Error("Version does not belong to this artifact");
  }
  const nextVersion = (current.versions[0]?.version ?? 0) + 1;
  await prisma.artifactVersion.create({
    data: {
      artifactId,
      version: nextVersion,
      content: source.content,
      message: `Restored from v${source.version}`,
      authorId: user.id,
    },
  });
  await audit({
    actorId: user.id,
    projectId: current.projectId,
    action: "artifact.restored",
    entityType: "artifact",
    entityId: artifactId,
    metadata: { from: source.version, to: nextVersion },
  });
  revalidatePath(`/projects/${projectSlug}/a/${artifactId}`);
  revalidatePath(`/projects/${projectSlug}/history`);
}
