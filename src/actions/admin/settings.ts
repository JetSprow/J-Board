"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { getAppConfig } from "@/services/app-config";
import { normalizeSiteUrl } from "@/services/site-url";
import { encrypt, isEncryptedValue } from "@/lib/crypto";
import { getErrorMessage } from "@/lib/errors";
import { sendSmtpTestEmail } from "@/services/email";

const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "站点名称不能为空"),
  siteUrl: z.string().trim().optional(),
  subscriptionUrl: z.string().trim().optional(),
  supportContact: z.string().trim().optional(),
  maintenanceNotice: z.string().trim().optional(),
  siteNotice: z.string().trim().optional(),
  supportOpenTicketLimit: z.coerce.number().int().min(1).max(20).optional(),
  allowRegistration: z.string().optional(),
  emailVerificationRequired: z.string().optional(),
  requireInviteCode: z.string().optional(),
  autoReminderDispatchEnabled: z.string().optional(),
  reminderDispatchIntervalMinutes: z.coerce.number().int().positive().optional(),
  trafficSyncEnabled: z.string().optional(),
  trafficSyncIntervalSeconds: z.coerce.number().int().min(10).optional(),
  networkInsightsEnabled: z.string().optional(),
  subscriptionRiskEnabled: z.string().optional(),
  subscriptionRiskAutoSuspend: z.string().optional(),
  subscriptionRiskWindowHours: z.coerce.number().int().min(1).max(168).optional(),
  subscriptionRiskCityWarning: z.coerce.number().int().min(2).max(100).optional(),
  subscriptionRiskCitySuspend: z.coerce.number().int().min(2).max(100).optional(),
  subscriptionRiskRegionWarning: z.coerce.number().int().min(2).max(100).optional(),
  subscriptionRiskRegionSuspend: z.coerce.number().int().min(2).max(100).optional(),
  subscriptionRiskCountryWarning: z.coerce.number().int().min(2).max(100).optional(),
  subscriptionRiskCountrySuspend: z.coerce.number().int().min(2).max(100).optional(),
  subscriptionRiskIpLimitPerHour: z.coerce.number().int().min(1).max(100000).optional(),
  subscriptionRiskTokenLimitPerHour: z.coerce.number().int().min(1).max(100000).optional(),
  nodeAccessRiskEnabled: z.string().optional(),
  nodeAccessConnectionWarning: z.coerce.number().int().min(1).max(100000).optional(),
  nodeAccessConnectionSuspend: z.coerce.number().int().min(1).max(100000).optional(),
  nodeAccessUniqueTargetWarning: z.coerce.number().int().min(1).max(100000).optional(),
  nodeAccessUniqueTargetSuspend: z.coerce.number().int().min(1).max(100000).optional(),
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

function optionalBoolean(value: string | undefined, fallback: boolean) {
  return value == null ? fallback : value === "true";
}

function buildSettingsUpdate(parsed: z.infer<typeof settingsSchema>, current: Awaited<ReturnType<typeof getAppConfig>>) {
  const smtpEnabled = optionalBoolean(parsed.smtpEnabled, current.smtpEnabled);
  const emailVerificationRequired = optionalBoolean(
    parsed.emailVerificationRequired,
    current.emailVerificationRequired,
  );
  const smtpPassword = parsed.smtpPassword?.trim()
    ? encrypt(parsed.smtpPassword.trim())
    : current.smtpPassword;
  const turnstileSiteKey = parsed.turnstileSiteKey || null;
  const currentTurnstileSecret = current.turnstileSecretKey
    ? isEncryptedValue(current.turnstileSecretKey)
      ? current.turnstileSecretKey
      : encrypt(current.turnstileSecretKey)
    : null;
  const turnstileSecretKey = parsed.turnstileSecretKey?.trim()
    ? encrypt(parsed.turnstileSecretKey.trim())
    : turnstileSiteKey
      ? currentTurnstileSecret
      : null;

  const next = {
    siteName: parsed.siteName,
    siteUrl: normalizeSiteUrl(parsed.siteUrl) || null,
    subscriptionUrl: normalizeSiteUrl(parsed.subscriptionUrl) || null,
    supportContact: parsed.supportContact || null,
    supportOpenTicketLimit: parsed.supportOpenTicketLimit ?? current.supportOpenTicketLimit,
    maintenanceNotice: parsed.maintenanceNotice || null,
    siteNotice: parsed.siteNotice || null,
    allowRegistration: optionalBoolean(parsed.allowRegistration, current.allowRegistration),
    emailVerificationRequired,
    requireInviteCode: optionalBoolean(parsed.requireInviteCode, current.requireInviteCode),
    autoReminderDispatchEnabled: optionalBoolean(
      parsed.autoReminderDispatchEnabled,
      current.autoReminderDispatchEnabled,
    ),
    reminderDispatchIntervalMinutes:
      parsed.reminderDispatchIntervalMinutes ?? current.reminderDispatchIntervalMinutes,
    trafficSyncEnabled: optionalBoolean(parsed.trafficSyncEnabled, current.trafficSyncEnabled),
    trafficSyncIntervalSeconds:
      parsed.trafficSyncIntervalSeconds ?? current.trafficSyncIntervalSeconds,
    networkInsightsEnabled: optionalBoolean(
      parsed.networkInsightsEnabled,
      current.networkInsightsEnabled,
    ),
    subscriptionRiskEnabled: optionalBoolean(
      parsed.subscriptionRiskEnabled,
      current.subscriptionRiskEnabled,
    ),
    subscriptionRiskAutoSuspend: optionalBoolean(
      parsed.subscriptionRiskAutoSuspend,
      current.subscriptionRiskAutoSuspend,
    ),
    subscriptionRiskWindowHours:
      parsed.subscriptionRiskWindowHours ?? current.subscriptionRiskWindowHours,
    subscriptionRiskCityWarning:
      parsed.subscriptionRiskCityWarning ?? current.subscriptionRiskCityWarning,
    subscriptionRiskCitySuspend:
      parsed.subscriptionRiskCitySuspend ?? current.subscriptionRiskCitySuspend,
    subscriptionRiskRegionWarning:
      parsed.subscriptionRiskRegionWarning ?? current.subscriptionRiskRegionWarning,
    subscriptionRiskRegionSuspend:
      parsed.subscriptionRiskRegionSuspend ?? current.subscriptionRiskRegionSuspend,
    subscriptionRiskCountryWarning:
      parsed.subscriptionRiskCountryWarning ?? current.subscriptionRiskCountryWarning,
    subscriptionRiskCountrySuspend:
      parsed.subscriptionRiskCountrySuspend ?? current.subscriptionRiskCountrySuspend,
    subscriptionRiskIpLimitPerHour:
      parsed.subscriptionRiskIpLimitPerHour ?? current.subscriptionRiskIpLimitPerHour,
    subscriptionRiskTokenLimitPerHour:
      parsed.subscriptionRiskTokenLimitPerHour ?? current.subscriptionRiskTokenLimitPerHour,
    nodeAccessRiskEnabled: optionalBoolean(
      parsed.nodeAccessRiskEnabled,
      current.nodeAccessRiskEnabled,
    ),
    nodeAccessConnectionWarning:
      parsed.nodeAccessConnectionWarning ?? current.nodeAccessConnectionWarning,
    nodeAccessConnectionSuspend:
      parsed.nodeAccessConnectionSuspend ?? current.nodeAccessConnectionSuspend,
    nodeAccessUniqueTargetWarning:
      parsed.nodeAccessUniqueTargetWarning ?? current.nodeAccessUniqueTargetWarning,
    nodeAccessUniqueTargetSuspend:
      parsed.nodeAccessUniqueTargetSuspend ?? current.nodeAccessUniqueTargetSuspend,
    inviteRewardEnabled: optionalBoolean(parsed.inviteRewardEnabled, current.inviteRewardEnabled),
    inviteRewardRate: parsed.inviteRewardRate ?? Number(current.inviteRewardRate),
    inviteRewardCouponId: parsed.inviteRewardCouponId || null,
    turnstileSiteKey,
    turnstileSecretKey,
    smtpEnabled,
    smtpHost: parsed.smtpHost || null,
    smtpPort: parsed.smtpPort ?? current.smtpPort,
    smtpSecure: optionalBoolean(parsed.smtpSecure, current.smtpSecure),
    smtpUser: parsed.smtpUser || null,
    smtpPassword,
    smtpFromName: parsed.smtpFromName || null,
    smtpFromEmail: parsed.smtpFromEmail || null,
  };

  if (next.subscriptionRiskCitySuspend < next.subscriptionRiskCityWarning) {
    throw new Error("城市暂停阈值不能小于城市警告阈值");
  }
  if (next.subscriptionRiskRegionSuspend < next.subscriptionRiskRegionWarning) {
    throw new Error("省/地区暂停阈值不能小于省/地区警告阈值");
  }
  if (next.subscriptionRiskCountrySuspend < next.subscriptionRiskCountryWarning) {
    throw new Error("国家暂停阈值不能小于国家警告阈值");
  }
  if (next.nodeAccessConnectionSuspend < next.nodeAccessConnectionWarning) {
    throw new Error("节点连接暂停阈值不能小于警告阈值");
  }
  if (next.nodeAccessUniqueTargetSuspend < next.nodeAccessUniqueTargetWarning) {
    throw new Error("节点目标数暂停阈值不能小于警告阈值");
  }

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
  revalidatePath("/store");
  revalidatePath("/subscriptions");
  revalidatePath("/admin/nodes");
  revalidatePath("/account");
  revalidatePath("/support");
  revalidatePath("/admin/support");
  revalidatePath("/admin/commerce");
  revalidatePath("/admin/subscription-risk");
  revalidatePath("/admin/subscriptions");
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
