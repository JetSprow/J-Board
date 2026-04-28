"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SiteFooter } from "@/components/shared/site-footer";

export function PaymentFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col px-4 py-10">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-2xl">{children}</div>
      </div>
      <SiteFooter className="mt-6 max-w-2xl" />
    </main>
  );
}

export function PaymentCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="rounded-xl p-1">
      <CardHeader className="space-y-2 pt-6 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </div>
        <h1 className="text-display text-2xl font-semibold">{title}</h1>
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          选择一种适合你的支付方式。支付完成后，订单会自动确认并进入开通流程。
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">{children}</CardContent>
    </Card>
  );
}
