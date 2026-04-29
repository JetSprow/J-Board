import { updateSupportTicketMeta } from "@/actions/admin/support";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Label } from "@/components/ui/label";
import type { AdminSupportTicketDetail } from "../support-data";

export function SupportTicketMetaForm({ ticket }: { ticket: AdminSupportTicketDetail }) {
  return (
    <form
      action={updateSupportTicketMeta}
      className="surface-card flex flex-wrap items-end gap-3 rounded-xl p-4"
    >
      <input type="hidden" name="ticketId" value={ticket.id} />
      <div className="space-y-2">
        <Label htmlFor="status">状态</Label>
        <select
          id="status"
          name="status"
          defaultValue={ticket.status}
          className="h-11 px-3 text-sm outline-none"
        >
          <option value="OPEN">待处理</option>
          <option value="USER_REPLIED">用户已回复</option>
          <option value="ADMIN_REPLIED">管理员已回复</option>
          <option value="CLOSED">已关闭</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">优先级</Label>
        <select
          id="priority"
          name="priority"
          defaultValue={ticket.priority}
          className="h-11 px-3 text-sm outline-none"
        >
          <option value="LOW">低</option>
          <option value="NORMAL">普通</option>
          <option value="HIGH">高</option>
          <option value="URGENT">紧急</option>
        </select>
      </div>
      <PendingSubmitButton variant="outline" size="lg" pendingLabel="更新中...">更新状态</PendingSubmitButton>
    </form>
  );
}
