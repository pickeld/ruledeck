import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isNextResponse, requireSyncActor } from "@/lib/sync-auth";
import { livePackFor } from "@/lib/sync-pack";

const querySchema = z.object({
  project: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
});

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ project: url.searchParams.get("project") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }
  const actor = await requireSyncActor(request, parsed.data.project);
  if (isNextResponse(actor)) {
    return actor;
  }
  try {
    const pack = await livePackFor(actor);
    const release = await prisma.release.findUnique({
      where: { id: pack.releaseId },
      select: { label: true },
    });
    return NextResponse.json({
      project: pack.project,
      release: release?.label ?? "live",
      releaseId: pack.releaseId,
      contentHash: pack.contentHash,
      files: pack.files,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pack unavailable";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
