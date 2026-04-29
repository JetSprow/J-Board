"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/errors";

export default function UserError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = getErrorMessage(error, "页面加载失败");

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 text-center space-y-5">
          <h1 className="text-xl font-semibold tracking-tight">出了点问题</h1>
          <p className="text-sm leading-6 text-destructive break-words">
            {message}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            如果重试后仍失败，请复制上面的错误详情给管理员排查。
          </p>
          <Button onClick={reset} className="h-10">重试</Button>
        </CardContent>
      </Card>
    </div>
  );
}
