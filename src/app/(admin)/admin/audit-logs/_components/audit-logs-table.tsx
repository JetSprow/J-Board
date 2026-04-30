import type { AuditLog } from "@prisma/client";
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
  formatAuditAction,
  formatAuditActorRole,
  formatAuditMessage,
  formatAuditTargetLabel,
  formatAuditTargetType,
} from "@/lib/audit-display";
import { LogDeleteButton } from "@/components/admin/log-delete-button";
import { formatDate } from "@/lib/utils";

export function AuditLogsTable({ logs }: { logs: AuditLog[] }) {
  return (
    <DataTableShell
      isEmpty={logs.length === 0}
      emptyTitle="暂无审计日志"
      emptyDescription="后台关键操作发生后，会记录在这里。"
    >
      <DataTable aria-label="审计日志列表" className="min-w-[980px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>时间</DataTableHeadCell>
            <DataTableHeadCell>操作者</DataTableHeadCell>
            <DataTableHeadCell>动作</DataTableHeadCell>
            <DataTableHeadCell>目标</DataTableHeadCell>
            <DataTableHeadCell>说明</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {logs.map((log) => (
            <DataTableRow key={log.id}>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(log.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-1">
                  <p>{log.actorEmail || "系统"}</p>
                  <p className="text-xs text-muted-foreground">{formatAuditActorRole(log.actorRole)}</p>
                </div>
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap font-medium">
                {formatAuditAction(log.action)}
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-1">
                  <p>{formatAuditTargetType(log.targetType)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAuditTargetLabel(log)}
                  </p>
                </div>
              </DataTableCell>
              <DataTableCell className="max-w-xl whitespace-pre-wrap break-words text-muted-foreground">
                {formatAuditMessage(log.message)}
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <LogDeleteButton
                    id={log.id}
                    target="AUDIT_LOGS"
                    title="删除这条审计日志？"
                    description="删除后无法恢复。系统会记录一条新的删除审计，用于保留后台操作痕迹。"
                    successMessage="审计日志已删除"
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
