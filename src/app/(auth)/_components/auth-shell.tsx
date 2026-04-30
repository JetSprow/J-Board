import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PublicNotice } from "../public-notice";
import { SiteFooter } from "@/components/shared/site-footer";
import { PRODUCT_EDITION } from "@/lib/product";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col px-4 py-10">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full">
          <div className="mx-auto w-full max-w-md">
            <PublicNotice />
          </div>
          {children}
        </div>
      </div>
      <SiteFooter className="mt-6" />
    </main>
  );
}

export function AuthCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("mx-auto w-full max-w-md rounded-xl p-1", className)}>
      {(title || description) && (
        <CardHeader className="space-y-2 pt-6 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {PRODUCT_EDITION.slice(0, 1)}
          </div>
          {title && <h1 className="text-display text-2xl font-semibold">{title}</h1>}
          {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      <CardContent className="pb-6">{children}</CardContent>
    </Card>
  );
}

export function AuthErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border border-destructive/15 bg-destructive/10 px-3 py-2 text-center text-sm font-medium text-destructive">
      {message}
    </div>
  );
}
