"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { actorFromSession, recordAuditLog } from "@/services/audit";

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

const userDeleteBlockerLabels: Record<string, string> = {
  subscriptions: "订阅",
  orders: "订单",
  nodeClients: "节点客户端",
  streamingSlots: "流媒体分配",
  supportTickets: "工单",
  inviteRewardLedgers: "邀请返利记录",
  inviteeRewardLedgers: "被邀请返利记录",
};

function formatDeleteBlockers(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${userDeleteBlockerLabels[key] ?? key} ${count} 条`)
    .join("、");
}

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
    message: `将用户 ${user.email} 状态改为 ${status}`,
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
      _count: {
        select: {
          subscriptions: true,
          orders: true,
          nodeClients: true,
          streamingSlots: true,
          supportTickets: true,
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

  const blockers = formatDeleteBlockers(user._count);
  if (blockers) {
    throw new Error(
      `无法直接删除该用户：存在 ${blockers}。为避免订单、订阅和客服记录丢失，请改用“禁用”或“封禁”；如确需彻底清理，请先人工处理关联数据。`,
    );
  }

  await prisma.user.delete({ where: { id: user.id } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.delete",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    message: `删除用户 ${user.email}`,
  });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${user.id}`);
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
    message: `批量更新 ${userIds.length} 个用户状态为 ${status}`,
    metadata: {
      userIds,
      status: String(status),
    },
  });

  revalidatePath("/admin/users");
}
