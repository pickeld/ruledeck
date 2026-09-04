import { NextResponse } from "next/server";
import { z } from "zod";
import { COMPLIANCE_LABEL } from "@/lib/compliance";
import { isNextResponse, requireSyncActor } from "@/lib/sync-auth";
import { prisma } from "@/lib/prisma";

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
  const release = actor.project.liveReleaseId
    ? await prisma.release.findUnique({
        where: { id: actor.project.liveReleaseId },
        select: { label: true },
      })
    : null;
  return NextResponse.json({
    project: actor.project.slug,
    live: release?.label ?? "none",
    applied: actor.appliedReleaseId ? "yes" : "none",
    compliance: COMPLIANCE_LABEL[actor.compliance],
    writeAccess: Boolean(actor.writeConsentAt),
    lastCheckInAt: actor.lastCheckInAt?.toISOString() ?? null,
  });
}
