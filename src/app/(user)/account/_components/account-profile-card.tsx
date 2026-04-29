import { MailCheck, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountPanelUser } from "../account-types";

type AccountFormAction = (formData: FormData) => void | Promise<void>;

interface AccountProfileCardProps {
  user: Pick<AccountPanelUser, "email" | "emailVerifiedAt" | "name">;
  isSaving: boolean;
  isEmailSaving: boolean;
  onSubmit: AccountFormAction;
  onEmailSubmit: AccountFormAction;
}

export function AccountProfileCard({
  user,
  isSaving,
  isEmailSaving,
  onSubmit,
  onEmailSubmit,
}: AccountProfileCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle>账户资料</CardTitle>
            <CardDescription>昵称立即保存；邮箱变更会先发送确认邮件，新邮箱确认后才会生效。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form action={onSubmit} className="space-y-5">
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <Label htmlFor="name">昵称</Label>
            <Input id="name" name="name" defaultValue={user.name ?? ""} required />
          </div>
          <Button type="submit" size="lg" disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? "保存中..." : "保存资料"}
          </Button>
        </form>

        <form id="account-email-form" action={onEmailSubmit} className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="accountEmail">当前邮箱</Label>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[0.68rem] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="size-3" /> {user.emailVerifiedAt ? "已验证" : "已绑定"}
            </span>
          </div>
          <Input id="accountEmail" value={user.email} disabled />
          {user.emailVerifiedAt && (
            <p className="text-xs leading-5 text-muted-foreground">验证时间：{user.emailVerifiedAt}</p>
          )}
          <div className="space-y-2 pt-2">
            <Label htmlFor="email">新邮箱</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="new@example.com" required />
              <Button type="submit" variant="outline" disabled={isEmailSaving} className="sm:w-auto">
                <MailCheck className="size-4" />
                {isEmailSaving ? "发送中" : "发送确认"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
