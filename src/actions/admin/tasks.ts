"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { dispatchSubscriptionReminders } from "@/services/notifications";
import { confirmPendingOrder } from "@/services/payment/process";
import { runTask, updateTaskRun } from "@/services/task-center";
import { prisma } from "@/lib/prisma";
import { getTaskKindLabel } from "@/lib/domain-labels";

function revalidateTaskViews() {
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/health");
  revalidatePath("/admin/traffic");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/notifications");
}

export async function runReminderTask() {
  const session = await requireAdmin();
  const actor = actorFromSession(session);

  const outcome = await runTask(
    {
      kind: "REMINDER_DISPATCH",
      title: "手动派发提醒任务",
      triggeredById: session.user.id,
    },
    async () => {
      await dispatchSubscriptionReminders();
      return { ok: true };
    },
  );

  await recordAuditLog({
    actor,
    action: "task.run",
    targetType: "TaskRun",
    targetId: outcome.taskId,
    targetLabel: getTaskKindLabel("REMINDER_DISPATCH"),
    message: "手动执行提醒派发任务",
  });

  revalidateTaskViews();
}

export async function retryTaskRun(taskId: string) {
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  const task = await prisma.taskRun.findUniqueOrThrow({
    where: { id: taskId },
  });

  await updateTaskRun(task.id, {
    status: "RUNNING",
    errorMessage: null,
    startedAt: new Date(),
    retryCountIncrement: true,
  });

  try {
    let result: unknown = { ok: true };

    if (task.kind === "ORDER_PROVISION_RETRY") {
      const orderId = (task.payload as { orderId?: string } | null)?.orderId;
      if (!orderId) {
        throw new Error("任务缺少订单 ID");
      }
      result = await confirmPendingOrder(orderId);
    } else if (task.kind === "REMINDER_DISPATCH") {
      await dispatchSubscriptionReminders();
    }

    await updateTaskRun(task.id, {
      status: "SUCCESS",
      finishedAt: new Date(),
      result: result as never,
    });

    await recordAuditLog({
      actor,
      action: "task.retry",
      targetType: "TaskRun",
      targetId: task.id,
      targetLabel: getTaskKindLabel(task.kind),
      message: `重试任务 ${task.title}`,
    });
  } catch (error) {
    await updateTaskRun(task.id, {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : "重试失败",
    });
    throw error;
  }

  revalidateTaskViews();
}

export async function batchRetryTaskRuns(formData: FormData) {
  const taskIds = formData.getAll("taskIds").map(String).filter(Boolean);

  if (taskIds.length === 0) {
    throw new Error("请至少选择一个任务");
  }

  for (const taskId of taskIds) {
    await retryTaskRun(taskId);
  }
}
