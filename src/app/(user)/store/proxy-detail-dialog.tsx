"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, Network, Server, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { purchaseProxy } from "@/actions/user/purchase";
import { addProxyPlanToCart } from "@/actions/user/cart";
import { StorePlanDescription } from "./plan-card-parts";
import { ProxySignalPanel } from "./proxy-signal-grid";
import { useLatency } from "./latency-loader";
import { useTraces, type TraceItem } from "./trace-loader";
import {
  ProxyAvailabilityNotice,
  ProxyInboundSelect,
  ProxyPurchaseSummary,
  ProxyTrafficSlider,
} from "./proxy-purchase-fields";
import { usePlanAvailabilityCheck } from "./use-plan-availability-check";
import { ProxyTraceDetailDialog } from "./proxy-trace-detail-dialog";
import { LatencyDetailDialog } from "./latency-detail-dialog";
import type { ProxyPlan } from "./proxy-plan-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ProxyPlan;
  networkInsightsEnabled: boolean;
}

export function ProxyDetailDialog({ open, onOpenChange, plan, networkInsightsEnabled }: Props) {
  const fixedTrafficGb = plan.fixedTrafficGb ?? plan.minTrafficGb;
  const [trafficGb, setTrafficGb] = useState(
    plan.pricingMode === "FIXED_PACKAGE" ? fixedTrafficGb : plan.minTrafficGb,
  );
  const [selectedInboundId, setSelectedInboundId] = useState(plan.inboundOptions[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<TraceItem | null>(null);
  const [latencyDialogOpen, setLatencyDialogOpen] = useState(false);
  const router = useRouter();
  const hasInboundOptions = plan.inboundOptions.length > 0;
  const isFixedPackage = plan.pricingMode === "FIXED_PACKAGE";
  const { checking, checkAvailability } = usePlanAvailabilityCheck(plan.id);
  const latencyItems = useLatency(plan.nodeId);
  const traceItems = useTraces(plan.nodeId);

  const totalPrice = useMemo(
    () => (isFixedPackage ? (plan.fixedPrice ?? 0) : trafficGb * plan.pricePerGb).toFixed(2),
    [isFixedPackage, plan.fixedPrice, plan.pricePerGb, trafficGb],
  );

  async function handlePurchase() {
    if (!selectedInboundId) {
      toast.error("请先选择一个线路入口");
      return;
    }
    setLoading(true);
    try {
      const orderId = await purchaseProxy(plan.id, trafficGb, selectedInboundId);
      router.push(`/pay/${orderId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "下单失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    if (!selectedInboundId) {
      toast.error("请先选择一个线路入口");
      return;
    }
    setCartLoading(true);
    try {
      await addProxyPlanToCart(plan.id, trafficGb, selectedInboundId);
      toast.success("已加入购物车");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "加入购物车失败"));
    } finally {
      setCartLoading(false);
    }
  }

  const displayPrice = isFixedPackage ? (plan.fixedPrice ?? 0) : plan.pricePerGb;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.14em] text-primary">
              <Network className="size-3.5" /> PROXY
            </div>
            <DialogTitle>{plan.name}</DialogTitle>
            <DialogDescription>
              {plan.nodeName} · {plan.durationDays} 天 · ¥{displayPrice}{isFixedPackage ? "/套餐" : "/GB"}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto -mx-6 px-6 space-y-4">
            {/* Compact info row — above the grid so both columns align */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                <Server className="size-3.5 text-primary" />
                {plan.nodeName}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2.5 py-1.5">
                <Clock3 className="size-3.5 text-primary" />
                {plan.durationDays} 天
              </span>
            </div>

            <div className={`grid items-start gap-6 ${networkInsightsEnabled ? "lg:grid-cols-[1fr_20rem]" : ""}`}>
              {/* Left: purchase config — always visible without scrolling */}
              <div className="space-y-3">
                <ProxyInboundSelect
                  inbounds={plan.inboundOptions}
                  value={selectedInboundId}
                  onValueChange={setSelectedInboundId}
                  disabled={!hasInboundOptions}
                />

                {isFixedPackage ? (
                  <div className="rounded-lg border border-primary/15 bg-primary/10 px-3 py-2.5 text-sm">
                    <span className="font-semibold text-primary">固定流量套餐</span>
                    <span className="ml-2 text-muted-foreground">包含 {fixedTrafficGb} GB</span>
                  </div>
                ) : (
                  <ProxyTrafficSlider
                    value={trafficGb}
                    min={plan.minTrafficGb}
                    max={plan.maxTrafficGb}
                    onChange={setTrafficGb}
                  />
                )}

                <ProxyPurchaseSummary totalPrice={totalPrice} />

                {!plan.isAvailable && (
                  <ProxyAvailabilityNotice nextAvailableAt={plan.nextAvailableAt} />
                )}

                <div className="flex gap-2">
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1"
                    onClick={handleAddToCart}
                    disabled={cartLoading || !plan.isAvailable || !hasInboundOptions}
                  >
                    <ShoppingCart className="size-4" />
                    {cartLoading ? "正在加入..." : "加入购物车"}
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handlePurchase}
                    disabled={loading || !plan.isAvailable || !hasInboundOptions}
                  >
                    {loading ? "正在保留..." : "立即支付"}
                    {plan.isAvailable && <ArrowRight className="size-4" />}
                  </Button>
                </div>

                {!plan.isAvailable && (
                  <Button variant="outline" size="lg" className="w-full" onClick={checkAvailability} disabled={checking}>
                    {checking ? "查询中..." : "查看补位时间"}
                  </Button>
                )}

                {/* Description inline below actions */}
                {plan.description && (
                  <div className="border-t border-border pt-3">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">套餐说明</p>
                    <StorePlanDescription description={plan.description} />
                  </div>
                )}
              </div>

              {networkInsightsEnabled && (
                <div className="min-w-0 lg:max-h-[60vh] lg:overflow-y-auto lg:-mr-3 lg:pr-3">
                  <ProxySignalPanel
                    latencyItems={latencyItems}
                    traceItems={traceItems}
                    onTraceSelect={setSelectedTrace}
                    onLatencyClick={() => setLatencyDialogOpen(true)}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {networkInsightsEnabled && (
        <ProxyTraceDetailDialog
          trace={selectedTrace}
          onOpenChange={(open) => {
            if (!open) setSelectedTrace(null);
          }}
        />
      )}

      {networkInsightsEnabled && (
        <LatencyDetailDialog
          nodeId={plan.nodeId}
          open={latencyDialogOpen}
          onOpenChange={setLatencyDialogOpen}
        />
      )}
    </>
  );
}
