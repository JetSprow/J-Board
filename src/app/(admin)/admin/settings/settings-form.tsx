"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Clock3, Gift, LifeBuoy, Mail, RadioTower, Send, Settings2, ShieldAlert, ShieldCheck } from "lucide-react";
import { BooleanToggle } from "@/components/ui/boolean-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveAppSettings,
  saveBooleanAppSetting,
  testSmtpSettings,
  type BooleanSettingField,
} from "@/actions/admin/settings";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

interface AppConfig {
  siteName: string;
  siteUrl: string | null;
  subscriptionUrl: string | null;
  supportContact: string | null;
  supportOpenTicketLimit: number;
  maintenanceNotice: string | null;
  siteNotice: string | null;
  allowRegistration: boolean;
  emailVerificationRequired: boolean;
  requireInviteCode: boolean;
  autoReminderDispatchEnabled: boolean;
  reminderDispatchIntervalMinutes: number;
  trafficSyncEnabled: boolean;
  trafficSyncIntervalSeconds: number;
  networkRecommendationsEnabled: boolean;
  networkInsightsEnabled: boolean;
  subscriptionRiskEnabled: boolean;
  subscriptionRiskAutoSuspend: boolean;
  subscriptionRiskWindowHours: number;
  subscriptionRiskCityWarning: number;
  subscriptionRiskCitySuspend: number;
  subscriptionRiskRegionWarning: number;
  subscriptionRiskRegionSuspend: number;
  subscriptionRiskCountryWarning: number;
  subscriptionRiskCountrySuspend: number;
  subscriptionRiskIpLimitPerHour: number;
  subscriptionRiskTokenLimitPerHour: number;
  nodeAccessRiskEnabled: boolean;
  nodeAccessConnectionWarning: number;
  nodeAccessConnectionSuspend: number;
  nodeAccessUniqueTargetWarning: number;
  nodeAccessUniqueTargetSuspend: number;
  inviteRewardEnabled: boolean;
  inviteRewardRate: number;
  inviteRewardCouponId: string | null;
  turnstileSiteKey: string | null;
  turnstileSecretConfigured: boolean;
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

type ToggleValues = Record<BooleanSettingField, boolean>;

const booleanSettingLabels: Record<BooleanSettingField, string> = {
  allowRegistration: "开放注册",
  emailVerificationRequired: "注册邮箱验证",
  requireInviteCode: "邀请码注册",
  autoReminderDispatchEnabled: "自动提醒派发",
  trafficSyncEnabled: "3x-ui 流量定时同步",
  networkRecommendationsEnabled: "三网推荐",
  networkInsightsEnabled: "线路体验",
  subscriptionRiskEnabled: "风控总控",
  subscriptionRiskAutoSuspend: "自动暂停",
  nodeAccessRiskEnabled: "节点日志风控",
  inviteRewardEnabled: "自动发放奖励",
  smtpEnabled: "邮件服务",
  smtpSecure: "SSL 直连",
};

function initialToggleValues(config: AppConfig): ToggleValues {
  return {
    allowRegistration: config.allowRegistration,
    emailVerificationRequired: config.emailVerificationRequired,
    requireInviteCode: config.requireInviteCode,
    autoReminderDispatchEnabled: config.autoReminderDispatchEnabled,
    trafficSyncEnabled: config.trafficSyncEnabled,
    networkRecommendationsEnabled: config.networkRecommendationsEnabled,
    networkInsightsEnabled: config.networkInsightsEnabled,
    subscriptionRiskEnabled: config.subscriptionRiskEnabled,
    subscriptionRiskAutoSuspend: config.subscriptionRiskAutoSuspend,
    nodeAccessRiskEnabled: config.nodeAccessRiskEnabled,
    inviteRewardEnabled: config.inviteRewardEnabled,
    smtpEnabled: config.smtpEnabled,
    smtpSecure: config.smtpSecure,
  };
}

export function SettingsForm({ config, coupons }: { config: AppConfig; coupons: CouponOption[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [riskSettingsOpen, setRiskSettingsOpen] = useState(false);
  const [toggleValues, setToggleValues] = useState<ToggleValues>(() => initialToggleValues(config));
  const [pendingToggles, setPendingToggles] = useState<Partial<Record<BooleanSettingField, boolean>>>({});
  const hasPendingToggle = Object.values(pendingToggles).some(Boolean);

  function setToggleValue(field: BooleanSettingField, value: boolean) {
    setToggleValues((current) => ({ ...current, [field]: value }));
  }

  function setTogglePending(field: BooleanSettingField, pending: boolean) {
    setPendingToggles((current) => {
      const next = { ...current };
      if (pending) {
        next[field] = true;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  async function handleImmediateToggle(field: BooleanSettingField, value: boolean) {
    if (pendingToggles[field] || toggleValues[field] === value) return;

    const previousValue = toggleValues[field];
    const label = booleanSettingLabels[field];
    const actionLabel = value ? "开启" : "关闭";
    setToggleValue(field, value);
    setTogglePending(field, true);

    try {
      const result = await saveBooleanAppSetting({ field, value });
      if (!result.ok) {
        setToggleValue(field, previousValue);
        toast.error(`${label}${actionLabel}失败：${getErrorMessage(result.error, "更新失败")}`);
        return;
      }
      router.refresh();
      toast.success(`${label}${actionLabel}成功`);
    } catch (error) {
      setToggleValue(field, previousValue);
      toast.error(`${label}${actionLabel}失败：${getErrorMessage(error, "更新失败")}`);
    } finally {
      setTogglePending(field, false);
    }
  }

  function renderImmediateToggle(
    field: BooleanSettingField,
    options: {
      id: string;
      trueLabel?: string;
      falseLabel?: string;
      ariaLabel?: string;
    },
  ) {
    return (
      <BooleanToggle
        id={options.id}
        name={field}
        value={toggleValues[field]}
        onChange={(value) => void handleImmediateToggle(field, value)}
        trueLabel={options.trueLabel}
        falseLabel={options.falseLabel}
        ariaLabel={options.ariaLabel ?? booleanSettingLabels[field]}
        disabled={saving || Boolean(pendingToggles[field])}
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || hasPendingToggle) return;

    const form = event.currentTarget;
    setSaving(true);
    try {
      const result = await saveAppSettings(new FormData(form));
      if (!result.ok) {
        toast.error(getErrorMessage(result.error, "保存设置失败"));
        return;
      }
      clearPasswordField(form);
      router.refresh();
      toast.success("设置已保存");
    } catch (error) {
      toast.error(getErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (testingEmail) return;

    const form = document.getElementById("app-settings-form") as HTMLFormElement | null;
    if (!form) return;

    setTestingEmail(true);
    try {
      const result = await testSmtpSettings(new FormData(form));
      if (!result.ok) {
        if (result.settingsSaved) {
          clearPasswordField(form);
          router.refresh();
        }
        toast.error(
          result.settingsSaved
            ? `设置已保存，但测试邮件没有发出：${getErrorMessage(result.error, "测试邮件发送失败")}`
            : getErrorMessage(result.error, "测试邮件发送失败"),
        );
        return;
      }
      clearPasswordField(form);
      router.refresh();
      toast.success("设置已保存，测试邮件已发送");
    } catch (error) {
      toast.error(getErrorMessage(error, "测试邮件发送失败"));
    } finally {
      setTestingEmail(false);
    }
  }

  function clearPasswordField(form: HTMLFormElement) {
    const password = form.elements.namedItem("smtpPassword");
    if (password instanceof HTMLInputElement) {
      password.value = "";
    }

    const turnstileSecret = form.elements.namedItem("turnstileSecretKey");
    if (turnstileSecret instanceof HTMLInputElement) {
      turnstileSecret.value = "";
    }
  }

  return (
    <form id="app-settings-form" onSubmit={handleSubmit} className="form-panel space-y-6">
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
            <Label htmlFor="siteUrl">网站 URL</Label>
            <Input id="siteUrl" name="siteUrl" defaultValue={config.siteUrl ?? ""} placeholder="https://panel.example.com" />
            <p className="text-xs leading-5 text-muted-foreground">用于登录、邮件链接、支付回跳和 Agent 安装命令。请填写准备反代到面板的公网域名。</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="subscriptionUrl">订阅 URL</Label>
            <Input id="subscriptionUrl" name="subscriptionUrl" defaultValue={config.subscriptionUrl ?? ""} placeholder="https://sub.example.com" />
            <p className="text-xs leading-5 text-muted-foreground">只用于生成客户端订阅链接。可与网站 URL 相同，也可单独使用 sub 域名，便于 Cloudflare/WAF 和访问风控独立配置。</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="supportContact">客服联系方式</Label>
            <Input id="supportContact" name="supportContact" defaultValue={config.supportContact ?? ""} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <LifeBuoy className="size-4 text-primary" /> 工单售后
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="supportOpenTicketLimit">未关闭工单上限</Label>
            <Input
              id="supportOpenTicketLimit"
              name="supportOpenTicketLimit"
              type="number"
              min={1}
              max={20}
              step={1}
              defaultValue={config.supportOpenTicketLimit}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              用户最多可同时保留的未关闭工单，默认 2；关闭后可再次创建。
            </p>
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
            {renderImmediateToggle("autoReminderDispatchEnabled", { id: "autoReminderDispatchEnabled" })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reminderDispatchIntervalMinutes">提醒间隔（分钟）</Label>
            <Input id="reminderDispatchIntervalMinutes" name="reminderDispatchIntervalMinutes" type="number" min={1} defaultValue={config.reminderDispatchIntervalMinutes} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trafficSyncEnabled">3x-ui 流量定时同步</Label>
            {renderImmediateToggle("trafficSyncEnabled", { id: "trafficSyncEnabled" })}
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
          <RadioTower className="size-4 text-primary" /> 商城线路展示
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="networkRecommendationsEnabled">三网推荐</Label>
            {renderImmediateToggle("networkRecommendationsEnabled", { id: "networkRecommendationsEnabled" })}
            <p className="text-xs leading-5 text-muted-foreground">
              开启后，商城展示电信、联通、移动当前最低延迟推荐；点击推荐会直接打开对应套餐详情。
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="networkInsightsEnabled">线路体验</Label>
            {renderImmediateToggle("networkInsightsEnabled", { id: "networkInsightsEnabled" })}
            <p className="text-xs leading-5 text-muted-foreground">
              开启后，套餐详情展示节点延迟、趋势和访问路径；关闭后只保留购买所需的线路入口选择。
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <button
          type="button"
          aria-expanded={riskSettingsOpen}
          aria-controls="subscription-risk-settings"
          onClick={() => setRiskSettingsOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 rounded-md text-left outline-none transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/15"
        >
          <span className="flex min-w-0 items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">订阅访问风控</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                控制订阅接口限流、跨地区访问告警和自动暂停，当前{toggleValues.subscriptionRiskEnabled ? "已开启" : "已关闭"}。
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
            {riskSettingsOpen ? "收起" : "展开"}
            <ChevronDown className={`size-4 transition-transform ${riskSettingsOpen ? "rotate-180" : ""}`} />
          </span>
        </button>

        {riskSettingsOpen && (
          <div id="subscription-risk-settings" className="space-y-4">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskEnabled">风控总控</Label>
                {renderImmediateToggle("subscriptionRiskEnabled", { id: "subscriptionRiskEnabled" })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskAutoSuspend">自动暂停</Label>
                {renderImmediateToggle("subscriptionRiskAutoSuspend", {
                  id: "subscriptionRiskAutoSuspend",
                  trueLabel: "开启自动封停",
                  falseLabel: "只记录警告",
                  ariaLabel: "自动暂停",
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskWindowHours">统计窗口（小时）</Label>
                <Input
                  id="subscriptionRiskWindowHours"
                  name="subscriptionRiskWindowHours"
                  type="number"
                  min={1}
                  max={168}
                  defaultValue={config.subscriptionRiskWindowHours}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskCityWarning">城市警告阈值</Label>
                <Input
                  id="subscriptionRiskCityWarning"
                  name="subscriptionRiskCityWarning"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={config.subscriptionRiskCityWarning}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskCitySuspend">城市暂停阈值</Label>
                <Input
                  id="subscriptionRiskCitySuspend"
                  name="subscriptionRiskCitySuspend"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={config.subscriptionRiskCitySuspend}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskRegionWarning">省/地区警告阈值</Label>
                <Input
                  id="subscriptionRiskRegionWarning"
                  name="subscriptionRiskRegionWarning"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={config.subscriptionRiskRegionWarning}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskRegionSuspend">省/地区暂停阈值</Label>
                <Input
                  id="subscriptionRiskRegionSuspend"
                  name="subscriptionRiskRegionSuspend"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={config.subscriptionRiskRegionSuspend}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskCountryWarning">国家警告阈值</Label>
                <Input
                  id="subscriptionRiskCountryWarning"
                  name="subscriptionRiskCountryWarning"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={config.subscriptionRiskCountryWarning}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskCountrySuspend">国家暂停阈值</Label>
                <Input
                  id="subscriptionRiskCountrySuspend"
                  name="subscriptionRiskCountrySuspend"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={config.subscriptionRiskCountrySuspend}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskIpLimitPerHour">IP 限流（次/小时）</Label>
                <Input
                  id="subscriptionRiskIpLimitPerHour"
                  name="subscriptionRiskIpLimitPerHour"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={config.subscriptionRiskIpLimitPerHour}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionRiskTokenLimitPerHour">订阅限流（次/小时）</Label>
                <Input
                  id="subscriptionRiskTokenLimitPerHour"
                  name="subscriptionRiskTokenLimitPerHour"
                  type="number"
                  min={1}
                  max={100000}
                  defaultValue={config.subscriptionRiskTokenLimitPerHour}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nodeAccessRiskEnabled">节点日志风控</Label>
                {renderImmediateToggle("nodeAccessRiskEnabled", {
                  id: "nodeAccessRiskEnabled",
                  trueLabel: "接收日志",
                  falseLabel: "仅订阅风控",
                  ariaLabel: "节点日志风控",
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nodeAccessConnectionWarning">节点连接警告阈值</Label>
                <Input id="nodeAccessConnectionWarning" name="nodeAccessConnectionWarning" type="number" min={1} max={100000} defaultValue={config.nodeAccessConnectionWarning} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nodeAccessConnectionSuspend">节点连接暂停阈值</Label>
                <Input id="nodeAccessConnectionSuspend" name="nodeAccessConnectionSuspend" type="number" min={1} max={100000} defaultValue={config.nodeAccessConnectionSuspend} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nodeAccessUniqueTargetWarning">不同目标警告阈值</Label>
                <Input id="nodeAccessUniqueTargetWarning" name="nodeAccessUniqueTargetWarning" type="number" min={1} max={100000} defaultValue={config.nodeAccessUniqueTargetWarning} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nodeAccessUniqueTargetSuspend">不同目标暂停阈值</Label>
                <Input id="nodeAccessUniqueTargetSuspend" name="nodeAccessUniqueTargetSuspend" type="number" min={1} max={100000} defaultValue={config.nodeAccessUniqueTargetSuspend} />
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              默认值对应原规则：24 小时内 4 城市警告、5 城市暂停；2 省/地区警告、3 省/地区暂停；2 国家警告、3 国家暂停；IP 180 次/小时，订阅 60 次/小时。节点日志风控只在 Agent 配置 XRAY_ACCESS_LOG_PATH 后生效；连接数和不同目标数按 Agent 单次聚合窗口计算。
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" /> 注册策略
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="allowRegistration">开放注册</Label>
            {renderImmediateToggle("allowRegistration", {
              id: "allowRegistration",
              trueLabel: "开放",
              falseLabel: "关闭",
              ariaLabel: "开放注册",
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="requireInviteCode">注册必须邀请码</Label>
            {renderImmediateToggle("requireInviteCode", {
              id: "requireInviteCode",
              trueLabel: "必须",
              falseLabel: "不需要",
              ariaLabel: "注册必须邀请码",
            })}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="emailVerificationRequired">注册邮箱验证</Label>
            {renderImmediateToggle("emailVerificationRequired", {
              id: "emailVerificationRequired",
              trueLabel: "开启验证",
              falseLabel: "关闭",
              ariaLabel: "注册邮箱验证",
            })}
            <p className="text-xs leading-5 text-muted-foreground">开启后，新用户注册会先收到验证邮件，完成验证后才能登录；关闭后注册成功即可登录。</p>
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
            {renderImmediateToggle("smtpEnabled", { id: "smtpEnabled" })}
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
            {renderImmediateToggle("smtpSecure", {
              id: "smtpSecure",
              trueLabel: "SSL 直连",
              falseLabel: "STARTTLS",
              ariaLabel: "TLS / SSL",
            })}
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
            {renderImmediateToggle("inviteRewardEnabled", { id: "inviteRewardEnabled" })}
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
            <Input
              id="turnstileSecretKey"
              name="turnstileSecretKey"
              type="password"
              placeholder={config.turnstileSecretConfigured ? "留空保持不变" : "0x4AAAAAAA..."}
              autoComplete="new-password"
            />
            {config.turnstileSecretConfigured && (
              <p className="text-xs leading-5 text-muted-foreground">Secret Key 已配置；留空保持不变。清空 Site Key 后保存可停用 Turnstile。</p>
            )}
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
        <Button type="submit" size="lg" disabled={saving || hasPendingToggle}>
          {saving ? "保存中..." : hasPendingToggle ? "开关更新中..." : "保存设置"}
        </Button>
        <a href="/api/admin/export/config" className={buttonVariants({ variant: "outline", size: "lg" })}>
          导出配置备份
        </a>
      </div>
    </form>
  );
}
