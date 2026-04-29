"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, MailCheck, XCircle } from "lucide-react";
import { confirmEmailToken } from "@/actions/auth/email";
import { Button } from "@/components/ui/button";
import { AuthCard, AuthErrorMessage, AuthShell } from "@/app/(auth)/_components/auth-shell";
import { getErrorMessage } from "@/lib/errors";

export function VerifyEmailClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const Icon = result?.ok ? CheckCircle2 : result ? XCircle : MailCheck;

  async function handleConfirm(formData: FormData) {
    setLoading(true);
    setError("");
    try {
      setResult(await confirmEmailToken(formData));
    } catch (error) {
      setError(getErrorMessage(error, "验证失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        title={result ? (result.ok ? "验证完成" : "验证失败") : "确认邮箱操作"}
        description={result?.message ?? "为了避免邮件客户端预览误触发，请点击按钮完成确认。"}
      >
        <div className="space-y-4 py-3 text-center">
          <div className={result && !result.ok ? "mx-auto flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive" : "mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"}>
            <Icon className="size-6" />
          </div>
          <AuthErrorMessage message={error} />
          {!result ? (
            <form action={handleConfirm}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" size="lg" disabled={loading || !token} className="w-full">
                {loading ? "确认中..." : "确认邮箱"}
              </Button>
            </form>
          ) : (
            <Link href="/login" className="font-medium text-primary hover:underline">
              返回登录
            </Link>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
