import { Paperclip, Send } from "lucide-react";
import { replySupportAsAdmin } from "@/actions/admin/support";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_ATTACHMENT_ACCEPT } from "@/services/support";

export function AdminSupportReplyForm({ ticketId }: { ticketId: string }) {
  async function submitReply(formData: FormData) {
    "use server";
    await replySupportAsAdmin(ticketId, formData);
  }

  return (
    <form action={submitReply} className="form-panel space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
          <Send className="size-4" />
        </span>
        <div>
          <h3 className="font-heading text-lg font-semibold tracking-tight">回复用户</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">保持说明清晰，必要时上传截图或补充文件。</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">回复内容</Label>
        <Textarea id="body" name="body" rows={4} placeholder="输入给用户的回复" required />
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
        <Label htmlFor="admin-reply-attachments" className="inline-flex items-center gap-2">
          <Paperclip className="size-4" /> 附件
        </Label>
        <Input
          id="admin-reply-attachments"
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
