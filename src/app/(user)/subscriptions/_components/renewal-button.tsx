"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { purchaseRenewal } from "@/actions/user/purchase";
import { getErrorMessage } from "@/lib/errors";

interface RenewalConfig {
  durationDays: number;
  renewalPrice: number | null;
  renewalPricingMode: string;
  renewalDurationDays: number | null;
  renewalMinDays: number | null;
  renewalMaxDays: number | null;
}

function clampDuration(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  if (step <= 1) return clamped;
  const offset = clamped - min;
  return min + Math.round(offset / step) * step;
}

export function RenewalButton({
  subscriptionId,
  config,
}: {
  subscriptionId: string;
  config: RenewalConfig;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const isPerDay = config.renewalPricingMode === "PER_DAY";
  const unitDays = isPerDay ? 1 : (config.renewalDurationDays ?? config.durationDays);
  const minDays = config.renewalMinDays ?? unitDays;
  const maxDays = Math.max(minDays, config.renewalMaxDays ?? unitDays);
  const step = isPerDay ? 1 : unitDays;
  const [renewalDays, setRenewalDays] = useState(minDays);
  const totalPrice = useMemo(() => {
    const unitPrice = config.renewalPrice ?? 0;
    const amount = isPerDay ? unitPrice * renewalDays : unitPrice * Math.max(1, renewalDays / unitDays);
    return amount.toFixed(2);
  }, [config.renewalPrice, isPerDay, renewalDays, unitDays]);

  async function handleRenewal() {
    setLoading(true);
    try {
      const result = await purchaseRenewal(subscriptionId, renewalDays);
      if (!result.ok) {
        toast.error(getErrorMessage(result.error, "创建续费订单失败"));
        return;
      }
      router.push(`/pay/${result.orderId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "创建续费订单失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => {
          setRenewalDays(minDays);
          setOpen(true);
        }}
        className="flex-1 sm:flex-none"
      >
        <RefreshCw className="size-3.5" />
        续费
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-primary">
              <WalletCards className="size-3.5" /> RENEWAL
            </div>
            <DialogTitle>续费订阅</DialogTitle>
            <DialogDescription>
              选择续费时长，支付成功后自动延长当前订阅有效期。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex justify-between text-sm">
                <span className="font-medium">续费时长</span>
                <span className="font-semibold text-primary tabular-nums">{renewalDays} 天</span>
              </div>
              <Slider
                value={[renewalDays]}
                onValueChange={(values: number | readonly number[]) => {
                  const value = Array.isArray(values) ? values[0] : values;
                  setRenewalDays(clampDuration(value ?? minDays, minDays, maxDays, step));
                }}
                min={minDays}
                max={maxDays}
                step={step}
                disabled={maxDays <= minDays}
              />
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{minDays} 天</span>
                <span>{isPerDay ? `¥${(config.renewalPrice ?? 0).toFixed(2)}/天` : `¥${(config.renewalPrice ?? 0).toFixed(2)}/${unitDays}天`}</span>
                <span>{maxDays} 天</span>
              </div>
            </div>
            <div className="rounded-lg border border-primary/15 bg-primary/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">本次应付</span>
                <span className="text-3xl font-semibold tracking-[-0.06em] text-primary tabular-nums">¥{totalPrice}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              onClick={handleRenewal}
              disabled={loading || !config.renewalPrice}
            >
              {loading ? "创建中..." : "去支付"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
