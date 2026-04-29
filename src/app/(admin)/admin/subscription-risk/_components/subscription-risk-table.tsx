import Link from "next/link";
import type { SubscriptionRiskEvent } from "@prisma/client";
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

function RiskEventCard({ event }: { event: SubscriptionRiskEventRow }) {
  return (
    <article className="surface-card overflow-hidden rounded-xl">
      <div className="grid xl:grid-cols-[minmax(0,0.9fr)_minmax(25rem,1.2fr)_minmax(18rem,0.65fr)]">
        <section className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={event.level === "SUSPENDED" ? "danger" : "warning"}>
              {reasonLabel(event.reason)}
            </StatusBadge>
            <StatusBadge tone="neutral">{kindLabel(event.kind)}</StatusBadge>
            <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold leading-6">{event.message}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">最近 IP：{event.ip || "未知 IP"}</p>
          </div>

          <div className="grid gap-4 border-t border-border/60 pt-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
          <SubscriptionRiskGeoDetails summary={event.geoSummary} />
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
        </aside>
      </div>
    </article>
  );
}

export function SubscriptionRiskTable({ events }: { events: SubscriptionRiskEventRow[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="暂无订阅风控事件"
        description="订阅链接出现跨城市、跨省份或跨国家访问异常后，会在这里进入人工跟进队列。"
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
