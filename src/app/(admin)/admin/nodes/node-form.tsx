"use client";

import { useState } from "react";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createNode, updateNode } from "@/actions/admin/nodes";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

interface NodeFormValue {
  id: string;
  name: string;
  panelUrl: string | null;
  panelUsername: string | null;
  panelPassword: string | null;
}

export function NodeForm({
  node,
  triggerLabel,
  triggerVariant = "default",
}: {
  node?: NodeFormValue;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const isEdit = Boolean(node);
  const [open, setOpen] = useState(false);

  async function handleCreate(formData: FormData) {
    try {
      const result = await createNode(formData);
      if (result.success) toast.success(result.message);
      else toast.warning(result.message);
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "创建失败"));
    }
  }

  async function handleEdit(formData: FormData) {
    try {
      const result = await updateNode(node!.id, formData);
      if (result.success) toast.success(result.message);
      else toast.warning(result.message);
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "更新失败"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={isEdit ? "sm" : "default"} />}
      >
        {triggerLabel || (isEdit ? "编辑" : "添加节点")}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑 3x-ui 节点" : "添加 3x-ui 节点"}</DialogTitle>
          <DialogDescription>
            保存后会登录 3x-ui 并同步面板中的入站线路；入站请在 3x-ui 面板内维护。
          </DialogDescription>
        </DialogHeader>
        <form action={isEdit ? handleEdit : handleCreate} className="form-panel space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>节点名称</Label>
              <Input name="name" defaultValue={node?.name ?? ""} placeholder="如 HK-01" />
            </div>
            <div>
              <Label>3x-ui 面板地址</Label>
              <Input name="panelUrl" defaultValue={node?.panelUrl ?? ""} placeholder="http://1.2.3.4:2053" required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>面板用户名</Label>
              <Input name="panelUsername" defaultValue={node?.panelUsername ?? ""} required />
            </div>
            <div>
              <Label>面板密码</Label>
              <Input name="panelPassword" type="password" defaultValue={node?.panelPassword ?? ""} required />
            </div>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            延迟和线路探测仍使用探测 Token；节点开通、暂停、删除客户端均回归 3x-ui 面板 API。
          </p>
          <PendingSubmitButton size="lg" className="w-full" pendingLabel={isEdit ? "保存中..." : "创建中..."}>
            {isEdit ? "保存并同步入站" : "创建并同步入站"}
          </PendingSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
