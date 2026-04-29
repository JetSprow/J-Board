import Link from "next/link";
import type { SubscriptionRiskEvent } from "@prisma/client";
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
import { SubscriptionRiskReviewActions } from "@/components/subscriptions/subscription-risk-review-actions";
import { formatDate, formatDateShort } from "@/lib/utils";
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

function EventScope({ event }: { event: SubscriptionRiskEventRow }) {
  if (!event.subscription) {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="info">{kindLabel(event.kind)}</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">按用户总订阅统计</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link href={`/admin/subscriptions/${event.subscription.id}`} className="font-medium hover:underline">
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

function UserCell({ event }: { event: SubscriptionRiskEventRow }) {
  if (!event.user) {
    return <span className="text-muted-foreground">未知用户</span>;
  }

  return (
    <div className="space-y-1">
      <p className="max-w-56 break-all font-medium">{event.user.email}</p>
      <p className="max-w-52 break-words text-xs text-muted-foreground">{event.user.name || "未设置昵称"}</p>
      <UserStatusBadge status={event.user.status} />
    </div>
  );
}

export function SubscriptionRiskTable({ events }: { events: SubscriptionRiskEventRow[] }) {
  return (
    <DataTableShell
      isEmpty={events.length === 0}
      emptyTitle="暂无订阅风控事件"
      emptyDescription="订阅链接出现跨城市或跨省份访问异常后，会在这里进入人工跟进队列。"
    >
      <DataTable aria-label="订阅风控事件" className="min-w-[1180px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>时间</DataTableHeadCell>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>范围</DataTableHeadCell>
            <DataTableHeadCell>判定</DataTableHeadCell>
            <DataTableHeadCell>地区/IP</DataTableHeadCell>
            <DataTableHeadCell>处理状态</DataTableHeadCell>
            <DataTableHeadCell className="text-right">人工处理</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {events.map((event) => (
            <DataTableRow key={event.id}>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(event.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <UserCell event={event} />
              </DataTableCell>
              <DataTableCell>
                <EventScope event={event} />
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-2">
                  <StatusBadge tone={event.level === "SUSPENDED" ? "danger" : "warning"}>
                    {reasonLabel(event.reason)}
                  </StatusBadge>
                  <p className="max-w-sm text-xs leading-5 text-muted-foreground">{event.message}</p>
                </div>
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-1 text-sm">
                  <p className="font-mono text-xs">{event.ip || "未知 IP"}</p>
                  <p className="text-xs text-muted-foreground">
                    城市 {event.cityCount} · 省/地区 {event.regionCount} · 国家 {event.countryCount}
                  </p>
                </div>
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-2">
                  <StatusBadge tone={reviewStatusTone(event.reviewStatus)}>
                    {reviewStatusLabel(event.reviewStatus)}
                  </StatusBadge>
                  {(event.reviewedByEmail || event.reviewNote) && (
                    <div className="max-w-52 text-xs leading-5 text-muted-foreground">
                      {event.reviewedByEmail && <p className="break-all">{event.reviewedByEmail}</p>}
                      {event.reviewedAt && <p>{formatDate(event.reviewedAt)}</p>}
                      {event.reviewNote && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-foreground/70">{event.reviewNote}</p>}
                    </div>
                  )}
                </div>
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <SubscriptionRiskReviewActions
                    eventId={event.id}
                    reviewStatus={event.reviewStatus}
                    canRestoreSubscription={event.canRestoreSubscription}
                  />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
