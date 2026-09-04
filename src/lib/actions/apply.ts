"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generateAll } from "@/lib/adapters";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { effectiveLiveArtifacts } from "@/lib/catalog";
import { getPublicUrl } from "@/lib/config";
import { lockPayload, refreshMembershipCompliance } from "@/lib/compliance";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { installSyncKit } from "@/lib/pack-write";
import { memberOutputDir } from "@/lib/paths";
import { PLATFORMS, packTargets, type PlatformId } from "@/lib/platforms";
import { prisma } from "@/lib/prisma";
import { parseWorkspaceMatchers } from "@/lib/workspace";

export async function savePlatformsAction(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUniqueOrThrow({ where: { slug: projectSlug } });
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  if (!membership) {
    throw new Error("You are not on this project");
  }
  const platforms = PLATFORMS.map((item) => item.id).filter(
    (id) => formData.get(`platform-${id}`) === "on",
  ) as PlatformId[];
  if (platforms.length === 0) {
    throw new Error("Pick at least one vibe-coding platform");
  }
  await prisma.membership.update({
    where: { id: membership.id },
    data: { platforms },
  });
  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "onboarding.platforms",
    entityType: "membership",
    entityId: membership.id,
    metadata: { platforms },
  });
  redirect(`/onboarding/apply?project=${projectSlug}`);
}

export async function applyPackAction(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  if (formData.get("writeConsent") !== "on") {
    throw new Error("Write access is required so RuleDeck can keep your repo on the live pack");
  }
  const project = await prisma.project.findUniqueOrThrow({ where: { slug: projectSlug } });
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
  });
  if (!project.liveReleaseId) {
    throw new Error("This project has no live pack yet");
  }
  const match = parseWorkspaceMatchers(String(formData.get("workspaces") ?? ""), project.slug);
  const artifacts = await effectiveLiveArtifacts(project.id);
  const generateTargets = packTargets(membership.platforms);
  const files = generateAll(artifacts, generateTargets);
  const dest = memberOutputDir(project.slug, user.id);
  await mkdir(dest, { recursive: true });
  const token = `rds_${randomToken(32)}`;
  const contentHash = await installSyncKit({
    dest,
    files,
    projectSlug: project.slug,
    apiUrl: getPublicUrl(),
    token,
    match,
  });
  const lock = lockPayload(project.liveReleaseId, "live", contentHash, files);
  await mkdir(path.join(dest, ".ruledeck"), { recursive: true });
  await writeFile(path.join(dest, ".ruledeck", "lock.json"), `${JSON.stringify(lock, null, 2)}\n`);

  await prisma.generateRun.create({
    data: {
      projectId: project.id,
      releaseId: project.liveReleaseId,
      actorId: user.id,
      targets: generateTargets,
      outputRoot: dest,
      fileCount: files.length,
      contentHash,
    },
  });
  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      appliedReleaseId: project.liveReleaseId,
      appliedHash: contentHash,
      lastCheckInAt: new Date(),
      onboardingCompletedAt: membership.onboardingCompletedAt ?? new Date(),
      writeConsentAt: new Date(),
      syncTokenHash: sha256Hex(token),
      workspaceMatchers: match,
    },
  });
  await refreshMembershipCompliance(membership.id);
  await audit({
    actorId: user.id,
    projectId: project.id,
    action: "pack.applied",
    entityType: "membership",
    entityId: membership.id,
    metadata: { writeConsent: true },
  });
  revalidatePath(`/projects/${projectSlug}/team`);
  revalidatePath("/workspaces");
  redirect(`/onboarding/done?project=${projectSlug}`);
}
