"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { generateAll } from "@/lib/adapters";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { effectiveDraftArtifacts, effectiveLiveArtifacts } from "@/lib/catalog";
import { getPublicUrl, TARGETS } from "@/lib/config";
import { lockPayload, refreshMembershipCompliance } from "@/lib/compliance";
import { installSyncKit, writeGeneratedFiles } from "@/lib/pack-write";
import { memberOutputDir } from "@/lib/paths";
import { prisma } from "@/lib/prisma";

function selectedTargets(formData: FormData) {
  const picked = TARGETS.filter((target) => formData.get(`target-${target}`) === "on");
  return picked.length ? picked : [...TARGETS];
}

export async function generateAction(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUniqueOrThrow({
    where: { slug: projectSlug },
  });
  const useLive = formData.get("source") === "live";
  if (useLive && !project.liveReleaseId) {
    throw new Error("No live release yet — publish first, or generate from drafts");
  }
  const artifacts = useLive
    ? await effectiveLiveArtifacts(project.id)
    : await effectiveDraftArtifacts(project.id);
  const targets = selectedTargets(formData);
  const files = generateAll(artifacts, targets);
  const dest = memberOutputDir(project.slug, user.id);
  await mkdir(dest, { recursive: true });
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  const contentHash =
    membership?.writeConsentAt
      ? await installSyncKit({
          dest,
          files,
          projectSlug: project.slug,
          apiUrl: getPublicUrl(),
          match: membership.workspaceMatchers,
        })
      : await writeGeneratedFiles(dest, files);
  const lock = lockPayload(useLive ? project.liveReleaseId : null, useLive ? "live" : "draft", contentHash, files);
  await mkdir(path.join(dest, ".ruledeck"), { recursive: true });
  await writeFile(path.join(dest, ".ruledeck", "lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  await prisma.generateRun.create({
    data: {
      projectId: project.id,
      releaseId: useLive ? project.liveReleaseId : null,
      actorId: user.id,
      targets,
      outputRoot: dest,
      fileCount: files.length,
      contentHash,
      drifted: !useLive,
    },
  });
  if (membership) {
    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        appliedReleaseId: useLive ? project.liveReleaseId : membership.appliedReleaseId,
        appliedHash: contentHash,
        lastCheckInAt: new Date(),
      },
    });
    await refreshMembershipCompliance(membership.id);
  }
  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "generate.wrote",
    entityType: "generate",
    metadata: { targets, fileCount: files.length, source: useLive ? "live" : "draft" },
  });
  revalidatePath(`/projects/${projectSlug}/generate`);
  revalidatePath(`/projects/${projectSlug}/monitoring`);
  revalidatePath(`/projects/${projectSlug}/team`);
}
