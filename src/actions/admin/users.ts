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
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  const user = await prisma.user.delete({ where: { id } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "user.delete",
    targetType: "User",
    targetId: user.id,
    targetLabel: user.email,
    message: `删除用户 ${user.email}`,
  });
  revalidatePath("/admin/users");
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
