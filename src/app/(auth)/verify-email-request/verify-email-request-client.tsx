"use client";

import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { requestRegistrationVerification } from "@/actions/auth/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { AuthCard, AuthErrorMessage, AuthShell } from "../_components/auth-shell";

export function VerifyEmailRequestClient() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      await requestRegistrationVerification(formData);
      setSent(true);
    } catch (error) {
      setError(getErrorMessage(error, "发送失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard title="重新发送验证邮件" description="没有收到邮件时，可以重新发送一次。">
        {sent ? (
          <div className="space-y-4 py-3 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MailCheck className="size-5" />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">如果账户存在且尚未验证，新的验证邮件已经发送。</p>
            <Link href="/login" className="font-medium text-primary hover:underline">返回登录</Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <AuthErrorMessage message={error} />
            <div className="space-y-2">
              <Label htmlFor="email">注册邮箱</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "发送中..." : "重新发送"}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
