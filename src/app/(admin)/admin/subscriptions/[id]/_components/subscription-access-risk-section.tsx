import Link from "next/link";
import type {
  SubscriptionAccessLog,
  SubscriptionRiskEvent,
  SubscriptionStatus,
  SubscriptionType,
  UserStatus,
} from "@prisma/client";
import { AlertTriangle, ShieldCheck, UserRound } from "lucide-react";
import { DataTableShell } from "@/components/admin/data-table-shell";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/shared/data-table";
import {
  SubscriptionStatusBadge,
  SubscriptionTypeBadge,
  UserStatusBadge,
} from "@/components/shared/domain-badges";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { SubscriptionRiskReviewActions } from "@/components/subscriptions/subscription-risk-review-actions";
import { formatDate, formatDateShort } from "@/lib/utils";

interface RiskOwner {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
}

interface RiskSubscription {
  id: string;
  status: SubscriptionStatus;
  endDate: Date;
  plan: {
    name: string;
    type: SubscriptionType;
  };
}

function formatLocation(item: Pick<SubscriptionAccessLog, "country" | "region" | "regionCode" | "city">) {
  const parts = [item.country, item.region || item.regionCode, item.city].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "未知";
}

function kindLabel(kind: SubscriptionAccessLog["kind"] | SubscriptionRiskEvent["kind"]) {
  return kind === "AGGREGATE" ? "总订阅" : "单订阅";
}

function reasonLabel(reason: SubscriptionRiskEvent["reason"]) {
  switch (reason) {
    case "CITY_VARIANCE_WARNING":
      return "城市异常警告";
    case "CITY_VARIANCE_SUSPEND":
      return "城市异常暂停";
    case "REGION_VARIANCE_WARNING":
      return "省/地区异常警告";
    case "REGION_VARIANCE_SUSPEND":
      return "省/地区异常暂停";
  }
}

function reviewStatusLabel(status: SubscriptionRiskEvent["reviewStatus"]) {
  switch (status) {
    case "OPEN":
      return "待处理";
    case "ACKNOWLEDGED":
      return "已确认";
    case "RESOLVED":
      return "已解决";
  }
}

function reviewStatusTone(status: SubscriptionRiskEvent["reviewStatus"]): StatusTone {
  if (status === "RESOLVED") return "success";
  if (status === "ACKNOWLEDGED") return "info";
  return "warning";
}

function canRestoreFromEvent(event: SubscriptionRiskEvent, subscription: RiskSubscription) {
  return event.subscriptionId === subscription.id
    && subscription.status === "SUSPENDED"
    && subscription.endDate > new Date();
}

export function SubscriptionAccessRiskSection({
  accessLogs,
  riskEvents,
  owner,
  subscription,
}: {
  accessLogs: SubscriptionAccessLog[];
  riskEvents: SubscriptionRiskEvent[];
  owner: RiskOwner;
  subscription: RiskSubscription;
}) {
  return (
    <section className="surface-card space-y-5 rounded-xl p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em]">订阅访问风控</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">记录订阅拉取 IP、地区变化和人工处理状态。</p>
          </div>
        </div>
        <Link href="/admin/subscription-risk" className={buttonVariants({ variant: "outline", size: "sm" })}>
          查看全部风控
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <UserRound className="size-4 text-primary" />
            关联用户
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all font-medium">{owner.email}</span>
              <UserStatusBadge status={owner.status} />
            </div>
            <p className="text-muted-foreground">{owner.name || "未设置昵称"}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{owner.id}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-primary" />
            当前订阅
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{subscription.plan.name}</span>
              <SubscriptionTypeBadge type={subscription.plan.type} />
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <p className="text-muted-foreground">到期：{formatDateShort(subscription.endDate)}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{subscription.id}</p>
          </div>
        </div>
      </div>

      {riskEvents.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/25 bg-amber-500/8 p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4" /> 最近风控事件
          </div>
          <div className="grid gap-2">
            {riskEvents.map((event) => (
              <div key={event.id} className="rounded-md border border-border/50 bg-background/55 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={event.level === "SUSPENDED" ? "danger" : "warning"}>{reasonLabel(event.reason)}</StatusBadge>
                  <StatusBadge tone={reviewStatusTone(event.reviewStatus)}>{reviewStatusLabel(event.reviewStatus)}</StatusBadge>
                  <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)} · {kindLabel(event.kind)}</span>
                </div>
                <p className="text-sm leading-6 text-foreground/85">{event.message}</p>
                {(event.reviewedByEmail || event.reviewNote) && (
                  <div className="mt-2 rounded-md bg-muted/45 p-2 text-xs leading-5 text-muted-foreground">
                    {event.reviewedByEmail && <p>处理人：{event.reviewedByEmail}{event.reviewedAt ? ` · ${formatDate(event.reviewedAt)}` : ""}</p>}
                    {event.reviewNote && <p className="mt-1 whitespace-pre-wrap text-foreground/75">{event.reviewNote}</p>}
                  </div>
                )}
                <div className="mt-3">
                  <SubscriptionRiskReviewActions
                    eventId={event.id}
                    reviewStatus={event.reviewStatus}
                    canRestoreSubscription={canRestoreFromEvent(event, subscription)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTableShell
        isEmpty={accessLogs.length === 0}
        emptyTitle="暂无订阅访问记录"
        emptyDescription="用户客户端拉取订阅后，这里会显示最近访问 IP 与地区。"
      >
        <DataTable aria-label="订阅访问记录" className="min-w-[980px]">
          <DataTableHead>
            <DataTableHeaderRow>
              <DataTableHeadCell>时间</DataTableHeadCell>
              <DataTableHeadCell>类型</DataTableHeadCell>
              <DataTableHeadCell>IP</DataTableHeadCell>
              <DataTableHeadCell>地区</DataTableHeadCell>
              <DataTableHeadCell>结果</DataTableHeadCell>
              <DataTableHeadCell>User-Agent</DataTableHeadCell>
            </DataTableHeaderRow>
          </DataTableHead>
          <DataTableBody>
            {accessLogs.map((log) => (
              <DataTableRow key={log.id}>
                <DataTableCell className="text-muted-foreground">{formatDate(log.createdAt)}</DataTableCell>
                <DataTableCell>{kindLabel(log.kind)}</DataTableCell>
                <DataTableCell className="font-mono text-xs">{log.ip}</DataTableCell>
                <DataTableCell>{formatLocation(log)}</DataTableCell>
                <DataTableCell>
                  <StatusBadge tone={log.allowed ? "success" : "warning"}>
                    {log.allowed ? "已放行" : log.reason || "已拦截"}
                  </StatusBadge>
                </DataTableCell>
                <DataTableCell className="max-w-sm truncate text-muted-foreground">
                  {log.userAgent || "—"}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableShell>
    </section>
  );
}
