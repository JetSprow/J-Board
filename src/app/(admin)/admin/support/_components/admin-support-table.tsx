import Link from "next/link";
import { Eye } from "lucide-react";
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
  SupportTicketPriorityBadge,
  SupportTicketStatusBadge,
} from "@/components/support/ticket-badges";
import { AdminSupportTicketActions } from "@/components/support/admin-ticket-actions";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { AdminSupportTicketRow } from "../support-data";

interface AdminSupportTableProps {
  tickets: AdminSupportTicketRow[];
}

export function AdminSupportTable({ tickets }: AdminSupportTableProps) {
  return (
    <DataTableShell
      isEmpty={tickets.length === 0}
      emptyTitle="暂无工单"
      emptyDescription="用户提交售后问题后，会显示在这里。"
    >
      <DataTable aria-label="后台工单列表" className="min-w-[860px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>标题</DataTableHeadCell>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>优先级</DataTableHeadCell>
            <DataTableHeadCell>回复数</DataTableHeadCell>
            <DataTableHeadCell>更新时间</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {tickets.map((ticket) => (
            <DataTableRow key={ticket.id}>
              <DataTableCell className="max-w-64 whitespace-normal break-words">
                <Link href={`/admin/support/${ticket.id}`} className="font-medium hover:underline">
                  {ticket.subject}
                </Link>
                {ticket.category && (
                  <p className="mt-1 text-xs text-muted-foreground">{ticket.category}</p>
                )}
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-all">{ticket.user.email}</DataTableCell>
              <DataTableCell>
                <SupportTicketStatusBadge status={ticket.status} />
              </DataTableCell>
              <DataTableCell>
                <SupportTicketPriorityBadge priority={ticket.priority} />
              </DataTableCell>
              <DataTableCell className="tabular-nums">{ticket._count.replies}</DataTableCell>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                <time dateTime={ticket.updatedAt.toISOString()}>{formatDate(ticket.updatedAt)}</time>
              </DataTableCell>
              <DataTableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    href={`/admin/support/${ticket.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Eye className="size-3.5" />
                    查看详情
                  </Link>
                  <AdminSupportTicketActions ticketId={ticket.id} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
