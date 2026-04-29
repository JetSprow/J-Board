"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { getAppConfig } from "@/services/app-config";
import { normalizeSiteUrl } from "@/services/site-url";
import { encrypt } from "@/lib/crypto";
import { getErrorMessage } from "@/lib/errors";
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

const SMTP_TEST_LIMIT = 5;
const SMTP_TEST_WINDOW_SECONDS = 10 * 60;

const smtpTestEmailSchema = z.string().trim().email("请输入正确的测试邮箱");
const smtpTestSettingsSchema = settingsSchema.extend({
  smtpTestEmail: smtpTestEmailSchema,
});

type AdminSession = Awaited<ReturnType<typeof requireAdmin>>;
type SettingsActionResult = { ok: true } | { ok: false; error: string };
type SmtpTestActionResult =
  | { ok: true }
  | { ok: false; error: string; settingsSaved?: boolean };

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    const details = error.issues.map((issue) => issue.message).filter(Boolean).join("；");
    return details || getErrorMessage(error, fallback);
  }
  return getErrorMessage(error, fallback);
}

async function assertSmtpTestRateLimit(userId: string) {
  const { success } = await rateLimit(
    `ratelimit:smtp-test:${userId}`,
    SMTP_TEST_LIMIT,
    SMTP_TEST_WINDOW_SECONDS,
  );

  if (!success) {
    throw new Error("测试发信过于频繁，请稍后再试");
  }
}

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

function revalidateSettingsViews() {
  revalidatePath("/admin/settings");
  revalidatePath("/login");
  revalidatePath("/register");
  revalidatePath("/dashboard");
  revalidatePath("/subscriptions");
  revalidatePath("/admin/nodes");
  revalidatePath("/account");
  revalidatePath("/admin/commerce");
}

async function persistAppSettings(
  session: AdminSession,
  parsed: z.infer<typeof settingsSchema>,
  message: string,
) {
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
    message,
  });

  revalidateSettingsViews();

  return next;
}

export async function saveAppSettings(formData: FormData): Promise<SettingsActionResult> {
  try {
    const session = await requireAdmin();
    const parsed = settingsSchema.parse(Object.fromEntries(formData));
    await persistAppSettings(session, parsed, "更新系统设置");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatActionError(error, "保存失败") };
  }
}

export async function testSmtpSettings(formData: FormData): Promise<SmtpTestActionResult> {
  let parsed: z.infer<typeof smtpTestSettingsSchema>;
  let next: Awaited<ReturnType<typeof persistAppSettings>>;
  let adminUserId = "";

  try {
    const session = await requireAdmin();
    adminUserId = session.user.id;
    parsed = smtpTestSettingsSchema.parse(Object.fromEntries(formData));
    next = await persistAppSettings(session, parsed, "测试发信前更新系统设置");
  } catch (error) {
    return { ok: false, error: formatActionError(error, "测试邮件发送失败") };
  }

  if (!next.smtpEnabled) {
    return { ok: false, settingsSaved: true, error: "测试发信前请先开启邮件服务" };
  }

  try {
    await assertSmtpTestRateLimit(adminUserId);
  } catch (error) {
    return {
      ok: false,
      settingsSaved: true,
      error: formatActionError(error, "测试发信过于频繁，请稍后再试"),
    };
  }

  try {
    await sendSmtpTestEmail(parsed.smtpTestEmail);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      settingsSaved: true,
      error: formatActionError(error, "请检查 SMTP 配置后重试"),
    };
  }
}
