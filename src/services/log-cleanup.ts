import type { Prisma } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";

export const logCleanupTargets = [
  "ALL",
  "AUDIT_LOGS",
  "TASK_RUNS",
  "TRAFFIC_LOGS",
  "NODE_LATENCY_LOGS",
  "SUBSCRIPTION_ACCESS_LOGS",
  "SUBSCRIPTION_RISK_EVENTS",
] as const;

export type LogCleanupTarget = (typeof logCleanupTargets)[number];

export const logCleanupTargetLabels: Record<LogCleanupTarget, string> = {
  ALL: "全部日志",
  AUDIT_LOGS: "审计日志",
  TASK_RUNS: "任务记录",
  TRAFFIC_LOGS: "流量日志",
  NODE_LATENCY_LOGS: "节点延迟日志",
  SUBSCRIPTION_ACCESS_LOGS: "风控访问日志",
  SUBSCRIPTION_RISK_EVENTS: "风控事件",
};

export type LogDeleteTarget = Exclude<LogCleanupTarget, "ALL">;

export type LogCleanupSummary = Record<LogDeleteTarget, number>;

export const emptyLogCleanupSummary: LogCleanupSummary = {
  AUDIT_LOGS: 0,
  TASK_RUNS: 0,
  TRAFFIC_LOGS: 0,
  NODE_LATENCY_LOGS: 0,
  SUBSCRIPTION_ACCESS_LOGS: 0,
  SUBSCRIPTION_RISK_EVENTS: 0,
};

const targetOrder: LogDeleteTarget[] = [
  "AUDIT_LOGS",
  "TASK_RUNS",
  "TRAFFIC_LOGS",
  "NODE_LATENCY_LOGS",
  "SUBSCRIPTION_ACCESS_LOGS",
  "SUBSCRIPTION_RISK_EVENTS",
];

export function normalizeRetentionDays(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 30;
  return Math.min(3650, Math.max(1, Math.trunc(value)));
}

export function cutoffFromDays(days: number, now = new Date()) {
  const normalizedDays = normalizeRetentionDays(days);
  return new Date(now.getTime() - normalizedDays * 24 * 60 * 60 * 1000);
}

export function summarizeLogCleanup(summary: LogCleanupSummary) {
  const parts = targetOrder
    .map((target) => [logCleanupTargetLabels[target], summary[target]] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count} 条`);

  return parts.length > 0 ? parts.join("，") : "没有可清理的日志";
}

function selectedTargets(target: LogCleanupTarget): LogDeleteTarget[] {
  return target === "ALL" ? targetOrder : [target];
}

export async function cleanupExpiredLogs(
  {
    target,
    cutoff,
    keepActiveRiskRestrictions = true,
  }: {
    target: LogCleanupTarget;
    cutoff: Date;
    keepActiveRiskRestrictions?: boolean;
  },
  db: DbClient = prisma,
): Promise<LogCleanupSummary> {
  const summary = { ...emptyLogCleanupSummary };

  for (const item of selectedTargets(target)) {
    if (item === "AUDIT_LOGS") {
      const result = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      summary[item] = result.count;
    }
    if (item === "TASK_RUNS") {
      const result = await db.taskRun.deleteMany({ where: { createdAt: { lt: cutoff } } });
      summary[item] = result.count;
    }
    if (item === "TRAFFIC_LOGS") {
      const result = await db.trafficLog.deleteMany({ where: { timestamp: { lt: cutoff } } });
      summary[item] = result.count;
    }
    if (item === "NODE_LATENCY_LOGS") {
      const result = await db.nodeLatencyLog.deleteMany({ where: { checkedAt: { lt: cutoff } } });
      summary[item] = result.count;
    }
    if (item === "SUBSCRIPTION_ACCESS_LOGS") {
      const result = await db.subscriptionAccessLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      summary[item] = result.count;
    }
    if (item === "SUBSCRIPTION_RISK_EVENTS") {
      const where: Prisma.SubscriptionRiskEventWhereInput = {
        createdAt: { lt: cutoff },
        ...(keepActiveRiskRestrictions ? { userRestrictionActive: false } : {}),
      };
      const result = await db.subscriptionRiskEvent.deleteMany({ where });
      summary[item] = result.count;
    }
  }

  return summary;
}

export async function deleteLogEntry(
  {
    target,
    id,
  }: {
    target: LogDeleteTarget;
    id: string;
  },
  db: DbClient = prisma,
) {
  if (target === "AUDIT_LOGS") {
    await db.auditLog.delete({ where: { id } });
  }
  if (target === "TASK_RUNS") {
    await db.taskRun.delete({ where: { id } });
  }
  if (target === "TRAFFIC_LOGS") {
    await db.trafficLog.delete({ where: { id } });
  }
  if (target === "NODE_LATENCY_LOGS") {
    await db.nodeLatencyLog.delete({ where: { id } });
  }
  if (target === "SUBSCRIPTION_ACCESS_LOGS") {
    await db.subscriptionAccessLog.delete({ where: { id } });
  }
  if (target === "SUBSCRIPTION_RISK_EVENTS") {
    await db.subscriptionRiskEvent.delete({ where: { id } });
  }
}
