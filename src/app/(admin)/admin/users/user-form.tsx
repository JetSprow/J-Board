"use client";

import { useState } from "react";
import type { User } from "@prisma/client";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUser, updateUser } from "@/actions/admin/users";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function UserForm({
  user,
  triggerLabel,
  triggerVariant = "default",
}: {
  user?: User;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(user);

  async function handleSubmit(formData: FormData) {
    try {
      if (user) {
        await updateUser(user.id, formData);
        toast.success("用户已更新");
      } else {
        await createUser(formData);
        toast.success("用户创建成功");
      }
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, isEdit ? "更新失败" : "创建失败"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={isEdit ? "sm" : "default"} />}>
        {triggerLabel ?? (isEdit ? "编辑" : "创建用户")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑用户" : "创建用户"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-5">
          <div>
            <Label>邮箱</Label>
            <Input name="email" type="email" defaultValue={user?.email} required />
          </div>
          <div>
            <Label>{isEdit ? "新密码（可留空）" : "密码"}</Label>
            <Input
              name="password"
              type="password"
              required={!isEdit}
              minLength={6}
              placeholder={isEdit ? "留空则保持不变" : undefined}
            />
          </div>
          <div>
            <Label>昵称</Label>
            <Input name="name" defaultValue={user?.name ?? ""} />
          </div>
          <div>
            <Label>角色</Label>
            <select
              name="role"
              defaultValue={user?.role ?? "USER"}
              className="h-10 w-full px-3 text-sm outline-none"
            >
              <option value="USER">普通用户</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>
          <PendingSubmitButton className="w-full" pendingLabel={isEdit ? "保存中..." : "创建中..."}>
            {isEdit ? "保存" : "创建"}
          </PendingSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
