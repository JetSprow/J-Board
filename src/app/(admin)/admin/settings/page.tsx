import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { getAppConfig } from "@/services/app-config";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "系统设置",
  description: "维护站点配置、注册策略与客服联系方式。",
};

export default async function AdminSettingsPage() {
  const [config, coupons] = await Promise.all([
    getAppConfig(),
    prisma.coupon.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="系统"
        title="系统设置"
      />
      <SettingsForm
        config={{
          siteName: config.siteName,
          siteUrl: config.siteUrl,
          subscriptionUrl: config.subscriptionUrl,
          supportContact: config.supportContact,
          supportOpenTicketLimit: config.supportOpenTicketLimit,
          maintenanceNotice: config.maintenanceNotice,
          siteNotice: config.siteNotice,
          allowRegistration: config.allowRegistration,
          emailVerificationRequired: config.emailVerificationRequired,
          requireInviteCode: config.requireInviteCode,
          autoReminderDispatchEnabled: config.autoReminderDispatchEnabled,
          reminderDispatchIntervalMinutes: config.reminderDispatchIntervalMinutes,
          trafficSyncEnabled: config.trafficSyncEnabled,
          trafficSyncIntervalSeconds: config.trafficSyncIntervalSeconds,
          networkInsightsEnabled: config.networkInsightsEnabled,
          subscriptionRiskEnabled: config.subscriptionRiskEnabled,
          subscriptionRiskAutoSuspend: config.subscriptionRiskAutoSuspend,
          subscriptionRiskWindowHours: config.subscriptionRiskWindowHours,
          subscriptionRiskCityWarning: config.subscriptionRiskCityWarning,
          subscriptionRiskCitySuspend: config.subscriptionRiskCitySuspend,
          subscriptionRiskRegionWarning: config.subscriptionRiskRegionWarning,
          subscriptionRiskRegionSuspend: config.subscriptionRiskRegionSuspend,
          subscriptionRiskCountryWarning: config.subscriptionRiskCountryWarning,
          subscriptionRiskCountrySuspend: config.subscriptionRiskCountrySuspend,
          subscriptionRiskIpLimitPerHour: config.subscriptionRiskIpLimitPerHour,
          subscriptionRiskTokenLimitPerHour: config.subscriptionRiskTokenLimitPerHour,
          nodeAccessRiskEnabled: config.nodeAccessRiskEnabled,
          nodeAccessConnectionWarning: config.nodeAccessConnectionWarning,
          nodeAccessConnectionSuspend: config.nodeAccessConnectionSuspend,
          nodeAccessUniqueTargetWarning: config.nodeAccessUniqueTargetWarning,
          nodeAccessUniqueTargetSuspend: config.nodeAccessUniqueTargetSuspend,
          inviteRewardEnabled: config.inviteRewardEnabled,
          inviteRewardRate: Number(config.inviteRewardRate),
          inviteRewardCouponId: config.inviteRewardCouponId,
          turnstileSiteKey: config.turnstileSiteKey,
          turnstileSecretConfigured: Boolean(config.turnstileSecretKey),
          smtpEnabled: config.smtpEnabled,
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          smtpSecure: config.smtpSecure,
          smtpUser: config.smtpUser,
          smtpFromName: config.smtpFromName,
          smtpFromEmail: config.smtpFromEmail,
        }}
        coupons={coupons}
      />
    </PageShell>
  );
}
