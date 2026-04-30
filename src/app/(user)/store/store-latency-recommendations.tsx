"use client";

import { useEffect, useState } from "react";
import { Activity, Clock3, RadioTower, RefreshCw, Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import {
  RECOMMENDATION_CARRIERS,
  carrierLabels,
  type LatencyRecommendation,
} from "@/services/latency-recommendation-types";

interface RecommendationPayload {
  items: LatencyRecommendation[];
  updatedAt: string;
  refreshIntervalMs: number;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
export const OPEN_PROXY_PLAN_EVENT = "jboard:open-proxy-plan";

function formatTime(value: string | null) {
  if (!value) return "等待刷新";
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLatencyTone(latencyMs?: number) {
  if (latencyMs == null) return "border-dashed bg-muted/20 text-muted-foreground";
  if (latencyMs <= 80) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (latencyMs <= 150) return "border-primary/20 bg-primary/10 text-primary";
  return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function openRecommendedPlan(planId: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_PROXY_PLAN_EVENT, {
      detail: { planId },
    }),
  );
}

export function StoreLatencyRecommendations({
  initialItems,
}: {
  initialItems: LatencyRecommendation[];
}) {
  const [items, setItems] = useState(initialItems);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialItems[0]?.checkedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const payload = await fetchJson<RecommendationPayload>("/api/latency/recommendations");
        if (cancelled) return;
        setItems(payload.items);
        setUpdatedAt(payload.updatedAt);
        setError(null);
      } catch {
        if (!cancelled) setError("推荐线路暂时无法刷新");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const itemMap = new Map(items.map((item) => [item.carrier, item]));

  return (
    <section className="surface-card overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> 三网推荐
          </div>
          <h2 className="text-xl font-semibold tracking-[-0.04em] sm:text-2xl">按最低延迟优先选节点</h2>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">
            自动比较电信、联通、移动三条线路当前最低延迟，推荐会每 5 分钟刷新一次。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1">
            {loading ? <RefreshCw className="size-3.5 animate-spin" /> : <Clock3 className="size-3.5" />}
            {formatTime(updatedAt)} 更新
          </span>
          {error && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-300">自动重试中</span>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {RECOMMENDATION_CARRIERS.map((carrier) => {
          const item = itemMap.get(carrier);
          return (
            <button
              key={carrier}
              type="button"
              disabled={!item}
              onClick={() => {
                if (item) openRecommendedPlan(item.planId);
              }}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-default",
                item && "hover:border-primary/25 hover:bg-primary/7",
                getLatencyTone(item?.latencyMs),
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  <RadioTower className="size-4" /> {carrierLabels[carrier]}
                </p>
                {item && (
                  <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs font-semibold tabular-nums">
                    {item.latencyMs} ms
                  </span>
                )}
              </div>

              {item ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-lg font-semibold tracking-[-0.04em] text-foreground">{item.nodeName}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.planName}</p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Activity className="size-3.5" /> 查看详情与购买
                  </span>
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted-foreground">正在采集这个运营商的延迟数据。</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
