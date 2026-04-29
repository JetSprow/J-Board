import type { SupportTicket } from "@prisma/client";
import Link from "next/link";
import { Eye, LifeBuoy } from "lucide-react";
import { DataTableShell } from "@/components/shared/data-table-shell";
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
import { UserSupportTicketActions } from "@/components/support/user-ticket-actions";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface UserSupportTicketTableProps {
  tickets: SupportTicket[];
}

export function UserSupportTicketTable({ tickets }: UserSupportTicketTableProps) {
  return (
    <DataTableShell
      isEmpty={tickets.length === 0}
      emptyTitle="还没有工单"
      emptyDescription="遇到支付、节点、流媒体或账户问题时，提交工单后会在这里跟进处理进度。"
      emptyIcon={<LifeBuoy className="size-5" />}
      emptyAction={
        <a href="#new-ticket" className={buttonVariants()}>
          提交第一张工单
        </a>
      }
    >
      <DataTable aria-label="我的工单列表" className="min-w-[760px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>标题</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>优先级</DataTableHeadCell>
            <DataTableHeadCell>更新时间</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {tickets.map((ticket) => (
            <DataTableRow key={ticket.id}>
              <DataTableCell>
                <Link href={`/support/${ticket.id}`} className="font-medium hover:underline">
                  {ticket.subject}
                </Link>
                {ticket.category && (
                  <p className="mt-1 text-xs text-muted-foreground">{ticket.category}</p>
                )}
              </DataTableCell>
              <DataTableCell>
                <SupportTicketStatusBadge status={ticket.status} />
              </DataTableCell>
              <DataTableCell>
                <SupportTicketPriorityBadge priority={ticket.priority} />
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                <time dateTime={ticket.updatedAt.toISOString()}>{formatDate(ticket.updatedAt)}</time>
              </DataTableCell>
              <DataTableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    href={`/support/${ticket.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Eye className="size-3.5" />
                    查看详情
                  </Link>
                  <UserSupportTicketActions ticketId={ticket.id} status={ticket.status} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
