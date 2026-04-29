"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { resetPasswordByEmail } from "@/actions/auth/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { AuthCard, AuthErrorMessage, AuthShell } from "../_components/auth-shell";

export function ResetPasswordClient({ token }: { token: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await resetPasswordByEmail(formData);
      setDone(true);
    } catch (error) {
      setError(getErrorMessage(error, "重设失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard title="设置新密码" description="为你的账户设置一个新的登录密码。">
        {done ? (
          <div className="space-y-4 py-3 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">密码已更新，请使用新密码登录。</p>
            <Link href="/login" className="font-medium text-primary hover:underline">返回登录</Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <AuthErrorMessage message={error} />
            <input type="hidden" name="token" value={token} />
            <div className="space-y-2">
              <Label htmlFor="password">新密码</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || !token}>
              {loading ? "保存中..." : "更新密码"}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
