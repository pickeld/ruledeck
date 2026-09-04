import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type AuditInput = {
  actorId?: string | null;
  projectId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function audit(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      projectId: input.projectId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
