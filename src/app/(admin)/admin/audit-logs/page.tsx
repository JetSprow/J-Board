import type { Metadata } from "next";
import { Download } from "lucide-react";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { AuditLogsTable } from "./_components/audit-logs-table";
import { buildAuditLogExportHref, getAuditLogs } from "./audit-logs-data";

export const metadata: Metadata = {
  title: "审计日志",
  description: "查询关键后台操作记录并支持日志导出。",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { logs, total, page, pageSize, filters } = await getAuditLogs(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="系统"
        title="审计日志"
        actions={
          <a
            href={buildAuditLogExportHref(filters)}
            className={buttonVariants({ variant: "outline" })}
          >
            <Download className="size-4" />
            导出日志
          </a>
        }
      />

      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索动作、目标、操作者、说明"
        selects={[
          {
            name: "action",
            value: filters.action,
            options: [
              { label: "全部动作前缀", value: "" },
              { label: "user.", value: "user." },
              { label: "order.", value: "order." },
              { label: "subscription.", value: "subscription." },
              { label: "plan.", value: "plan." },
              { label: "service.", value: "service." },
              { label: "node.", value: "node." },
              { label: "task.", value: "task." },
              { label: "risk.", value: "risk." },
            ],
          },
        ]}
      />

      <AuditLogsTable logs={logs} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
