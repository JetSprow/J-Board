"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getAppConfig } from "@/services/app-config";
import { isSmtpConfigured, normalizeEmailAddress, sendPasswordResetEmail, sendRegistrationVerificationEmail, consumePasswordResetToken, verifyEmailToken } from "@/services/email";

const emailSchema = z.object({
  email: z.string().trim().email("请输入正确的邮箱"),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, "重设链接无效"),
  password: z.string().min(6, "新密码至少 6 位"),
  confirmPassword: z.string().min(6, "确认密码至少 6 位"),
});

async function requestContext() {
  const headerList = await headers();
  return { headers: headerList };
}

async function assertMailAvailable() {
  const config = await getAppConfig();
  if (!isSmtpConfigured(config)) {
    throw new Error("站点尚未启用邮件服务，请联系管理员");
  }
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = emailSchema.parse(Object.fromEntries(formData));
  const email = normalizeEmailAddress(parsed.email);
  const { success } = await rateLimit(`ratelimit:password-reset:${email}`, 3, 10 * 60);
  if (!success) {
    throw new Error("请求过于频繁，请稍后再试");
  }

  await assertMailAvailable();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  if (user?.status === "ACTIVE") {
    await sendPasswordResetEmail({
      userId: user.id,
      email: user.email,
      ...(await requestContext()),
    });
  }
}

export async function requestRegistrationVerification(formData: FormData) {
  const parsed = emailSchema.parse(Object.fromEntries(formData));
  const email = normalizeEmailAddress(parsed.email);
  const { success } = await rateLimit(`ratelimit:email-verify:${email}`, 3, 10 * 60);
  if (!success) {
    throw new Error("请求过于频繁，请稍后再试");
  }

  await assertMailAvailable();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true, emailVerifiedAt: true },
  });

  if (user?.status === "ACTIVE" && !user.emailVerifiedAt) {
    await sendRegistrationVerificationEmail({
      userId: user.id,
      email: user.email,
      ...(await requestContext()),
    });
  }
}

export async function resetPasswordByEmail(formData: FormData) {
  const parsed = resetPasswordSchema.parse(Object.fromEntries(formData));
  if (parsed.password !== parsed.confirmPassword) {
    throw new Error("两次输入的新密码不一致");
  }

  const record = await consumePasswordResetToken(parsed.token);
  const hashedPassword = await bcrypt.hash(parsed.password, 12);
  await prisma.user.update({
    where: { id: record.userId },
    data: { password: hashedPassword },
  });
}


const confirmEmailSchema = z.object({
  token: z.string().trim().min(20, "验证链接无效"),
});

export async function confirmEmailToken(formData: FormData) {
  const parsed = confirmEmailSchema.parse(Object.fromEntries(formData));
  return verifyEmailToken(parsed.token);
}
