"use server";

import { revalidatePath } from "next/cache";
import type { SubscriptionRiskReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { activateSubscription } from "./subscriptions";

const REVIEW_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;

function assertReviewStatus(status: string): asserts status is SubscriptionRiskReviewStatus {
  if (!REVIEW_STATUSES.includes(status as SubscriptionRiskReviewStatus)) {
    throw new Error("不支持的处理状态");
  }
}

function reviewStatusLabel(status: SubscriptionRiskReviewStatus) {
  switch (status) {
    case "OPEN":
      return "待处理";
    case "ACKNOWLEDGED":
      return "已确认";
    case "RESOLVED":
      return "已解决";
  }
}

function normalizeNote(note: string | null | undefined) {
  const value = note?.trim();
  return value ? value.slice(0, 1000) : null;
}

function revalidateRiskViews(subscriptionId?: string | null) {
  revalidatePath("/admin/subscription-risk");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/subscriptions");
  if (subscriptionId) revalidatePath(`/admin/subscriptions/${subscriptionId}`);
}

async function getRiskTargetLabel(input: {
  userId?: string | null;
  subscriptionId?: string | null;
}) {
  if (input.subscriptionId) {
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: input.subscriptionId },
      select: {
        plan: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    if (subscription) return `${subscription.user.email} / ${subscription.plan.name}`;
  }

  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    return user?.email ?? input.userId;
  }

  return null;
}

export async function updateSubscriptionRiskReview(
  eventId: string,
  status: SubscriptionRiskReviewStatus,
  note?: string,
  options: { restoreSubscription?: boolean } = {},
) {
  assertReviewStatus(status);
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  const event = await prisma.subscriptionRiskEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      userId: true,
      subscriptionId: true,
      kind: true,
      level: true,
      reason: true,
      message: true,
      reviewStatus: true,
    },
  });

  if (options.restoreSubscription) {
    if (status !== "RESOLVED") {
      throw new Error("只有标记已解决时才能恢复订阅");
    }
    if (!event.subscriptionId) {
      throw new Error("该风控事件没有关联单个订阅，请到订阅详情中逐个恢复");
    }
    await activateSubscription(event.subscriptionId);
  }

  const normalizedNote = normalizeNote(note);
  const reviewedAt = new Date();
  await prisma.subscriptionRiskEvent.update({
    where: { id: event.id },
    data: {
      reviewStatus: status,
      reviewNote: normalizedNote,
      reviewedAt,
      reviewedById: actor.userId ?? null,
      reviewedByEmail: actor.email ?? null,
    },
  });

  const targetLabel = await getRiskTargetLabel({
    userId: event.userId,
    subscriptionId: event.subscriptionId,
  });

  await recordAuditLog({
    actor,
    action: "risk.subscription.review",
    targetType: event.subscriptionId ? "UserSubscription" : "User",
    targetId: event.subscriptionId ?? event.userId ?? event.id,
    targetLabel,
    message: `将订阅风控事件标记为${reviewStatusLabel(status)}`,
    metadata: {
      eventId: event.id,
      oldReviewStatus: event.reviewStatus,
      newReviewStatus: status,
      restoreSubscription: options.restoreSubscription === true,
      note: normalizedNote,
      kind: event.kind,
      level: event.level,
      reason: event.reason,
    },
  });

  revalidateRiskViews(event.subscriptionId);
  return { ok: true };
}
