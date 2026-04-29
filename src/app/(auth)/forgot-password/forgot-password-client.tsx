"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { AuthCard, AuthErrorMessage, AuthShell } from "../_components/auth-shell";

export function ForgotPasswordClient() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await requestPasswordReset(formData);
      setSent(true);
    } catch (error) {
      setError(getErrorMessage(error, "发送失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard title="找回密码" description="输入注册邮箱，我们会发送一封密码重设邮件。">
        {sent ? (
          <div className="space-y-4 py-3 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="size-5" />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">如果邮箱存在且状态正常，重设链接已经发送。请在 20 分钟内完成操作。</p>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">返回登录</Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <AuthErrorMessage message={error} />
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "发送中..." : "发送重设邮件"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              想起密码了？ <Link href="/login" className="font-medium text-primary hover:underline">去登录</Link>
            </p>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
