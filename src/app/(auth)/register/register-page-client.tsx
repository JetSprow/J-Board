"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import { getErrorMessage } from "@/lib/errors";
import { AuthCard, AuthErrorMessage, AuthShell } from "../_components/auth-shell";

export function RegisterPageClient({ siteKey }: { siteKey?: string | null }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [requiresEmailVerification, setRequiresEmailVerification] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (siteKey && !turnstileToken) {
      setError("请完成人机验证");
      return;
    }
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    if (password !== confirmPassword) {
      setError("两次密码不一致");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
          name: formData.get("name"),
          inviteCode: formData.get("inviteCode"),
          turnstileToken,
        }),
      });
      const data = await response.json().catch(() => null) as { error?: unknown; requiresEmailVerification?: unknown } | null;
      if (!response.ok) {
        setError(getErrorMessage(data, `注册失败 (HTTP ${response.status})`));
      } else {
        setRequiresEmailVerification(Boolean(data?.requiresEmailVerification));
        setSuccess(true);
      }
    } catch (error) {
      setError(getErrorMessage(error, "注册失败"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-4 py-3 text-center">
            <div className="text-4xl" aria-hidden="true">🎉</div>
            <h1 className="text-xl font-semibold tracking-tight">{requiresEmailVerification ? "验证邮件已发送" : "注册成功"}</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {requiresEmailVerification ? "请查收邮箱并完成验证，验证后即可登录。" : "账户已创建，请登录。"}
            </p>
            <Link href={requiresEmailVerification ? "/verify-email-request" : "/login"} className={buttonVariants({ size: "lg", className: "w-full" })}>
              {requiresEmailVerification ? "没有收到？重新发送" : "去登录"}
            </Link>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard title="J-Board" description="创建 JB面板账户">
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthErrorMessage message={error} />
          <div className="space-y-2">
            <Label htmlFor="name">昵称</Label>
            <Input id="name" name="name" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inviteCode">邀请码（可选）</Label>
            <Input id="inviteCode" name="inviteCode" autoComplete="off" />
          </div>
          <TurnstileWidget siteKey={siteKey} onSuccess={setTurnstileToken} />
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          已有账户？{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            登录
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
