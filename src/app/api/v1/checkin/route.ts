import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { lockPayload, refreshMembershipCompliance } from "@/lib/compliance";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { memberOutputDir } from "@/lib/paths";
import { writeGeneratedFiles } from "@/lib/pack-write";
import { prisma } from "@/lib/prisma";
import { isNextResponse, requireSyncActor } from "@/lib/sync-auth";
import { livePackFor } from "@/lib/sync-pack";

const bodySchema = z.object({
  project: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  trigger: z.enum(["pull", "push", "sync", "manual"]),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  fileCount: z.number().int().min(0).max(500),
  workspace: z.string().trim().max(200).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid check-in" }, { status: 400 });
  }
  const actor = await requireSyncActor(request, parsed.data.project);
  if (isNextResponse(actor)) {
    return actor;
  }
  let pack: Awaited<ReturnType<typeof livePackFor>>;
  try {
    pack = await livePackFor(actor);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pack unavailable";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  const matched =
    parsed.data.contentHash === pack.contentHash && parsed.data.fileCount === pack.files.length;
  if (!matched) {
    return NextResponse.json({ error: "Pack hash mismatch" }, { status: 409 });
  }
  const dest = memberOutputDir(actor.project.slug, actor.userId);
  await mkdir(dest, { recursive: true });
  await writeGeneratedFiles(dest, pack.files);
  const lock = lockPayload(pack.releaseId, "live", pack.contentHash, pack.files);
  await mkdir(path.join(dest, ".ruledeck"), { recursive: true });
  await writeFile(path.join(dest, ".ruledeck", "lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  await prisma.generateRun.create({
    data: {
      projectId: actor.project.id,
      releaseId: pack.releaseId,
      actorId: actor.userId,
      targets: pack.generateTargets,
      outputRoot: `sync:${parsed.data.trigger}`,
      fileCount: pack.files.length,
      contentHash: pack.contentHash,
      drifted: false,
    },
  });
  await prisma.membership.update({
    where: { id: actor.id },
    data: {
      appliedReleaseId: pack.releaseId,
      appliedHash: pack.contentHash,
      lastCheckInAt: new Date(),
      lastWorkspace: parsed.data.workspace || undefined,
    },
  });
  await refreshMembershipCompliance(actor.id);
  await audit({
    actorId: actor.userId,
    projectId: actor.project.id,
    action: "pack.synced",
    entityType: "membership",
    entityId: actor.id,
    metadata: { trigger: parsed.data.trigger, workspace: parsed.data.workspace },
  });
  revalidatePath(`/projects/${actor.project.slug}/team`);
  revalidatePath(`/projects/${actor.project.slug}/monitoring`);
  return NextResponse.json({ ok: true, releaseId: pack.releaseId, contentHash: pack.contentHash });
}
