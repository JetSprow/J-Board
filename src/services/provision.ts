import { prisma, type DbClient } from "@/lib/prisma";
import { bytesToGb, gbToBytes } from "@/lib/utils";
import { addDays } from "date-fns";
import {
  ensurePlanTrafficPoolCapacityByBytes,
  getPlanTrafficPoolState,
} from "@/services/plan-traffic-pool";
import { recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";
import { generateNodeClientCredential } from "@/services/node-client-credential";
import { createPanelAdapter } from "@/services/node-panel/factory";
import { getOrderKindLabel, getSubscriptionStatusLabel } from "@/lib/domain-labels";
import type {
  NodeServer,
  Order,
  Protocol,
  OrderItem,
  SubscriptionPlan,
  User,
} from "@prisma/client";


type PaidOrder = Order & { plan: SubscriptionPlan; user: User };
type NewOrderItem = Pick<OrderItem, "planId" | "selectedInboundId" | "trafficGb"> & {
  plan: SubscriptionPlan;
};

export async function provisionSubscription(order: PaidOrder): Promise<string[]> {
  return provisionSubscriptionWithDb(order, prisma);
}

export async function provisionSubscriptionWithDb(
  order: PaidOrder,
  db: DbClient,
): Promise<string[]> {
  if (order.kind === "NEW_PURCHASE") {
    return provisionNewSubscription(order, db);
  }
  if (order.kind === "RENEWAL") {
    return applyRenewal(order, db);
  }
  if (order.kind === "TRAFFIC_TOPUP") {
    return applyTrafficTopup(order, db);
  }

  throw new Error(`开通订阅失败：不支持的订单类型${getOrderKindLabel(order.kind)}`);
}

async function getNewPurchaseItems(order: PaidOrder, db: DbClient): Promise<NewOrderItem[]> {
  const items = await db.orderItem.findMany({
    where: { orderId: order.id },
    include: { plan: true },
    orderBy: { createdAt: "asc" },
  });

  if (items.length > 0) return items;

  return [
    {
      planId: order.planId,
      selectedInboundId: order.selectedInboundId,
      trafficGb: order.trafficGb,
      plan: order.plan,
    },
  ];
}

async function provisionNewSubscription(order: PaidOrder, db: DbClient): Promise<string[]> {
  const items = await getNewPurchaseItems(order, db);
  const createdSubscriptionIds: string[] = [];
  const nodeIds = new Set<string>();

  for (const item of items) {
    const trafficBytes = item.trafficGb ? gbToBytes(item.trafficGb) : null;
    if (item.plan.type === "PROXY") {
      if (!item.trafficGb || item.trafficGb <= 0 || !trafficBytes) {
        throw new Error("代理订单缺少可用流量配置");
      }
      const poolState = await getPlanTrafficPoolState(item.planId, { db });
      if (poolState.enabled) {
        await ensurePlanTrafficPoolCapacityByBytes(
          item.planId,
          trafficBytes,
          {
            db,
            excludePendingOrderId: order.id,
            messagePrefix: "支付成功但套餐总流量池不足",
          },
        );
      }
    }

    const subscription = await db.userSubscription.create({
      data: {
        userId: order.userId,
        planId: item.planId,
        startDate: new Date(),
        endDate: addDays(new Date(), item.plan.durationDays),
        trafficLimit: trafficBytes,
        status: "ACTIVE",
      },
    });
    createdSubscriptionIds.push(subscription.id);

    if (createdSubscriptionIds.length === 1) {
      await db.order.update({
        where: { id: order.id },
        data: { subscriptionId: subscription.id },
      });
    }

    if (item.plan.type === "PROXY") {
      const nodeId = await provisionProxyClient(
        subscription.id,
        order.user,
        item.plan,
        item.trafficGb,
        item.selectedInboundId,
        db,
      );
      if (nodeId) {
        nodeIds.add(nodeId);
      }
    } else {
      await provisionStreamingSlot(subscription.id, order.userId, item.plan, db);
    }

    await recordAuditLog(
      {
        actor: {
          userId: order.userId,
          email: order.user.email,
          role: order.user.role,
        },
        action: "subscription.create",
        targetType: "UserSubscription",
        targetId: subscription.id,
        targetLabel: item.plan.name,
        message: `开通订阅 ${item.plan.name}`,
        metadata: {
          orderId: order.id,
          planId: item.planId,
        },
      },
      db,
    );
  }

  await createNotification(
    {
      userId: order.userId,
      type: "SUBSCRIPTION",
      level: "SUCCESS",
      title: items.length > 1 ? "订阅已全部开通" : "订阅已开通",
      body:
        items.length > 1
          ? `本次订单的 ${items.length} 个订阅已开通成功，请前往订阅页面查看。`
          : `${items[0]?.plan.name ?? order.plan.name} 已开通成功，请前往订阅页面查看。`,
      link: "/subscriptions",
      dedupeKey: `subscription-created:${order.id}`,
    },
    db,
  );

  return [...nodeIds];
}

async function applyRenewal(order: PaidOrder, db: DbClient): Promise<string[]> {
  if (!order.plan.allowRenewal) {
    throw new Error("该套餐当前未开放续费");
  }
  if (!order.targetSubscriptionId) {
    throw new Error("续费订单缺少目标订阅");
  }

  const subscription = await db.userSubscription.findUniqueOrThrow({
    where: { id: order.targetSubscriptionId },
    include: {
      nodeClient: {
        include: {
          inbound: {
            include: {
              server: true,
            },
          },
        },
      },
    },
  });

  if (subscription.userId !== order.userId || subscription.planId !== order.planId) {
    throw new Error("续费目标订阅与订单不匹配");
  }
  if (subscription.status !== "ACTIVE" || subscription.endDate <= new Date()) {
    throw new Error(`续费失败：目标订阅状态为${getSubscriptionStatusLabel(subscription.status)}，到期时间为 ${subscription.endDate.toISOString()}`);
  }

  const now = new Date();
  const renewalDays = order.durationDays ?? order.plan.renewalDurationDays ?? order.plan.durationDays;
  if (!Number.isInteger(renewalDays) || renewalDays <= 0) {
    throw new Error("续费订单天数配置缺失");
  }

  const nextEndDate =
    subscription.endDate > now
      ? addDays(subscription.endDate, renewalDays)
      : addDays(now, renewalDays);

  await db.userSubscription.update({
    where: { id: subscription.id },
    data: {
      endDate: nextEndDate,
      status: "ACTIVE",
    },
  });

  const proxyNodeId =
    order.plan.type === "PROXY"
      ? await syncProxyClientQuota(
          subscription,
          nextEndDate,
          db,
          subscription.trafficLimit,
        )
      : null;

  await createNotification(
    {
      userId: order.userId,
      type: "SUBSCRIPTION",
      level: "SUCCESS",
      title: "订阅续费成功",
      body: `${order.plan.name} 已续费成功，新的到期时间已更新。`,
      link: "/subscriptions",
      dedupeKey: `subscription-renewal:${order.id}`,
    },
    db,
  );
  await recordAuditLog(
    {
      actor: {
        userId: order.userId,
        email: order.user.email,
        role: order.user.role,
      },
      action: "subscription.renew",
      targetType: "UserSubscription",
      targetId: subscription.id,
      targetLabel: order.plan.name,
      message: `续费订阅 ${order.plan.name}`,
      metadata: {
        orderId: order.id,
      },
    },
    db,
  );

  return proxyNodeId ? [proxyNodeId] : [];
}

async function applyTrafficTopup(order: PaidOrder, db: DbClient): Promise<string[]> {
  if (!order.plan.allowTrafficTopup) {
    throw new Error("该套餐当前未开放增流量");
  }
  if (!order.targetSubscriptionId) {
    throw new Error("增流量订单缺少目标订阅");
  }
  if (!order.trafficGb || order.trafficGb <= 0) {
    throw new Error("增流量订单流量无效");
  }
  const poolState = await getPlanTrafficPoolState(order.planId, { db });

  const subscription = await db.userSubscription.findUniqueOrThrow({
    where: { id: order.targetSubscriptionId },
    include: {
      nodeClient: {
        include: {
          inbound: {
            include: {
              server: true,
            },
          },
        },
      },
    },
  });

  if (subscription.userId !== order.userId || subscription.planId !== order.planId) {
    throw new Error("增流量目标订阅与订单不匹配");
  }
  if (subscription.status !== "ACTIVE" || subscription.endDate <= new Date()) {
    throw new Error("增流量仅在当前套餐有效期内生效");
  }

  const topupBytes = gbToBytes(order.trafficGb);
  if (poolState.enabled) {
    await ensurePlanTrafficPoolCapacityByBytes(order.planId, topupBytes, {
      db,
      excludePendingOrderId: order.id,
      messagePrefix: "增流量后将超过套餐总流量池",
    });
  }

  const nextTrafficLimit = (subscription.trafficLimit ?? BigInt(0)) + topupBytes;
  await db.userSubscription.update({
    where: { id: subscription.id },
    data: {
      trafficLimit: nextTrafficLimit,
      status: "ACTIVE",
    },
  });

  const nodeId = await syncProxyClientQuota(
    subscription,
    subscription.endDate,
    db,
    nextTrafficLimit,
  );

  await createNotification(
    {
      userId: order.userId,
      type: "TRAFFIC",
      level: "SUCCESS",
      title: "流量已到账",
      body: `${order.plan.name} 已增加 ${order.trafficGb} GB 流量。`,
      link: "/subscriptions",
      dedupeKey: `subscription-topup:${order.id}`,
    },
    db,
  );
  await recordAuditLog(
    {
      actor: {
        userId: order.userId,
        email: order.user.email,
        role: order.user.role,
      },
      action: "subscription.topup",
      targetType: "UserSubscription",
      targetId: subscription.id,
      targetLabel: order.plan.name,
      message: `增加订阅流量 ${order.plan.name}`,
      metadata: {
        orderId: order.id,
        trafficGb: order.trafficGb,
      },
    },
    db,
  );

  return nodeId ? [nodeId] : [];
}

async function syncProxyClientQuota(
  subscription: {
    id: string;
    nodeClient: {
      id: string;
      uuid: string;
      email: string;
      inbound: {
        tag: string;
        protocol: Protocol;
        panelInboundId: number | null;
        server: NodeServer;
      };
    } | null;
  },
  endDate: Date,
  db: DbClient,
  trafficLimitBytes?: bigint | null,
  options?: { resetTraffic?: boolean },
): Promise<string | null> {
  if (!subscription.nodeClient) return null;

  await db.nodeClient.update({
    where: { id: subscription.nodeClient.id },
    data: {
      expiryTime: endDate,
      isEnabled: true,
    },
  });

  const panelInboundId = subscription.nodeClient.inbound.panelInboundId;
  if (panelInboundId == null) {
    throw new Error("3x-ui 入站 ID 缺失，请重新同步节点入站");
  }

  const adapter = createPanelAdapter(subscription.nodeClient.inbound.server);
  await adapter.login();
  await adapter.updateClient({
    inboundId: panelInboundId,
    email: subscription.nodeClient.email,
    uuid: subscription.nodeClient.uuid,
    subId: subscription.id,
    totalGB: trafficLimitBytes ? bytesToGb(trafficLimitBytes) : 0,
    expiryTime: endDate.getTime(),
    protocol: subscription.nodeClient.inbound.protocol,
    enable: true,
  });

  if (options?.resetTraffic) {
    await adapter.resetClientTraffic(panelInboundId, subscription.nodeClient.email);
    await db.nodeClient.update({
      where: { id: subscription.nodeClient.id },
      data: {
        trafficUp: BigInt(0),
        trafficDown: BigInt(0),
      },
    });
  }

  return subscription.nodeClient.inbound.server.id;
}

async function provisionProxyClient(
  subscriptionId: string,
  user: User,
  plan: SubscriptionPlan,
  trafficGb: number | null,
  selectedInboundId: string | null,
  db: DbClient,
): Promise<string> {
  if (!plan.nodeId) throw new Error("Proxy plan has no node assigned");

  const server = await db.nodeServer.findUniqueOrThrow({
    where: { id: plan.nodeId },
  });

  let inbound = null;
  if (selectedInboundId) {
    inbound = await db.nodeInbound.findFirst({
      where: {
        id: selectedInboundId,
        serverId: plan.nodeId,
        isActive: true,
      },
    });
  }

  if (!inbound && plan.inboundId) {
    inbound = await db.nodeInbound.findFirst({
      where: {
        id: plan.inboundId,
        serverId: plan.nodeId,
        isActive: true,
      },
    });
  }

  if (!inbound) {
    const option = await db.planInboundOption.findFirst({
      where: { planId: plan.id, inbound: { isActive: true, serverId: plan.nodeId } },
      select: { inboundId: true },
      orderBy: { createdAt: "asc" },
    });

    if (option?.inboundId) {
      inbound = await db.nodeInbound.findFirst({
        where: { id: option.inboundId, serverId: plan.nodeId, isActive: true },
      });
    }
  }

  if (!inbound) {
    inbound = await db.nodeInbound.findFirst({
      where: { serverId: plan.nodeId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!inbound) throw new Error("No active inbound on this node");

  const clientUuid = generateNodeClientCredential(inbound.protocol, inbound.settings);
  const clientEmail = `${user.email}-${subscriptionId.slice(0, 8)}`;

  const sub = await db.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
  });

  if (inbound.panelInboundId == null) {
    throw new Error("3x-ui 入站 ID 缺失，请先同步节点入站");
  }

  const adapter = createPanelAdapter(server);
  await adapter.login();
  await adapter.addClient({
    inboundId: inbound.panelInboundId,
    email: clientEmail,
    uuid: clientUuid,
    subId: subscriptionId,
    totalGB: trafficGb || 0,
    expiryTime: sub.endDate.getTime(),
    protocol: inbound.protocol,
  });

  await db.nodeClient.create({
    data: {
      inboundId: inbound.id,
      userId: user.id,
      subscriptionId,
      email: clientEmail,
      uuid: clientUuid,
      expiryTime: sub.endDate,
    },
  });

  return server.id;
}

async function provisionStreamingSlot(
  subscriptionId: string,
  userId: string,
  plan: SubscriptionPlan,
  db: DbClient,
) {
  const run = async (client: DbClient) => {
    let selectedServiceId: string | null = null;

    if (plan.streamingServiceId) {
      const service = await client.streamingService.findUnique({
        where: { id: plan.streamingServiceId },
        select: { id: true, maxSlots: true, isActive: true },
      });
      if (!service || !service.isActive) {
        throw new Error("绑定的流媒体服务不可用");
      }

      const updated = await client.streamingService.updateMany({
        where: {
          id: service.id,
          isActive: true,
          usedSlots: { lt: service.maxSlots },
        },
        data: { usedSlots: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new Error("绑定的流媒体服务名额已满");
      }

      selectedServiceId = service.id;
    } else {
      const services = await client.streamingService.findMany({
        where: { isActive: true },
        select: { id: true, maxSlots: true },
        orderBy: [{ usedSlots: "asc" }, { createdAt: "asc" }],
      });

      for (const service of services) {
        const updated = await client.streamingService.updateMany({
          where: {
            id: service.id,
            isActive: true,
            usedSlots: { lt: service.maxSlots },
          },
          data: { usedSlots: { increment: 1 } },
        });
        if (updated.count > 0) {
          selectedServiceId = service.id;
          break;
        }
      }

      if (!selectedServiceId) {
        throw new Error("暂无可用流媒体名额");
      }
    }

    await client.streamingSlot.create({
      data: { serviceId: selectedServiceId, userId, subscriptionId },
    });
  };

  if ("$transaction" in db) {
    await db.$transaction(async (tx) => {
      await run(tx);
    });
    return;
  }

  await run(db);
}
