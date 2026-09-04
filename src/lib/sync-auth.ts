import { NextResponse } from "next/server";
import type { Membership, Project, User } from "@prisma/client";
import { sha256Hex } from "./crypto";
import { prisma } from "./prisma";
import { allowRate } from "./rate-limit";

export type SyncActor = Membership & { project: Project; user: Pick<User, "id" | "email" | "name"> };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

export async function requireSyncActor(
  request: Request,
  projectSlug: string,
): Promise<SyncActor | NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tokenHash = sha256Hex(token);
  if (!allowRate(`sync:${tokenHash}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const membership = await prisma.membership.findUnique({
    where: { syncTokenHash: tokenHash },
    include: { project: true, user: { select: { id: true, email: true, name: true } } },
  });
  if (!membership || membership.project.slug !== projectSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!membership.writeConsentAt) {
    return NextResponse.json({ error: "Write access is not granted" }, { status: 403 });
  }
  return membership;
}

export function isNextResponse(value: SyncActor | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
