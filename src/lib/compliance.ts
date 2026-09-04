import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ComplianceStatus, Membership } from "@prisma/client";
import { generateAll } from "./adapters";
import { effectiveLiveArtifacts } from "./catalog";
import { TARGETS } from "./config";
import { sha256Hex } from "./crypto";
import { memberOutputDir } from "./paths";
import { prisma } from "./prisma";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  PENDING: "Onboarding",
  FOLLOWING: "Following",
  DRIFTED: "Broke pack",
  MISSING: "Not applied",
  STALE: "Stale",
};

export async function refreshMembershipCompliance(membershipId: string): Promise<ComplianceStatus> {
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    include: { project: true },
  });
  const status = await evaluate(membership);
  await prisma.membership.update({
    where: { id: membership.id },
    data: { compliance: status },
  });
  return status;
}

async function evaluate(
  membership: Membership & { project: { id: string; slug: string; liveReleaseId: string | null } },
): Promise<ComplianceStatus> {
  if (!membership.onboardingCompletedAt) {
    return "PENDING";
  }
  const generating = TARGETS.filter((id) => membership.platforms.includes(id));
  if (generating.length === 0 || !membership.appliedReleaseId) {
    return "MISSING";
  }
  if (membership.project.liveReleaseId && membership.appliedReleaseId !== membership.project.liveReleaseId) {
    return "DRIFTED";
  }
  if (membership.lastCheckInAt && Date.now() - membership.lastCheckInAt.getTime() > STALE_MS) {
    return "STALE";
  }
  if (membership.project.liveReleaseId) {
    const broke = await packFilesDrifted(
      membership.project.slug,
      membership.userId,
      membership.project.id,
      generating,
    );
    if (broke) {
      return "DRIFTED";
    }
  }
  return "FOLLOWING";
}

async function packFilesDrifted(
  projectSlug: string,
  userId: string,
  projectId: string,
  targets: typeof TARGETS[number][],
): Promise<boolean> {
  const expected = generateAll(await effectiveLiveArtifacts(projectId), targets);
  const dest = memberOutputDir(projectSlug, userId);
  for (const file of expected) {
    try {
      const onDisk = await readFile(path.join(dest, file.path), "utf8");
      if (sha256Hex(onDisk) !== sha256Hex(file.content)) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

export function lockPayload(
  releaseId: string | null,
  releaseLabel: string | null,
  contentHash: string,
  files: { path: string; content: string }[],
) {
  return {
    releaseId,
    releaseLabel,
    contentHash,
    files: Object.fromEntries(files.map((file) => [file.path, sha256Hex(file.content)])),
    generatedAt: new Date().toISOString(),
  };
}
