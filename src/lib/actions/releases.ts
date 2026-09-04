"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isManager, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getGlobalProject } from "@/lib/catalog";
import { isGlobalProject } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const publishSchema = z.object({
  label: z
    .string()
    .trim()
    .regex(/^v?[0-9a-zA-Z._-]{1,32}$/)
    .max(32),
  changelog: z.string().trim().max(2000).optional().default(""),
});

export async function publishReleaseAction(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Only managers can publish");
  }
  const project = await prisma.project.findUniqueOrThrow({
    where: { slug: projectSlug },
    include: {
      artifacts: {
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      },
      releases: { orderBy: { publishedAt: "desc" }, take: 1 },
    },
  });

  const fallback = `v${(project.releases[0] ? Number(project.releases[0].label.replace(/^v/, "")) + 1 : 1) || project.releases.length + 1}`;
  const parsed = publishSchema.parse({
    label: formData.get("label") || fallback,
    changelog: formData.get("changelog") ?? "",
  });

  const withContent = project.artifacts.filter((artifact) => artifact.versions[0]);
  if (withContent.length === 0) {
    if (isGlobalProject(project)) {
      throw new Error("Publish at least one global artifact first");
    }
    const global = await getGlobalProject();
    if (!global?.liveReleaseId) {
      throw new Error("Publish the global pack first, or add a project-specific artifact");
    }
  }

  const release = await prisma.$transaction(async (tx) => {
    const created = await tx.release.create({
      data: {
        projectId: project.id,
        label: parsed.label,
        changelog: parsed.changelog,
        publishedById: user.id,
        items: {
          create: withContent.map((artifact) => ({
            artifactId: artifact.id,
            versionId: artifact.versions[0].id,
          })),
        },
      },
    });
    await tx.project.update({
      where: { id: project.id },
      data: { liveReleaseId: created.id },
    });
    return created;
  });

  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "release.published",
    entityType: "release",
    entityId: release.id,
    metadata: { label: release.label, artifacts: withContent.length },
  });
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/history`);
  revalidatePath("/");
}
