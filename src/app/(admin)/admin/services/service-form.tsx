"use client";

import { useState } from "react";
import type { StreamingService } from "@prisma/client";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createService, updateService } from "@/actions/admin/services";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function ServiceForm({
  service,
  triggerLabel,
  triggerVariant = "default",
}: {
  service?: StreamingService;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(service);

  async function handleSubmit(formData: FormData) {
    try {
      if (service) {
        await updateService(service.id, formData);
        toast.success("服务已更新");
      } else {
        await createService(formData);
        toast.success("服务创建成功");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, isEdit ? "更新失败" : "创建失败"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={isEdit ? "sm" : "default"} />}>
        {triggerLabel ?? (isEdit ? "编辑" : "添加服务")}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑流媒体服务" : "添加流媒体服务"}</DialogTitle>
          <p className="text-sm leading-6 text-muted-foreground">服务会被套餐占用槽位，凭据只在后台可见，请确保描述足够清晰。</p>
        </DialogHeader>
        <form action={handleSubmit} className="form-panel space-y-5">
          <div>
            <Label>名称 (如 Netflix)</Label>
            <Input name="name" defaultValue={service?.name} required />
          </div>
          <div>
            <Label>凭据 (账号密码等)</Label>
            <Textarea
              name="credentials"
              required
              defaultValue=""
              placeholder={
                isEdit
                  ? "重新输入最新凭据，不留空"
                  : "email: xxx&#10;password: xxx"
              }
            />
          </div>
          <div>
            <Label>最大共享人数</Label>
            <Input name="maxSlots" type="number" defaultValue={service?.maxSlots ?? 5} required />
          </div>
          <div>
            <Label>描述</Label>
            <Input name="description" defaultValue={service?.description ?? ""} />
          </div>
          <PendingSubmitButton size="lg" className="w-full" pendingLabel={isEdit ? "保存中..." : "创建中..."}>
            {isEdit ? "保存" : "创建"}
          </PendingSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
