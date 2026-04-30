"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import { PRODUCT_NAME } from "@/lib/product";
import { AuthCard, AuthErrorMessage, AuthShell } from "../_components/auth-shell";

export function LoginPageClient({
  siteKey,
  allowRegistration,
}: {
  siteKey?: string | null;
  allowRegistration: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      turnstileToken,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(result.error === "EMAIL_NOT_VERIFIED" ? "邮箱尚未验证，请先查收验证邮件" : "邮箱或密码错误");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <AuthShell>
      <AuthCard title={PRODUCT_NAME} description="登录你的面板账户">
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthErrorMessage message={error} />
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <TurnstileWidget siteKey={siteKey} onSuccess={setTurnstileToken} />
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            忘记密码
          </Link>
          {allowRegistration && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden />
              <span>
                没有账户？{" "}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  注册
                </Link>
              </span>
            </>
          )}
          {error === "邮箱尚未验证，请先查收验证邮件" && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden />
              <Link href="/verify-email-request" className="font-medium text-primary hover:underline">
                重发验证邮件
              </Link>
            </>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
