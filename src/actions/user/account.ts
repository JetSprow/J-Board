"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmailAddress, sendEmailChangeConfirmation } from "@/services/email";
import { requireAuth } from "@/lib/require-auth";

const profileSchema = z.object({
  name: z.string().trim().min(1, "昵称不能为空").max(50, "昵称不能超过 50 个字符"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "当前密码不能为空"),
  newPassword: z.string().min(6, "新密码至少 6 位"),
  confirmPassword: z.string().min(6, "确认密码至少 6 位"),
});

const emailChangeSchema = z.object({
  email: z.string().trim().email("请输入正确的新邮箱"),
});

const EMAIL_CHANGE_LIMIT = 3;
const EMAIL_CHANGE_WINDOW_SECONDS = 10 * 60;

async function assertEmailChangeRateLimit(userId: string, email: string) {
  const [userLimit, targetLimit] = await Promise.all([
    rateLimit(
      `ratelimit:account-email-change:user:${userId}`,
      EMAIL_CHANGE_LIMIT,
      EMAIL_CHANGE_WINDOW_SECONDS,
    ),
    rateLimit(
      `ratelimit:account-email-change:email:${email}`,
      EMAIL_CHANGE_LIMIT,
      EMAIL_CHANGE_WINDOW_SECONDS,
    ),
  ]);

  if (!userLimit.success || !targetLimit.success) {
    throw new Error("请求过于频繁，请稍后再试");
  }
}

async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const exists = await prisma.user.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!exists) {
      return code;
    }
  }

  throw new Error("邀请码生成失败：连续 10 次生成的随机码都已存在，请稍后重试");
}

export async function updateAccountProfile(formData: FormData) {
  const session = await requireAuth();
  const data = profileSchema.parse(Object.fromEntries(formData));

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name },
  });

  revalidatePath("/account");
}

export async function requestAccountEmailChange(formData: FormData) {
  const session = await requireAuth();
  const data = emailChangeSchema.parse(Object.fromEntries(formData));
  const email = normalizeEmailAddress(data.email);

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (current.email === email) {
    throw new Error("新邮箱不能与当前邮箱相同");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new Error("这个邮箱已经被其他账户使用");
  }

  await assertEmailChangeRateLimit(session.user.id, email);

  const headerList = await headers();
  await sendEmailChangeConfirmation({
    userId: session.user.id,
    email,
    headers: headerList,
  });
}

export async function changeAccountPassword(formData: FormData) {
  const session = await requireAuth();
  const data = passwordSchema.parse(Object.fromEntries(formData));

  if (data.newPassword !== data.confirmPassword) {
    throw new Error("两次输入的新密码不一致");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { password: true },
  });

  const valid = await bcrypt.compare(data.currentPassword, user.password);
  if (!valid) {
    throw new Error("当前密码不正确");
  }

  const hashed = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  });

  revalidatePath("/account");
}

export async function generateInviteCode() {
  const session = await requireAuth();
  const code = await generateUniqueInviteCode();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { inviteCode: code },
  });

  revalidatePath("/account");
  return code;
}
