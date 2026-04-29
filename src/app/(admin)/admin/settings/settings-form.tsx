"use client";

import { useState } from "react";
import { Bell, Clock3, Gift, Mail, Send, Settings2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveAppSettings, testSmtpSettings } from "@/actions/admin/settings";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface AppConfig {
  siteName: string;
  siteUrl: string | null;
  supportContact: string | null;
  maintenanceNotice: string | null;
  siteNotice: string | null;
  allowRegistration: boolean;
  emailVerificationRequired: boolean;
  requireInviteCode: boolean;
  autoReminderDispatchEnabled: boolean;
  reminderDispatchIntervalMinutes: number;
  trafficSyncEnabled: boolean;
  trafficSyncIntervalSeconds: number;
  inviteRewardEnabled: boolean;
  inviteRewardRate: number;
  inviteRewardCouponId: string | null;
  turnstileSiteKey: string | null;
  turnstileSecretKey: string | null;
  smtpEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpFromName: string | null;
  smtpFromEmail: string | null;
}

interface CouponOption {
  id: string;
  code: string;
  name: string;
}

const selectClassName = "premium-input w-full appearance-none px-3.5 py-2 text-sm outline-none";

export function SettingsForm({ config, coupons }: { config: AppConfig; coupons: CouponOption[] }) {
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      const result = await saveAppSettings(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("设置已保存");
    } catch (error) {
      toast.error(getErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    const form = document.getElementById("app-settings-form") as HTMLFormElement | null;
    if (!form) return;

    setTestingEmail(true);
    try {
      const result = await testSmtpSettings(new FormData(form));
      if (!result.ok) {
        toast.error(
          result.settingsSaved
            ? `设置已保存，但测试邮件没有发出：${result.error}`
            : result.error,
        );
        return;
      }
      toast.success("设置已保存，测试邮件已发送");
    } catch (error) {
      toast.error(getErrorMessage(error, "测试邮件发送失败"));
    } finally {
      setTestingEmail(false);
    }
  }

  return (
    <form id="app-settings-form" action={handleSubmit} className="form-panel space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          <Settings2 className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">全局设置</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">把注册策略、自动化任务和公告内容集中配置，避免页面状态割裂。</p>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4 text-primary" /> 基础信息
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteName">站点名称</Label>
            <Input id="siteName" name="siteName" defaultValue={config.siteName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteUrl">站点域名 / URL</Label>
            <Input id="siteUrl" name="siteUrl" defaultValue={config.siteUrl ?? ""} placeholder="https://example.com" />
            <p className="text-xs leading-5 text-muted-foreground">用于订阅链接、支付回调和 Agent 一键安装命令，反代后建议填写公网域名。</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="supportContact">客服联系方式</Label>
            <Input id="supportContact" name="supportContact" defaultValue={config.supportContact ?? ""} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="size-4 text-primary" /> 自动化任务
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="autoReminderDispatchEnabled">自动提醒派发</Label>
            <select
              id="autoReminderDispatchEnabled"
              name="autoReminderDispatchEnabled"
              defaultValue={String(config.autoReminderDispatchEnabled)}
              className={selectClassName}
            >
              <option value="true">开启</option>
              <option value="false">关闭</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminderDispatchIntervalMinutes">提醒间隔（分钟）</Label>
            <Input id="reminderDispatchIntervalMinutes" name="reminderDispatchIntervalMinutes" type="number" min={1} defaultValue={config.reminderDispatchIntervalMinutes} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trafficSyncEnabled">3x-ui 流量定时同步</Label>
            <select
              id="trafficSyncEnabled"
              name="trafficSyncEnabled"
              defaultValue={String(config.trafficSyncEnabled)}
              className={selectClassName}
            >
              <option value="true">开启</option>
              <option value="false">关闭</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trafficSyncIntervalSeconds">流量同步间隔（秒）</Label>
            <Input
              id="trafficSyncIntervalSeconds"
              name="trafficSyncIntervalSeconds"
              type="number"
              min={10}
              step={1}
              defaultValue={config.trafficSyncIntervalSeconds}
              placeholder="60"
            />
            <p className="text-xs leading-5 text-muted-foreground">进程级后台定时任务，默认 60 秒；建议不要低于 10 秒。</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" /> 注册策略
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="allowRegistration">开放注册</Label>
            <select
              id="allowRegistration"
              name="allowRegistration"
              defaultValue={String(config.allowRegistration)}
              className={selectClassName}
            >
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="requireInviteCode">注册必须邀请码</Label>
            <select
              id="requireInviteCode"
              name="requireInviteCode"
              defaultValue={String(config.requireInviteCode)}
              className={selectClassName}
            >
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="emailVerificationRequired">注册邮箱验证</Label>
            <select
              id="emailVerificationRequired"
              name="emailVerificationRequired"
              defaultValue={String(config.emailVerificationRequired)}
              className={selectClassName}
            >
              <option value="false">关闭</option>
              <option value="true">开启，注册后必须验证邮箱</option>
            </select>
            <p className="text-xs leading-5 text-muted-foreground">开启后，新用户注册会先收到验证邮件，完成验证后才能登录。</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-primary" /> SMTP 邮件服务
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          用于注册邮箱验证、忘记密码和账户邮箱变更。密码留空会保留当前配置；测试会先保存当前 SMTP 设置，再发送测试邮件。
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="smtpEnabled">邮件服务</Label>
            <select id="smtpEnabled" name="smtpEnabled" defaultValue={String(config.smtpEnabled)} className={selectClassName}>
              <option value="false">关闭</option>
              <option value="true">开启</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP 主机</Label>
            <Input id="smtpHost" name="smtpHost" defaultValue={config.smtpHost ?? ""} placeholder="smtp.example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP 端口</Label>
            <Input id="smtpPort" name="smtpPort" type="number" min={1} max={65535} defaultValue={config.smtpPort} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpSecure">TLS / SSL</Label>
            <select id="smtpSecure" name="smtpSecure" defaultValue={String(config.smtpSecure)} className={selectClassName}>
              <option value="false">STARTTLS / 普通连接</option>
              <option value="true">SSL 直连</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpUser">SMTP 用户名</Label>
            <Input id="smtpUser" name="smtpUser" defaultValue={config.smtpUser ?? ""} autoComplete="username" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPassword">SMTP 密码</Label>
            <Input id="smtpPassword" name="smtpPassword" type="password" placeholder="留空保持不变" autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpFromName">发件名称</Label>
            <Input id="smtpFromName" name="smtpFromName" defaultValue={config.smtpFromName ?? ""} placeholder={config.siteName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpFromEmail">发件邮箱</Label>
            <Input id="smtpFromEmail" name="smtpFromEmail" type="email" defaultValue={config.smtpFromEmail ?? ""} placeholder="noreply@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpTestEmail">测试收件邮箱</Label>
            <div className="flex gap-2">
              <Input id="smtpTestEmail" name="smtpTestEmail" type="email" placeholder="you@example.com" />
              <Button type="button" variant="outline" onClick={handleTestEmail} disabled={testingEmail}>
                <Send className="size-4" />
                {testingEmail ? "发送中" : "测试"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="size-4 text-primary" /> 邀请奖励
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="inviteRewardEnabled">自动发放奖励</Label>
            <select
              id="inviteRewardEnabled"
              name="inviteRewardEnabled"
              defaultValue={String(config.inviteRewardEnabled)}
              className={selectClassName}
            >
              <option value="false">关闭</option>
              <option value="true">开启</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteRewardRate">返利比例（%）</Label>
            <Input id="inviteRewardRate" name="inviteRewardRate" type="number" min={0} max={100} step="0.01" defaultValue={config.inviteRewardRate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteRewardCouponId">自动发放优惠券</Label>
            <select
              id="inviteRewardCouponId"
              name="inviteRewardCouponId"
              defaultValue={config.inviteRewardCouponId ?? ""}
              className={selectClassName}
            >
              <option value="">不发放优惠券</option>
              {coupons.map((coupon) => (
                <option key={coupon.id} value={coupon.id}>
                  {coupon.name} · {coupon.code}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          被邀请用户完成首笔订单后，系统会为邀请人记录返利，并可自动把指定优惠券放入邀请人的券包。
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4 text-primary" /> Cloudflare Turnstile
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          为登录和注册页面添加人机验证。留空则不启用。
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="turnstileSiteKey">Site Key</Label>
            <Input id="turnstileSiteKey" name="turnstileSiteKey" defaultValue={config.turnstileSiteKey ?? ""} placeholder="0x4AAAAAAA..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="turnstileSecretKey">Secret Key</Label>
            <Input id="turnstileSecretKey" name="turnstileSecretKey" type="password" defaultValue={config.turnstileSecretKey ?? ""} placeholder="0x4AAAAAAA..." />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-primary" /> 公告内容
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteNotice">用户侧站点公告</Label>
            <Textarea id="siteNotice" name="siteNotice" rows={4} defaultValue={config.siteNotice ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenanceNotice">维护通知</Label>
            <Textarea id="maintenanceNotice" name="maintenanceNotice" rows={4} defaultValue={config.maintenanceNotice ?? ""} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "保存中..." : "保存设置"}
        </Button>
        <a href="/api/admin/export/config" className={buttonVariants({ variant: "outline", size: "lg" })}>
          导出配置备份
        </a>
      </div>
    </form>
  );
}
