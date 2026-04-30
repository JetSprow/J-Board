"use client";

import { CircleDot } from "lucide-react";
import { formatAuditAction, formatAuditMessage } from "@/lib/audit-display";

interface TimelineItem {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  actorEmail: string | null;
}

export function SubscriptionTimeline({
  items,
}: {
  items: TimelineItem[];
}) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">暂无事件记录</p>;
  }

  return (
    <div className="relative space-y-3 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-border/70">
      {items.map((item) => (
        <div key={item.id} className="relative flex gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/35">
          <div className="relative z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm">
            <CircleDot className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-pretty">{formatAuditMessage(item.message)}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{item.createdAt}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatAuditAction(item.action)}
              {item.actorEmail ? ` · ${item.actorEmail}` : " · 系统"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
