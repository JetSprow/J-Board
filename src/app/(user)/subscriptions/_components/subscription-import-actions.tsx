import { Link2 } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { cn } from "@/lib/utils";

interface SubscriptionImportActionsProps {
  genericUrl: string;
  clashUrl: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function withSubscriptionFormat(url: string, format: "base64" | "uri" | "clash") {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}format=${format}`;
}

export function SubscriptionImportActions({
  genericUrl,
  clashUrl,
  title = "客户端导入",
  description = "复制适配 Clash 的订阅 URL；其他客户端可复制通用订阅 URL。",
  compact = false,
}: SubscriptionImportActionsProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3 backdrop-blur">
      <div className={cn("flex flex-col gap-3", compact ? "" : "lg:flex-row lg:items-center lg:justify-between")}>
        <div className="min-w-0 space-y-1">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            <Link2 className="size-3.5" /> SUBSCRIPTION URL
          </p>
          <p className="truncate font-mono text-xs text-foreground/80">{genericUrl}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">{title}</span> · {description}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:shrink-0 lg:flex-wrap lg:justify-end">
          <CopyButton text={clashUrl} label="复制 Clash" />
          <CopyButton text={genericUrl} label="复制通用" />
        </div>
      </div>
    </div>
  );
}
