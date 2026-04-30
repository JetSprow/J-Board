import Link from "next/link";
import type { SubscriptionRiskEvent } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { LogDeleteButton } from "@/components/admin/log-delete-button";
import {
  SubscriptionStatusBadge,
  SubscriptionTypeBadge,
  UserStatusBadge,
} from "@/components/shared/domain-badges";
import { EmptyState } from "@/components/shared/page-shell";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { SubscriptionRiskReviewActions } from "@/components/subscriptions/subscription-risk-review-actions";
import { formatDate, formatDateShort } from "@/lib/utils";
import { SubscriptionRiskGeoDetails } from "./subscription-risk-geo-details";
import type { SubscriptionRiskEventRow } from "../risk-data";

function kindLabel(kind: SubscriptionRiskEvent["kind"]) {
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
    case "COUNTRY_VARIANCE_WARNING":
      return "国家异常警告";
    case "COUNTRY_VARIANCE_SUSPEND":
      return "国家异常暂停";
    case "NODE_ACCESS_VOLUME_WARNING":
      return "节点高频警告";
    case "NODE_ACCESS_VOLUME_SUSPEND":
      return "节点高频暂停";
    case "NODE_ACCESS_TARGET_WARNING":
      return "目标分散警告";
    case "NODE_ACCESS_TARGET_SUSPEND":
      return "目标分散暂停";
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

function finalActionLabel(action: SubscriptionRiskEvent["finalAction"]) {
  switch (action) {
    case "RESTORE_ACCESS":
      return "已解除限制";
    case "KEEP_RESTRICTED":
      return "保持封禁/暂停";
    default:
      return null;
  }
}

function finalActionTone(action: SubscriptionRiskEvent["finalAction"]): StatusTone {
  if (action === "RESTORE_ACCESS") return "success";
  if (action === "KEEP_RESTRICTED") return "warning";
  return "neutral";
}

function MetricStrip({ events }: { events: SubscriptionRiskEventRow[] }) {
  const open = events.filter((event) => event.reviewStatus === "OPEN").length;
  const suspended = events.filter((event) => event.level === "SUSPENDED").length;
  const restricted = events.filter((event) => event.userRestrictionActive).length;
  const reports = events.filter((event) => event.reportSentAt).length;

  return (
    <section className="grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-4">
      {[
        ["本页待处理", open],
        ["已暂停事件", suspended],
        ["用户端限制", restricted],
        ["已发送报告", reports],
      ].map(([label, value]) => (
        <div key={label} className="bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-[-0.03em]">{value}</p>
        </div>
      ))}
    </section>
  );
}

function EventScope({ event }: { event: SubscriptionRiskEventRow }) {
  if (!event.subscription) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">{kindLabel(event.kind)}</StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">按用户总订阅统计，自动处置时会影响名下可暂停代理订阅。</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Link href={"/admin/subscriptions/" + event.subscription.id} className="break-words font-medium hover:underline">
        {event.subscription.plan.name}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <SubscriptionTypeBadge type={event.subscription.plan.type} />
        <SubscriptionStatusBadge status={event.subscription.status} />
      </div>
      <p className="text-xs text-muted-foreground">到期：{formatDateShort(event.subscription.endDate)}</p>
    </div>
  );
}

function UserBlock({ event }: { event: SubscriptionRiskEventRow }) {
  if (!event.user) {
    return <p className="text-sm text-muted-foreground">未知用户</p>;
  }

  return (
    <div className="space-y-2">
      <Link href={"/admin/users/" + event.user.id} className="block break-all font-medium hover:underline">
        {event.user.email}
      </Link>
      <p className="break-words text-xs text-muted-foreground">{event.user.name || "未设置昵称"}</p>
      <UserStatusBadge status={event.user.status} />
    </div>
  );
}

function ReviewState({ event }: { event: SubscriptionRiskEventRow }) {
  const finalLabel = finalActionLabel(event.finalAction);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={reviewStatusTone(event.reviewStatus)}>{reviewStatusLabel(event.reviewStatus)}</StatusBadge>
        {event.reportSentAt && <StatusBadge tone="info">已发送报告</StatusBadge>}
        {event.userRestrictionActive && <StatusBadge tone="danger">用户端限制中</StatusBadge>}
        {finalLabel && <StatusBadge tone={finalActionTone(event.finalAction)}>{finalLabel}</StatusBadge>}
      </div>

      {(event.reviewedByEmail || event.reviewNote) && (
        <div className="border-t border-border/60 pt-3 text-xs leading-5 text-muted-foreground">
          {event.reviewedByEmail && <p className="break-all">{event.reviewedByEmail}</p>}
          {event.reviewedAt && <p>{formatDate(event.reviewedAt)}</p>}
          {event.reviewNote && <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-foreground/70">{event.reviewNote}</p>}
        </div>
      )}
    </div>
  );
}

function RiskStat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="min-w-0 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5">
      <span className="block text-[0.68rem] leading-none text-muted-foreground">{label}</span>
      <span className="mt-1 block truncate font-mono text-sm font-semibold leading-none">{value}</span>
    </span>
  );
}

function RiskEventCard({ event }: { event: SubscriptionRiskEventRow }) {
  const summary = event.geoSummary;
  const userLabel = event.user?.email ?? "未知用户";
  const scopeLabel = event.subscription?.plan.name ?? "总订阅";

  return (
    <details className="surface-card group overflow-hidden rounded-xl">
      <summary className="flex cursor-pointer list-none items-start gap-4 p-4 text-left [&::-webkit-details-marker]:hidden sm:p-5">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={event.level === "SUSPENDED" ? "danger" : "warning"}>
              {reasonLabel(event.reason)}
            </StatusBadge>
            <StatusBadge tone="neutral">{kindLabel(event.kind)}</StatusBadge>
            <StatusBadge tone={reviewStatusTone(event.reviewStatus)}>{reviewStatusLabel(event.reviewStatus)}</StatusBadge>
            {event.userRestrictionActive && <StatusBadge tone="danger">用户端限制中</StatusBadge>}
            {event.reportSentAt && <StatusBadge tone="info">已发送报告</StatusBadge>}
            <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 space-y-1.5">
              <p className="line-clamp-2 text-sm font-semibold leading-6">{event.message}</p>
              <p className="truncate text-xs text-muted-foreground">
                {userLabel} · {scopeLabel} · 最近 IP：{event.ip || "未知 IP"}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-right sm:flex sm:justify-end">
              <RiskStat label="国家" value={summary.uniqueCountryCount} />
              <RiskStat label="省区" value={summary.uniqueRegionCount} />
              <RiskStat label="城市" value={summary.uniqueCityCount} />
              <RiskStat label="IP" value={summary.uniqueIpCount} />
            </div>
          </div>
        </div>

        <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          <span className="hidden sm:inline">详情</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="border-t border-border/70">
        <div className="grid xl:grid-cols-[minmax(0,0.85fr)_minmax(24rem,1.15fr)_minmax(18rem,0.7fr)]">
          <section className="space-y-5 p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">关联用户</p>
                <UserBlock event={event} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">影响范围</p>
                <EventScope event={event} />
              </div>
            </div>
          </section>

          <section className="border-y border-border/70 bg-muted/10 p-5 xl:border-x xl:border-y-0">
            <SubscriptionRiskGeoDetails summary={summary} />
          </section>

          <aside className="space-y-5 p-5">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">处理状态</p>
              <ReviewState event={event} />
            </div>
            <div className="border-t border-border/60 pt-4">
              <SubscriptionRiskReviewActions
                eventId={event.id}
                reviewStatus={event.reviewStatus}
                canRestoreSubscription={event.canRestoreSubscription}
                restorableSubscriptionCount={event.restorableSubscriptionCount}
                riskReport={event.riskReport}
                reportSentAt={event.reportSentAt}
                userRestrictionActive={event.userRestrictionActive}
                finalAction={event.finalAction}
              />
            </div>
            <div className="border-t border-border/60 pt-4">
              <LogDeleteButton
                id={event.id}
                target="SUBSCRIPTION_RISK_EVENTS"
                label="删除事件"
                title="删除这条风控事件？"
                description={
                  event.userRestrictionActive
                    ? "删除后无法恢复。此事件当前仍有用户端限制标记，请先确认是否需要在处理动作里解除限制。"
                    : "删除后无法恢复，只会移除这条风控事件，不会删除用户、订阅或访问日志。"
                }
                successMessage="风控事件已删除"
                className="w-full justify-center text-destructive hover:text-destructive"
                size="sm"
              />
            </div>
          </aside>
        </div>
      </div>
    </details>
  );
}

export function SubscriptionRiskTable({ events }: { events: SubscriptionRiskEventRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="暂无订阅风控事件"
        description="订阅链接或节点真实连接出现跨城市、跨省份或跨国家异常后，会在这里进入人工跟进队列。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <MetricStrip events={events} />
      <div className="space-y-4">
        {events.map((event) => (
          <RiskEventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
