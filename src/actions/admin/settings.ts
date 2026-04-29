"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { getAppConfig } from "@/services/app-config";
import { normalizeSiteUrl } from "@/services/site-url";
import { encrypt } from "@/lib/crypto";
import { sendSmtpTestEmail } from "@/services/email";

const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "站点名称不能为空"),
  siteUrl: z.string().trim().optional(),
  supportContact: z.string().trim().optional(),
  maintenanceNotice: z.string().trim().optional(),
  siteNotice: z.string().trim().optional(),
  allowRegistration: z.string().optional(),
  emailVerificationRequired: z.string().optional(),
  requireInviteCode: z.string().optional(),
  autoReminderDispatchEnabled: z.string().optional(),
  reminderDispatchIntervalMinutes: z.coerce.number().int().positive().optional(),
  trafficSyncEnabled: z.string().optional(),
  trafficSyncIntervalSeconds: z.coerce.number().int().min(10).optional(),
  inviteRewardEnabled: z.string().optional(),
  inviteRewardRate: z.coerce.number().min(0).max(100).optional(),
  inviteRewardCouponId: z.string().trim().optional(),
  turnstileSiteKey: z.string().trim().optional(),
  turnstileSecretKey: z.string().trim().optional(),
  smtpEnabled: z.string().optional(),
  smtpHost: z.string().trim().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.string().optional(),
  smtpUser: z.string().trim().optional(),
  smtpPassword: z.string().optional(),
  smtpFromName: z.string().trim().optional(),
  smtpFromEmail: z.string().trim().email("发件邮箱格式不正确").optional().or(z.literal("")),
});

function buildSettingsUpdate(parsed: z.infer<typeof settingsSchema>, current: Awaited<ReturnType<typeof getAppConfig>>) {
  const smtpEnabled = parsed.smtpEnabled === "true";
  const emailVerificationRequired = parsed.emailVerificationRequired === "true";
  const smtpPassword = parsed.smtpPassword?.trim()
    ? encrypt(parsed.smtpPassword.trim())
    : current.smtpPassword;

  const next = {
    siteName: parsed.siteName,
    siteUrl: normalizeSiteUrl(parsed.siteUrl) || null,
    supportContact: parsed.supportContact || null,
    maintenanceNotice: parsed.maintenanceNotice || null,
    siteNotice: parsed.siteNotice || null,
    allowRegistration: parsed.allowRegistration === "true",
    emailVerificationRequired,
    requireInviteCode: parsed.requireInviteCode === "true",
    autoReminderDispatchEnabled: parsed.autoReminderDispatchEnabled === "true",
    reminderDispatchIntervalMinutes:
      parsed.reminderDispatchIntervalMinutes ?? current.reminderDispatchIntervalMinutes,
    trafficSyncEnabled: parsed.trafficSyncEnabled === "true",
    trafficSyncIntervalSeconds:
      parsed.trafficSyncIntervalSeconds ?? current.trafficSyncIntervalSeconds,
    inviteRewardEnabled: parsed.inviteRewardEnabled === "true",
    inviteRewardRate: parsed.inviteRewardRate ?? Number(current.inviteRewardRate),
    inviteRewardCouponId: parsed.inviteRewardCouponId || null,
    turnstileSiteKey: parsed.turnstileSiteKey || null,
    turnstileSecretKey: parsed.turnstileSecretKey || null,
    smtpEnabled,
    smtpHost: parsed.smtpHost || null,
    smtpPort: parsed.smtpPort ?? current.smtpPort,
    smtpSecure: parsed.smtpSecure === "true",
    smtpUser: parsed.smtpUser || null,
    smtpPassword,
    smtpFromName: parsed.smtpFromName || null,
    smtpFromEmail: parsed.smtpFromEmail || null,
  };

  if (next.smtpEnabled || next.emailVerificationRequired) {
    if (!next.smtpHost || !next.smtpPort || !next.smtpFromEmail) {
      throw new Error("启用邮件服务或注册邮箱验证前，请完整填写 SMTP 主机、端口和发件邮箱");
    }
  }
  if (next.emailVerificationRequired && !next.smtpEnabled) {
    throw new Error("注册邮箱验证需要先开启 SMTP 邮件服务");
  }

  return next;
}

export async function saveAppSettings(formData: FormData) {
  const session = await requireAdmin();
  const parsed = settingsSchema.parse(Object.fromEntries(formData));
  const current = await getAppConfig();
  const next = buildSettingsUpdate(parsed, current);

  await prisma.appConfig.upsert({
    where: { id: current.id },
    create: { id: current.id, ...next },
    update: next,
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "settings.update",
    targetType: "AppConfig",
    targetId: current.id,
    targetLabel: next.siteName,
    message: "更新系统设置",
  });

  revalidatePath("/admin/settings");
  revalidatePath("/login");
  revalidatePath("/register");
  revalidatePath("/dashboard");
  revalidatePath("/subscriptions");
  revalidatePath("/admin/nodes");
  revalidatePath("/account");
  revalidatePath("/admin/commerce");
}


const smtpTestSchema = z.object({
  smtpTestEmail: z.string().trim().email("请输入正确的测试邮箱"),
});

export async function sendSmtpTestMessage(formData: FormData) {
  await requireAdmin();
  const parsed = smtpTestSchema.parse(Object.fromEntries(formData));
  await sendSmtpTestEmail(parsed.smtpTestEmail);
}
