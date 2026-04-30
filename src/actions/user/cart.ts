"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";
import { buildUnavailableMessage, getPlanAvailability } from "@/services/plan-availability";
import { getPlanPurchasePrice, calculateCheckoutDiscounts } from "@/services/commerce";
import { ensurePlanTrafficPoolCapacity } from "@/services/plan-traffic-pool";
import { getSubscriptionTypeLabel } from "@/lib/domain-labels";

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

async function getProxyPlanForCart(planId: string) {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      inboundOptions: {
        include: {
          inbound: {
            select: { id: true, serverId: true, isActive: true },
          },
        },
      },
    },
  });

  if (plan.type !== "PROXY") throw new Error(`套餐类型不匹配：${plan.name} 是${getSubscriptionTypeLabel(plan.type)}，不能作为代理套餐加入购物车`);
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  return plan;
}

function assertInboundSelectable(
  plan: Awaited<ReturnType<typeof getProxyPlanForCart>>,
  selectedInboundId: string,
) {
  const selectableInboundIds = plan.inboundOptions
    .filter(
      (item) =>
        item.inbound.isActive
        && (!plan.nodeId || item.inbound.serverId === plan.nodeId),
    )
    .map((item) => item.inboundId);

  const selectable = selectableInboundIds.length > 0
    ? selectableInboundIds
    : plan.inboundId
      ? [plan.inboundId]
      : [];

  if (!selectedInboundId || !selectable.includes(selectedInboundId)) {
    throw new Error("请选择有效的线路入口");
  }
}

export async function addProxyPlanToCart(
  planId: string,
  trafficGb: number,
  selectedInboundId: string,
) {
  const session = await requireAuth();
  const plan = await getProxyPlanForCart(planId);
  assertInboundSelectable(plan, selectedInboundId);

  const price = getPlanPurchasePrice(plan, trafficGb);
  if (price.trafficGb != null) {
    await ensurePlanTrafficPoolCapacity(plan.id, price.trafficGb, {
      messagePrefix: "这款套餐额度暂时不足",
    });
  }

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const existing = await prisma.shoppingCartItem.findFirst({
    where: {
      userId: session.user.id,
      planId,
      selectedInboundId,
      trafficGb: price.trafficGb,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.shoppingCartItem.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await prisma.shoppingCartItem.create({
      data: {
        userId: session.user.id,
        planId,
        selectedInboundId,
        trafficGb: price.trafficGb,
      },
    });
  }

  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function addStreamingPlanToCart(planId: string) {
  const session = await requireAuth();
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
  if (plan.type !== "STREAMING") throw new Error(`套餐类型不匹配：${plan.name} 是${getSubscriptionTypeLabel(plan.type)}，不能作为流媒体套餐加入购物车`);
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const existing = await prisma.shoppingCartItem.findFirst({
    where: { userId: session.user.id, planId, selectedInboundId: null, trafficGb: null },
    select: { id: true },
  });

  if (existing) {
    await prisma.shoppingCartItem.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await prisma.shoppingCartItem.create({ data: { userId: session.user.id, planId } });
  }

  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function removeCartItem(itemId: string) {
  const session = await requireAuth();
  await prisma.shoppingCartItem.deleteMany({
    where: { id: itemId, userId: session.user.id },
  });
  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function clearCart() {
  const session = await requireAuth();
  await prisma.shoppingCartItem.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function checkoutCart(couponCode?: string | null): Promise<string> {
  const session = await requireAuth();
  await assertNoPendingOrder(session.user.id);

  const items = await prisma.shoppingCartItem.findMany({
    where: { userId: session.user.id },
    include: {
      plan: true,
      selectedInbound: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) throw new Error("购物车还是空的");

  const orderItems: Array<{
    planId: string;
    selectedInboundId: string | null;
    trafficGb: number | null;
    unitAmount: number;
    amount: number;
  }> = [];
  const trafficByPlan = new Map<string, number>();

  for (const item of items) {
    if (!item.plan.isActive) throw new Error(`${item.plan.name} 已下架，请先移出购物车`);

    const availability = await getPlanAvailability(item.plan, { userId: session.user.id });
    if (!availability.available) {
      throw new Error(`${item.plan.name}：${buildUnavailableMessage(availability)}`);
    }

    if (item.plan.type === "PROXY") {
      if (!item.selectedInboundId) throw new Error(`${item.plan.name} 缺少线路入口`);
      const plan = await getProxyPlanForCart(item.planId);
      assertInboundSelectable(plan, item.selectedInboundId);
      const price = getPlanPurchasePrice(item.plan, item.trafficGb);
      if (!price.trafficGb) throw new Error(`${item.plan.name} 缺少流量配置`);
      trafficByPlan.set(item.planId, (trafficByPlan.get(item.planId) ?? 0) + price.trafficGb);
      orderItems.push({
        planId: item.planId,
        selectedInboundId: item.selectedInboundId,
        trafficGb: price.trafficGb,
        unitAmount: price.unitAmount,
        amount: price.amount,
      });
    } else {
      const price = getPlanPurchasePrice(item.plan);
      orderItems.push({
        planId: item.planId,
        selectedInboundId: null,
        trafficGb: null,
        unitAmount: price.unitAmount,
        amount: price.amount,
      });
    }
  }

  for (const [planId, trafficGb] of trafficByPlan) {
    await ensurePlanTrafficPoolCapacity(planId, trafficGb, {
      messagePrefix: "购物车中的代理套餐额度暂时不足",
    });
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.amount, 0);
  const discounts = await calculateCheckoutDiscounts({
    userId: session.user.id,
    subtotal,
    couponCode,
  });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: session.user.id,
        planId: orderItems[0].planId,
        kind: "NEW_PURCHASE",
        amount: discounts.payable,
        subtotalAmount: discounts.subtotal,
        discountAmount: discounts.totalDiscount,
        couponId: discounts.coupon?.id ?? null,
        couponCode: discounts.coupon?.code ?? null,
        promotionName: discounts.promotion?.name ?? null,
        status: "PENDING",
        items: {
          create: orderItems,
        },
      },
    });

    if (discounts.couponGrantId) {
      await tx.couponGrant.update({
        where: { id: discounts.couponGrantId },
        data: { usedOrderId: created.id, usedAt: new Date() },
      });
    }

    await tx.shoppingCartItem.deleteMany({ where: { userId: session.user.id } });
    return created;
  });

  revalidatePath("/cart");
  revalidatePath("/store");
  revalidatePath("/orders");

  return order.id;
}
