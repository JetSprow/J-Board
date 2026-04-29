"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createSupportTicket } from "@/actions/user/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";

const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

type SupportTicketPreset = {
  riskEventId?: string;
  subject?: string;
  category?: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  body?: string;
};

export function CreateSupportTicketForm({
  defaultOpen = false,
  openTicketCount = 0,
  openTicketLimit = 2,
  preset,
}: {
  defaultOpen?: boolean;
  openTicketCount?: number;
  openTicketLimit?: number;
  preset?: SupportTicketPreset;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const effectiveOpenTicketLimit = Math.max(1, openTicketLimit);
  const limitReached = openTicketCount >= effectiveOpenTicketLimit;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || limitReached) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    submittingRef.current = true;
    setSubmitting(true);

    try {
      await createSupportTicket(formData);
      toast.success("工单已提交");
      form.reset();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "提交工单失败"));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (limitReached) {
    return (
      <div id="new-ticket" className="surface-card space-y-3 rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Plus className="size-4" />
          </span>
          <div>
            <h3 className="text-lg font-semibold">未关闭工单已达上限</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              当前有 {openTicketCount}/{effectiveOpenTicketLimit} 个未关闭工单，请先关闭已处理工单或等待客服处理后再创建。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button id="new-ticket" onClick={() => setOpen(true)} size="lg">
        <Plus className="size-4" />
        新建工单
      </Button>
    );
  }

  return (
    <form
      id="new-ticket"
      action={createSupportTicket}
      onSubmit={(event) => void handleSubmit(event)}
      aria-busy={submitting}
      className="surface-card space-y-5 rounded-[2rem] p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{preset?.riskEventId ? "订阅风控复核工单" : "新建工单"}</h3>
        {!preset?.riskEventId && (
          <button
            type="button"
            aria-label="收起新建工单表单"
            disabled={submitting}
            onClick={() => setOpen(false)}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <fieldset disabled={submitting} className="space-y-5 disabled:opacity-70">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="subject">标题</Label>
            <Input id="subject" name="subject" placeholder="一句话描述遇到的问题" defaultValue={preset?.subject} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">优先级</Label>
            <select
              id="priority"
              name="priority"
              defaultValue={preset?.priority ?? "NORMAL"}
              className="h-11 w-full px-3 text-sm outline-none disabled:cursor-not-allowed"
            >
              <option value="LOW">低</option>
              <option value="NORMAL">普通</option>
              <option value="HIGH">高</option>
              <option value="URGENT">紧急</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Input id="category" name="category" placeholder="例如：支付 / 节点 / 流媒体 / 账户" defaultValue={preset?.category} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">问题描述</Label>
          <Textarea id="body" name="body" rows={5} placeholder="补充问题背景、错误提示或你已经尝试过的步骤" defaultValue={preset?.body} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attachments">附件（最多 3 张，仅支持图片，每张不超过 3MB）</Label>
          <Input
            id="attachments"
            name="attachments"
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
          />
        </div>
        {preset?.riskEventId && <input type="hidden" name="riskEventId" value={preset.riskEventId} />}
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "提交中..." : "提交工单"}
        </Button>
      </fieldset>
    </form>
  );
}
