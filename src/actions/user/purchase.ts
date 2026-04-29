"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import {
  buildUnavailableMessage,
  formatAvailabilityDateTime,
  getPlanAvailability,
} from "@/services/plan-availability";
import {
  ensurePlanTrafficPoolCapacity,
  getPlanTrafficPoolState,
} from "@/services/plan-traffic-pool";
import { getPlanPurchasePrice, roundMoney } from "@/services/commerce";

async function assertNoPendingOrder(userId: string) {
  const pendingOrder = await prisma.order.findFirst({
    where: { userId, status: "PENDING" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (pendingOrder) {
    throw new Error("你还有一笔订单正在等待支付，请先完成或取消后再继续购买");
  }
}

function getRenewalOrderPrice(
  plan: {
    durationDays: number;
    renewalPrice: unknown;
    renewalPricingMode: string;
    renewalDurationDays: number | null;
    renewalMinDays: number | null;
    renewalMaxDays: number | null;
  },
  requestedDays?: number,
) {
  const unitPrice = Number(plan.renewalPrice ?? 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error("这款套餐暂时不支持续费");
  }

  const mode = plan.renewalPricingMode === "PER_DAY" ? "PER_DAY" : "FIXED_DURATION";
  if (mode === "PER_DAY") {
    const minDays = plan.renewalMinDays ?? 1;
    const maxDays = plan.renewalMaxDays ?? plan.durationDays;
    const durationDays = requestedDays ?? minDays;
    if (!Number.isInteger(durationDays) || durationDays < minDays || durationDays > maxDays) {
      throw new Error(`续费天数范围: ${minDays}-${maxDays} 天`);
    }
    return {
      durationDays,
      amount: roundMoney(unitPrice * durationDays),
    };
  }

  const unitDays = plan.renewalDurationDays ?? plan.durationDays;
  const minDays = plan.renewalMinDays ?? unitDays;
  const maxDays = plan.renewalMaxDays ?? unitDays;
  const durationDays = requestedDays ?? unitDays;
  if (!Number.isInteger(durationDays) || durationDays < minDays || durationDays > maxDays) {
    throw new Error(`续费天数范围: ${minDays}-${maxDays} 天`);
  }
  if (durationDays % unitDays !== 0) {
    throw new Error(`续费天数必须是 ${unitDays} 天的整数倍`);
  }

  return {
    durationDays,
    amount: roundMoney(unitPrice * (durationDays / unitDays)),
  };
}

function getTrafficTopupOrderPrice(
  plan: {
    topupPricingMode: string;
    topupPricePerGb: unknown;
    topupFixedPrice: unknown;
    minTopupGb: number | null;
    maxTopupGb: number | null;
    pricePerGb: unknown;
  },
  trafficGb: number,
) {
  const minTopupGb = plan.minTopupGb ?? 1;
  const maxTopupGb = plan.maxTopupGb ?? null;
  if (trafficGb < minTopupGb) {
    throw new Error(`单次至少增加 ${minTopupGb} GB`);
  }
  if (maxTopupGb != null && trafficGb > maxTopupGb) {
    throw new Error(`单次最多增加 ${maxTopupGb} GB`);
  }

  if (plan.topupPricingMode === "FIXED_AMOUNT") {
    const fixedAmount = Number(plan.topupFixedPrice ?? 0);
    if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
      throw new Error("这款套餐暂时不能增加流量");
    }
    return roundMoney(fixedAmount);
  }

  const pricePerGb = Number(plan.topupPricePerGb ?? plan.pricePerGb ?? 0);
  if (!Number.isFinite(pricePerGb) || pricePerGb <= 0) {
    throw new Error("这款套餐暂时不能增加流量");
  }
  return roundMoney(pricePerGb * trafficGb);
}

export async function purchaseProxy(
  planId: string,
  trafficGb: number,
  selectedInboundId: string,
): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("未登录");
  await assertNoPendingOrder(session.user.id);

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      inboundOptions: {
        include: {
          inbound: {
            select: {
              id: true,
              isActive: true,
              serverId: true,
            },
          },
        },
      },
    },
  });

  if (plan.type !== "PROXY") throw new Error(`套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为代理套餐购买`);
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);

  const price = getPlanPurchasePrice(plan, trafficGb);

  const poolState = await getPlanTrafficPoolState(plan.id);
  if (poolState.enabled && price.trafficGb != null) {
    await ensurePlanTrafficPoolCapacity(plan.id, price.trafficGb, {
      messagePrefix: "这款套餐额度暂时不足",
    });
  }

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const selectableInboundIds = plan.inboundOptions
    .filter(
      (item) =>
        item.inbound.isActive
        && (!plan.nodeId || item.inbound.serverId === plan.nodeId),
    )
    .map((item) => item.inboundId);

  let fallbackInboundId = "";
  if (plan.inboundId && plan.nodeId) {
    const fallbackInbound = await prisma.nodeInbound.findFirst({
      where: {
        id: plan.inboundId,
        serverId: plan.nodeId,
        isActive: true,
      },
      select: { id: true },
    });
    fallbackInboundId = fallbackInbound?.id ?? "";
  }

  const selectable = selectableInboundIds.length > 0 ? selectableInboundIds : [fallbackInboundId];

  if (!selectedInboundId || !selectable.filter(Boolean).includes(selectedInboundId)) {
    throw new Error("请选择有效的线路入口");
  }
  if (!selectable[0]) {
    throw new Error("这款套餐的线路入口正在整理中，暂时不能购买");
  }

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId,
      kind: "NEW_PURCHASE",
      amount: price.amount,
      subtotalAmount: price.amount,
      discountAmount: 0,
      selectedInboundId,
      status: "PENDING",
      items: {
        create: {
          planId,
          selectedInboundId,
          trafficGb: price.trafficGb,
          unitAmount: price.unitAmount,
          amount: price.amount,
        },
      },
    },
  });

  return order.id;
}

export async function purchaseStreaming(planId: string): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("未登录");
  await assertNoPendingOrder(session.user.id);

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
  });

  if (plan.type !== "STREAMING") throw new Error(`套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为流媒体套餐购买`);
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const price = getPlanPurchasePrice(plan);
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId,
      kind: "NEW_PURCHASE",
      amount: price.amount,
      subtotalAmount: price.amount,
      discountAmount: 0,
      status: "PENDING",
      items: {
        create: {
          planId,
          trafficGb: null,
          unitAmount: price.unitAmount,
          amount: price.amount,
        },
      },
    },
  });

  return order.id;
}

export type PurchaseRenewalResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function purchaseRenewal(
  subscriptionId: string,
  renewalDays?: number,
): Promise<PurchaseRenewalResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("未登录");
    await assertNoPendingOrder(session.user.id);

    const subscription = await prisma.userSubscription.findFirst({
      where: { id: subscriptionId, userId: session.user.id },
      include: {
        plan: true,
      },
    });
    if (!subscription) throw new Error("订阅不存在");
    if (subscription.status !== "ACTIVE" || subscription.endDate <= new Date()) {
      throw new Error("仅支持对活跃订阅续费");
    }
    if (!subscription.plan.allowRenewal) {
      throw new Error("这款套餐暂时不支持续费");
    }

    const price = getRenewalOrderPrice(subscription.plan, renewalDays);
    const order = await prisma.order.create({
      data: {
        userId: session.user.id,
        planId: subscription.planId,
        kind: "RENEWAL",
        targetSubscriptionId: subscription.id,
        amount: price.amount,
        subtotalAmount: price.amount,
        discountAmount: 0,
        durationDays: price.durationDays,
        status: "PENDING",
      },
    });
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "创建续费订单失败") };
  }
}

export async function purchaseTrafficTopup(
  subscriptionId: string,
  trafficGb: number,
): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("未登录");
  await assertNoPendingOrder(session.user.id);

  if (!Number.isFinite(trafficGb) || trafficGb <= 0 || !Number.isInteger(trafficGb)) {
    throw new Error("增流量必须是正整数 GB");
  }

  const subscription = await prisma.userSubscription.findFirst({
    where: { id: subscriptionId, userId: session.user.id },
    include: {
      plan: true,
    },
  });
  if (!subscription) throw new Error("订阅不存在");
  if (subscription.plan.type !== "PROXY") {
    throw new Error("仅代理订阅支持增流量");
  }
  if (subscription.status !== "ACTIVE" || subscription.endDate <= new Date()) {
    throw new Error("增流量仅在当前套餐有效期内生效");
  }
  if (!subscription.plan.allowTrafficTopup) {
    throw new Error("这款套餐暂时不支持增加流量");
  }

  const amount = getTrafficTopupOrderPrice(subscription.plan, trafficGb);
  const poolState = await getPlanTrafficPoolState(subscription.planId);
  if (poolState.enabled) {
    const remainingGb = Math.max(0, Math.floor(poolState.remainingGb));
    if (trafficGb > remainingGb) {
      throw new Error(`剩余总流量不足，当前最多可增 ${remainingGb} GB`);
    }
  }
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId: subscription.planId,
      kind: "TRAFFIC_TOPUP",
      targetSubscriptionId: subscription.id,
      amount,
      subtotalAmount: amount,
      discountAmount: 0,
      trafficGb,
      status: "PENDING",
    },
  });
  return order.id;
}

export async function queryPlanNextAvailability(planId: string): Promise<{
  available: boolean;
  message: string;
  nextAvailableAt: string | null;
}> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("未登录");

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    select: {
      id: true,
      type: true,
      totalLimit: true,
      perUserLimit: true,
      streamingServiceId: true,
      isActive: true,
    },
  });

  if (!plan.isActive) {
    return {
      available: false,
      message: "这款套餐暂时不可购买",
      nextAvailableAt: null,
    };
  }

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  return {
    available: availability.available,
    message: availability.available ? "这款套餐现在可以购买" : buildUnavailableMessage(availability),
    nextAvailableAt: availability.nextAvailableAt
      ? formatAvailabilityDateTime(availability.nextAvailableAt)
      : null,
  };
}
