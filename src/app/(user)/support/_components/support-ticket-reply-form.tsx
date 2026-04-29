import { Paperclip, Send } from "lucide-react";
import { replySupportTicket } from "@/actions/user/support";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_ATTACHMENT_ACCEPT } from "@/services/support";

interface SupportTicketReplyFormProps {
  ticketId: string;
}

export function SupportTicketReplyForm({ ticketId }: SupportTicketReplyFormProps) {
  async function submitReply(formData: FormData) {
    "use server";
    await replySupportTicket(ticketId, formData);
  }

  return (
    <form action={submitReply} className="form-panel space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          <Send className="size-4" />
        </span>
        <div>
          <h3 className="font-heading text-lg font-semibold tracking-tight">继续回复</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">补充问题、上传截图，客服会在同一个工单内继续跟进。</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">回复内容</Label>
        <Textarea id="body" name="body" rows={4} placeholder="继续补充问题或回复客服团队" required />
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
        <Label htmlFor="reply-attachments" className="inline-flex items-center gap-2">
          <Paperclip className="size-4" /> 附件
        </Label>
        <Input
          id="reply-attachments"
          name="attachments"
          type="file"
          multiple
          accept={SUPPORT_ATTACHMENT_ACCEPT}
        />
        <p className="field-note">
          仅支持 JPG、PNG、WEBP、GIF、AVIF 图片，最多 3 张，每张不超过 3MB。
        </p>
      </div>
      <PendingSubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="发送中...">发送回复</PendingSubmitButton>
    </form>
  );
}
