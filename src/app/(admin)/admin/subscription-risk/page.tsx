import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { SubscriptionRiskTable } from "./_components/subscription-risk-table";
import { getSubscriptionRiskEvents } from "./risk-data";

export const metadata: Metadata = {
  title: "订阅风控",
  description: "查看订阅访问异常、关联用户和人工处理状态。",
};

export default async function AdminSubscriptionRiskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { events, total, page, pageSize, filters } = await getSubscriptionRiskEvents(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="商品与订单"
        title="订阅风控"
        description="订阅链接跨城市或跨省份访问异常后，会进入这里供管理员确认、备注、恢复或继续处置。"
      />

      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索用户邮箱、昵称、套餐、IP、事件说明"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部处理状态", value: "" },
              { label: "待处理", value: "OPEN" },
              { label: "已确认", value: "ACKNOWLEDGED" },
              { label: "已解决", value: "RESOLVED" },
            ],
          },
          {
            name: "level",
            value: filters.level,
            options: [
              { label: "全部风险级别", value: "" },
              { label: "警告", value: "WARNING" },
              { label: "已暂停", value: "SUSPENDED" },
            ],
          },
          {
            name: "kind",
            value: filters.kind,
            options: [
              { label: "全部订阅范围", value: "" },
              { label: "单订阅", value: "SINGLE" },
              { label: "总订阅", value: "AGGREGATE" },
            ],
          },
        ]}
      />

      <SubscriptionRiskTable events={events} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
