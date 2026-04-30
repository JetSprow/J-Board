import type { Metadata } from "next";
import { getActiveSession } from "@/lib/require-auth";
import Link from "next/link";
import { Film, LifeBuoy, Radio } from "lucide-react";

import { EmptyState, PageShell } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { PendingOrderBanner } from "./pending-order-banner";
import { ProxyPlanCard } from "./proxy-plan-card";
import { StreamingPlanCard } from "./streaming-plan-card";
import { StorePlanSection } from "./store-plan-section";
import { StoreLatencyRecommendations } from "./store-latency-recommendations";

import { LatencyLoader } from "./latency-loader";
import { TraceLoader } from "./trace-loader";
import { getStorePageData } from "./store-data";
import {
  getProxyNodeIds,
  getProxyPlans,
  getStreamingPlans,
  toProxyPlanCard,
  toStreamingPlanCard,
} from "./store-plan-mappers";
import { sortPlansForDisplay } from "./store-recommendations";

export const metadata: Metadata = {
  title: "套餐商店",
  description: "浏览代理与流媒体套餐，查看实时可用性并下单。",
};

export default async function StorePage() {
  const session = await getActiveSession();
  const {
    plans,
    availabilityMap,
    pendingOrder,
    networkRecommendationsEnabled,
    networkInsightsEnabled,
    latencyRecommendations,
  } = await getStorePageData(session?.user.id);
  const proxyPlans = getProxyPlans(plans);
  const streamingPlans = getStreamingPlans(plans);
  const proxyCards = sortPlansForDisplay(proxyPlans.map((plan) => toProxyPlanCard(plan, availabilityMap.get(plan.id))));
  const streamingCards = sortPlansForDisplay(streamingPlans.map((plan) => toStreamingPlanCard(plan, availabilityMap.get(plan.id))));
  const proxyNodeIds = getProxyNodeIds(proxyPlans);

  return (
    <PageShell>
      <section className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            订阅商店
          </p>
          <h1 className="text-display text-2xl font-semibold sm:text-3xl">
            选择你的连接方案
          </h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="choice-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Radio className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">代理连接</p>
                <p className="mt-0.5 text-xs text-muted-foreground">按流量计费</p>
              </div>
            </div>
          </div>
          <div className="choice-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <Film className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">流媒体共享</p>
                <p className="mt-0.5 text-xs text-muted-foreground">按周期订阅</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PendingOrderBanner order={pendingOrder} />

      {networkRecommendationsEnabled && proxyCards.length > 0 && (
        <StoreLatencyRecommendations initialItems={latencyRecommendations} />
      )}

      {proxyCards.length > 0 && (
        <StorePlanSection
          id="proxy-plans"
          eyebrow="PROXY"
          title="代理连接"
          gridClassName="lg:grid-cols-2 xl:grid-cols-3"
          after={(
            <>
              {networkInsightsEnabled && proxyNodeIds.length > 0 && (
                <>
                  <LatencyLoader nodeIds={proxyNodeIds} />
                  <TraceLoader nodeIds={proxyNodeIds} />
                </>
              )}
            </>
          )}
        >
          {proxyCards.map((plan) => (
            <ProxyPlanCard
              key={plan.id}
              plan={plan}
              networkInsightsEnabled={networkInsightsEnabled}
            />
          ))}
        </StorePlanSection>
      )}

      {streamingCards.length > 0 && (
        <StorePlanSection
          id="streaming-plans"
          eyebrow="STREAMING"
          title="流媒体共享"
        >
          {streamingCards.map((plan) => (
            <StreamingPlanCard key={plan.id} plan={plan} />
          ))}
        </StorePlanSection>
      )}

      {plans.length === 0 && (
        <EmptyState
          eyebrow="商店准备中"
          icon={<LifeBuoy className="size-5" />}
          title="新的订阅正在准备"
          description="可购买的套餐会在这里出现。如果你希望提前了解补货时间，可以联系支持团队。"
          action={
            <Link href="/support" className={buttonVariants()}>
              联系支持
            </Link>
          }
        />
      )}
    </PageShell>
  );
}
