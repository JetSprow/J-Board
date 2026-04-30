"use client";

import { useState } from "react";
import { Gauge, Network, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorePlanHeader } from "./plan-card-parts";
import { PlanAvailabilityBadges } from "./plan-availability-badges";
import { ProxyDetailDialog } from "./proxy-detail-dialog";
import type { ProxyPlan } from "./proxy-plan-types";

interface Props {
  plan: ProxyPlan;
  networkInsightsEnabled: boolean;
}

export function ProxyPlanCard({ plan, networkInsightsEnabled }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const hasInboundOptions = plan.inboundOptions.length > 0;
  const isFixedPackage = plan.pricingMode === "FIXED_PACKAGE";
  const displayPrice = isFixedPackage ? (plan.fixedPrice ?? 0) : plan.pricePerGb;

  return (
    <>
      <article
        id={`plan-${plan.id}`}
        className="surface-card surface-lift group relative scroll-mt-24 flex flex-col overflow-hidden rounded-xl text-left"
      >

        <StorePlanHeader
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Network className="size-3.5" /> PROXY
            </span>
          }
          name={plan.name}
          meta={`${plan.nodeName} · ${plan.durationDays} 天`}
          price={`¥${displayPrice}`}
          priceSuffix={isFixedPackage ? "/套餐" : "/GB"}
        />

        <div className="relative px-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Gauge className="size-3.5 text-primary" /> 可选流量
              </p>
              <p className="mt-1 text-sm font-medium">
                {isFixedPackage ? `${plan.fixedTrafficGb ?? plan.minTrafficGb} GB 固定` : `${plan.minTrafficGb}-${plan.maxTrafficGb} GB`}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" /> 线路入口
              </p>
              <p className="mt-1 text-sm font-medium">{hasInboundOptions ? `${plan.inboundOptions.length} 条可选` : "整理中"}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4 px-6 pb-6 pt-4">
          <PlanAvailabilityBadges
            totalLimit={plan.totalLimit}
            perUserLimit={plan.perUserLimit}
            remainingCount={plan.remainingCount}
            inboundCount={plan.inboundOptions.length}
            hasInboundOptions={hasInboundOptions}
            isAvailable={plan.isAvailable}
            missingInboundLabel="线路整理中"
            unavailableLabel="暂时售罄"
          />

          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={() => setDialogOpen(true)}
          >
            <Search className="size-4" />
            查看详情与购买
          </Button>
        </div>
      </article>

      <ProxyDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={plan}
        networkInsightsEnabled={networkInsightsEnabled}
      />
    </>
  );
}
