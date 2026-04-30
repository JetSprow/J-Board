"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { createPanelAdapter } from "@/services/node-panel/factory";
import { getUserStatusLabel } from "@/lib/domain-labels";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

const updateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]),
});

export async function createUser(formData: FormData) {
  const session = await requireAdmin();
  const data = createUserSchema.parse(Object.fromEntries(formData));
  const hashed = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { email: data.email, emailVerifiedAt: new Date(), password: hashed, name: data.name || null, role: data.role },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.create",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    message: `创建用户 ${user.email}`,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
}

export async function updateUser(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = updateUserSchema.parse(Object.fromEntries(formData));

  const updateData: {
    email: string;
    name: string | null;
    role: "ADMIN" | "USER";
    password?: string;
  } = {
    email: data.email,
    name: data.name || null,
    role: data.role,
  };

  if (data.password && data.password.trim()) {
    updateData.password = await bcrypt.hash(data.password.trim(), 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.update",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    message: `更新用户 ${user.email}`,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
}

export async function updateUserStatus(id: string, status: "ACTIVE" | "DISABLED" | "BANNED") {
  const session = await requireAdmin();
  const user = await prisma.user.update({ where: { id }, data: { status } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.status",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    message: `将用户 ${user.email} 状态改为${getUserStatusLabel(status)}`,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (id === session.user.id) {
    throw new Error("不能删除当前登录的管理员账号");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      subscriptions: { select: { id: true } },
      nodeClients: {
        select: {
          id: true,
          email: true,
          uuid: true,
          inbound: {
            select: {
              panelInboundId: true,
              server: {
                select: {
                  id: true,
                  name: true,
                  panelType: true,
                  panelUrl: true,
                  panelUsername: true,
                  panelPassword: true,
                },
              },
            },
          },
        },
      },
      streamingSlots: { select: { serviceId: true } },
      _count: {
        select: {
          subscriptions: true,
          orders: true,
          nodeClients: true,
          streamingSlots: true,
          supportTickets: true,
          supportReplies: true,
          cartItems: true,
          couponGrants: true,
          notifications: true,
          emailTokens: true,
          inviteRewardLedgers: true,
          inviteeRewardLedgers: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("用户不存在，可能已经被删除");
  }

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: {
        role: "ADMIN",
        status: "ACTIVE",
        id: { not: user.id },
      },
    });
    if (adminCount === 0) {
      throw new Error("不能删除最后一个可用管理员账号");
    }
  }

  const panelAdapters = new Map<string, ReturnType<typeof createPanelAdapter>>();
  for (const client of user.nodeClients) {
    const panelInboundId = client.inbound.panelInboundId;
    const server = client.inbound.server;
    if (panelInboundId == null) {
      throw new Error(`节点客户端 ${client.email} 所属入站缺少 3x-ui 入站 ID，无法强制删除。请先同步节点入站后重试。`);
    }

    let adapter = panelAdapters.get(server.id);
    if (!adapter) {
      adapter = createPanelAdapter(server);
      const loggedIn = await adapter.login();
      if (!loggedIn) {
        throw new Error(`节点 ${server.name} 登录失败，无法删除该用户在节点面板中的客户端。`);
      }
      panelAdapters.set(server.id, adapter);
    }

    await adapter.deleteClient(panelInboundId, client.uuid);
  }

  const subscriptionIds = user.subscriptions.map((subscription) => subscription.id);
  const nodeClientIds = user.nodeClients.map((client) => client.id);
  const streamingServiceIds = [...new Set(user.streamingSlots.map((slot) => slot.serviceId))];
  const subscriptionLinkedWhere = subscriptionIds.length > 0
    ? { OR: [{ userId: user.id }, { subscriptionId: { in: subscriptionIds } }] }
    : { userId: user.id };
  const orderWhere = subscriptionIds.length > 0
    ? {
        OR: [
          { userId: user.id },
          { targetSubscriptionId: { in: subscriptionIds } },
          { subscriptionId: { in: subscriptionIds } },
        ],
      }
    : { userId: user.id };

  const deleted = await prisma.$transaction(async (tx) => {
    const trafficLogs = nodeClientIds.length > 0
      ? await tx.trafficLog.deleteMany({ where: { clientId: { in: nodeClientIds } } })
      : { count: 0 };
    const accessLogs = await tx.subscriptionAccessLog.deleteMany({ where: subscriptionLinkedWhere });
    const riskEvents = await tx.subscriptionRiskEvent.deleteMany({ where: subscriptionLinkedWhere });
    const inviteRewards = await tx.inviteRewardLedger.deleteMany({
      where: { OR: [{ inviterId: user.id }, { inviteeId: user.id }] },
    });
    const couponGrants = await tx.couponGrant.deleteMany({ where: { userId: user.id } });
    const cartItems = await tx.shoppingCartItem.deleteMany({ where: { userId: user.id } });
    const notifications = await tx.userNotification.deleteMany({ where: { userId: user.id } });
    const emailTokens = await tx.emailToken.deleteMany({ where: { userId: user.id } });
    const supportTickets = await tx.supportTicket.deleteMany({ where: { userId: user.id } });
    const supportReplies = await tx.supportTicketReply.deleteMany({ where: { authorUserId: user.id } });
    const orders = await tx.order.deleteMany({ where: orderWhere });
    const nodeClients = await tx.nodeClient.deleteMany({ where: { userId: user.id } });
    const streamingSlots = await tx.streamingSlot.deleteMany({ where: { userId: user.id } });

    for (const serviceId of streamingServiceIds) {
      const usedSlots = await tx.streamingSlot.count({ where: { serviceId } });
      await tx.streamingService.update({
        where: { id: serviceId },
        data: { usedSlots },
      });
    }

    const subscriptions = await tx.userSubscription.deleteMany({ where: { userId: user.id } });
    await tx.user.delete({ where: { id: user.id } });

    return {
      accessLogs: accessLogs.count,
      cartItems: cartItems.count,
      couponGrants: couponGrants.count,
      emailTokens: emailTokens.count,
      inviteRewards: inviteRewards.count,
      nodeClients: nodeClients.count,
      notifications: notifications.count,
      orders: orders.count,
      riskEvents: riskEvents.count,
      streamingSlots: streamingSlots.count,
      subscriptions: subscriptions.count,
      supportReplies: supportReplies.count,
      supportTickets: supportTickets.count,
      trafficLogs: trafficLogs.count,
    };
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.force_delete",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    message: `强制删除用户 ${user.email} 及其名下业务数据`,
    metadata: {
      beforeDeleteCounts: user._count,
      deleted,
    },
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/support");
  revalidatePath("/admin/traffic");
  revalidatePath("/admin/subscription-risk");
}

export async function batchUpdateUserStatus(formData: FormData) {
  const session = await requireAdmin();
  const status = formData.get("status");
  const userIds = formData.getAll("userIds").map(String).filter(Boolean);

  if (!status || !["ACTIVE", "DISABLED", "BANNED"].includes(String(status))) {
    throw new Error("批量状态无效");
  }
  if (userIds.length === 0) {
    throw new Error("请至少选择一个用户");
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { status: status as "ACTIVE" | "DISABLED" | "BANNED" },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.batch_status",
    targetType: "User",
    message: `批量更新 ${userIds.length} 个用户状态为${getUserStatusLabel(String(status))}`,
    metadata: {
      userIds,
      status: String(status),
    },
  });

  revalidatePath("/admin/users");
}
