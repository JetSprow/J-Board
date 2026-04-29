"use client";

import { useState } from "react";
import type {
  AnnouncementAudience,
  AnnouncementDisplayType,
} from "@prisma/client";
import { toast } from "sonner";
import {
  createAnnouncement,
  updateAnnouncement,
} from "@/actions/admin/announcements";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";

interface AnnouncementOptionUser {
  id: string;
  email: string;
}

interface AnnouncementFormData {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  displayType: AnnouncementDisplayType;
  targetUserId: string | null;
  dismissible: boolean;
  sendNotification: boolean;
  startAt: Date | string | null;
  endAt: Date | string | null;
}

function toDateTimeLocalValue(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

export function AnnouncementForm({
  users,
  announcement,
  triggerLabel,
  triggerVariant = "outline",
}: {
  users: AnnouncementOptionUser[];
  announcement: AnnouncementFormData;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<AnnouncementAudience>(announcement.audience);

  async function handleSubmit(formData: FormData) {
    try {
      await updateAnnouncement(announcement.id, formData);
      toast.success("公告已更新");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "更新公告失败"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setAudience(announcement.audience);
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        {triggerLabel ?? "编辑"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑公告</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`title-${announcement.id}`}>标题</Label>
              <Input id={`title-${announcement.id}`} name="title" defaultValue={announcement.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`audience-${announcement.id}`}>目标范围</Label>
              <select
                id={`audience-${announcement.id}`}
                name="audience"
                defaultValue={announcement.audience}
                onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
                className="h-10 w-full px-3 text-sm outline-none"
              >
                <option value="PUBLIC">公开（登录/注册页可见）</option>
                <option value="USERS">全部用户</option>
                <option value="ADMINS">全部管理员</option>
                <option value="SPECIFIC_USER">指定用户</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`displayType-${announcement.id}`}>展示方式</Label>
              <select
                id={`displayType-${announcement.id}`}
                name="displayType"
                defaultValue={announcement.displayType}
                className="h-10 w-full px-3 text-sm outline-none"
              >
                <option value="INLINE">普通公告</option>
                <option value="BIG">大公告</option>
                <option value="POPUP">弹窗公告</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`dismissible-${announcement.id}`}>允许用户关闭</Label>
              <select
                id={`dismissible-${announcement.id}`}
                name="dismissible"
                defaultValue={announcement.dismissible ? "true" : "false"}
                className="h-10 w-full px-3 text-sm outline-none"
              >
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`targetUserId-${announcement.id}`}>指定用户（可选）</Label>
            <select
              id={`targetUserId-${announcement.id}`}
              name="targetUserId"
              defaultValue={announcement.targetUserId ?? ""}
              disabled={audience !== "SPECIFIC_USER"}
              className="h-10 w-full px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">不指定</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`body-${announcement.id}`}>内容</Label>
            <Textarea
              id={`body-${announcement.id}`}
              name="body"
              rows={5}
              defaultValue={announcement.body}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`startAt-${announcement.id}`}>开始时间（可选）</Label>
              <Input
                id={`startAt-${announcement.id}`}
                name="startAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(announcement.startAt)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`endAt-${announcement.id}`}>结束时间（可选）</Label>
              <Input
                id={`endAt-${announcement.id}`}
                name="endAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(announcement.endAt)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`sendNotification-${announcement.id}`}>同步发送站内通知</Label>
            <select
              id={`sendNotification-${announcement.id}`}
              name="sendNotification"
              defaultValue={announcement.sendNotification ? "true" : "false"}
              className="h-10 w-full px-3 text-sm outline-none"
            >
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>

          <PendingSubmitButton className="w-full" pendingLabel="保存中...">
            保存修改
          </PendingSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateAnnouncementButton({
  users,
}: {
  users: AnnouncementOptionUser[];
}) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<AnnouncementAudience>("USERS");

  async function handleSubmit(formData: FormData) {
    try {
      await createAnnouncement(formData);
      toast.success("公告已发布");
      setOpen(false);
      setAudience("USERS");
    } catch (error) {
      toast.error(getErrorMessage(error, "发布公告失败"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>发布公告</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>发布公告</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-announcement-title">标题</Label>
              <Input id="create-announcement-title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-announcement-audience">目标范围</Label>
              <select
                id="create-announcement-audience"
                name="audience"
                defaultValue="USERS"
                onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
                className="h-10 w-full px-3 text-sm outline-none"
              >
                <option value="PUBLIC">公开（登录/注册页可见）</option>
                <option value="USERS">全部用户</option>
                <option value="ADMINS">全部管理员</option>
                <option value="SPECIFIC_USER">指定用户</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-announcement-displayType">展示方式</Label>
              <select
                id="create-announcement-displayType"
                name="displayType"
                defaultValue="INLINE"
                className="h-10 w-full px-3 text-sm outline-none"
              >
                <option value="INLINE">普通公告</option>
                <option value="BIG">大公告</option>
                <option value="POPUP">弹窗公告</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-announcement-dismissible">允许用户关闭</Label>
              <select
                id="create-announcement-dismissible"
                name="dismissible"
                defaultValue="true"
                className="h-10 w-full px-3 text-sm outline-none"
              >
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-announcement-targetUserId">指定用户（可选）</Label>
            <select
              id="create-announcement-targetUserId"
              name="targetUserId"
              defaultValue=""
              disabled={audience !== "SPECIFIC_USER"}
              className="h-10 w-full px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">不指定</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-announcement-body">内容</Label>
            <Textarea id="create-announcement-body" name="body" rows={5} required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-announcement-startAt">开始时间（可选）</Label>
              <Input id="create-announcement-startAt" name="startAt" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-announcement-endAt">结束时间（可选）</Label>
              <Input id="create-announcement-endAt" name="endAt" type="datetime-local" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-announcement-sendNotification">同步发送站内通知</Label>
            <select
              id="create-announcement-sendNotification"
              name="sendNotification"
              defaultValue="true"
              className="h-10 w-full px-3 text-sm outline-none"
            >
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>

          <PendingSubmitButton className="w-full" pendingLabel="发布中...">
            发布
          </PendingSubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
