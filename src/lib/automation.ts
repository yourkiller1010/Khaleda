import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function triggerAutomations(trigger: string, payload: Record<string, unknown>, entityId: string) {
  const automations = await db.automation.findMany({ where: { trigger, status: "ACTIVE" } });
  if (!automations.length) return;
  await db.automationExecution.createMany({
    data: automations.map((automation) => ({
      automationId: automation.id,
      idempotencyKey: `${automation.id}:${trigger}:${entityId}`,
      payload: payload as Prisma.InputJsonValue,
      status: "PENDING" as const,
    })),
    skipDuplicates: true,
  });
}
