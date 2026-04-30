"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import {
  cleanupExpiredLogs,
  cutoffFromDays,
  deleteLogEntry,
  logCleanupTargetLabels,
  logCleanupTargets,
  summarizeLogCleanup,
  type LogCleanupSummary,
} from "@/services/log-cleanup";
import { getErrorMessage } from "@/lib/errors";

const deleteTargets = logCleanupTargets.filter((target) => target !== "ALL") as [
  Exclude<(typeof logCleanupTargets)[number], "ALL">,
  ...Exclude<(typeof logCleanupTargets)[number], "ALL">[],
];

const deleteLogSchema = z.object({
  target: z.enum(deleteTargets),
  id: z.string().trim().min(1),
});

const cleanupExpiredLogsSchema = z.object({
  target: z.enum(logCleanupTargets),
  cutoffDays: z.coerce.number().int().min(1).max(3650),
});

export type CleanupExpiredLogsResult =
  | { ok: true; summary: LogCleanupSummary; message: string }
  | { ok: false; error: string };

function revalidateLogViews() {
  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/traffic");
  revalidatePath("/admin/subscription-risk");
  revalidatePath("/admin/settings");
  revalidatePath("/admin/subscriptions");
}

export async function deleteAdminLogEntry(input: {
  target: Exclude<(typeof logCleanupTargets)[number], "ALL">;
  id: string;
}) {
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  const { target, id } = deleteLogSchema.parse(input);

  await deleteLogEntry({ target, id });

  await recordAuditLog({
    actor,
    action: "logs.delete",
    targetType: "LogEntry",
    targetId: id,
    targetLabel: logCleanupTargetLabels[target],
    message: `删除${logCleanupTargetLabels[target]}记录`,
    metadata: { target, deletedId: id },
  });

  revalidateLogViews();
}

export async function cleanupExpiredAdminLogs(input: {
  target: (typeof logCleanupTargets)[number];
  cutoffDays: number;
}): Promise<CleanupExpiredLogsResult> {
  try {
    const session = await requireAdmin();
    const actor = actorFromSession(session);
    const parsed = cleanupExpiredLogsSchema.parse(input);
    const cutoff = cutoffFromDays(parsed.cutoffDays);
    const summary = await cleanupExpiredLogs({
      target: parsed.target,
      cutoff,
      keepActiveRiskRestrictions: true,
    });

    const message = summarizeLogCleanup(summary);

    await prisma.appConfig.update({
      where: { id: "default" },
      data: { logCleanupLastRunAt: new Date() },
    }).catch(() => null);

    await recordAuditLog({
      actor,
      action: "logs.cleanup",
      targetType: "LogCleanup",
      targetLabel: logCleanupTargetLabels[parsed.target],
      message: `手动清理 ${parsed.cutoffDays} 天前的${logCleanupTargetLabels[parsed.target]}：${message}`,
      metadata: {
        target: parsed.target,
        cutoffDays: parsed.cutoffDays,
        cutoff: cutoff.toISOString(),
        summary,
      },
    });

    revalidateLogViews();
    return { ok: true, summary, message };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "清理日志失败") };
  }
}
