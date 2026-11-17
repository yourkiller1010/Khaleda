import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function audit(input: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      severity: input.severity ?? "INFO",
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
