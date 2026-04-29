"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubscriptionRiskReviewStatus } from "@prisma/client";
import { CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateSubscriptionRiskReview } from "@/actions/admin/subscription-risk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";

interface RiskReviewMode {
  status: SubscriptionRiskReviewStatus;
  label: string;
  title: string;
  description: string;
  icon: "ack" | "resolve" | "open";
}

const modes: Record<SubscriptionRiskReviewStatus, RiskReviewMode> = {
  OPEN: {
    status: "OPEN",
    label: "重新打开",
    title: "重新打开风控事件",
    description: "事件会回到待处理状态，便于稍后继续跟进。",
    icon: "open",
  },
  ACKNOWLEDGED: {
    status: "ACKNOWLEDGED",
    label: "确认跟进",
    title: "确认正在处理",
    description: "适合先记录已看到、正在核查，暂不恢复或关闭事件。",
    icon: "ack",
  },
  RESOLVED: {
    status: "RESOLVED",
    label: "标记解决",
    title: "标记风控事件已解决",
    description: "适合已联系用户、确认误判或已经完成必要处置后关闭事件。",
    icon: "resolve",
  },
};

function ModeIcon({ icon }: { icon: RiskReviewMode["icon"] }) {
  if (icon === "open") return <RotateCcw className="size-4" />;
  if (icon === "resolve") return <CheckCircle2 className="size-4" />;
  return <ShieldCheck className="size-4" />;
}

export function SubscriptionRiskReviewActions({
  eventId,
  reviewStatus,
  canRestoreSubscription = false,
}: {
  eventId: string;
  reviewStatus: SubscriptionRiskReviewStatus;
  canRestoreSubscription?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<RiskReviewMode | null>(null);
  const [note, setNote] = useState("");
  const [restoreSubscription, setRestoreSubscription] = useState(false);
  const [loading, setLoading] = useState(false);

  const availableModes = useMemo(() => {
    return [modes.ACKNOWLEDGED, modes.RESOLVED, modes.OPEN].filter((item) => item.status !== reviewStatus);
  }, [reviewStatus]);

  function openDialog(nextMode: RiskReviewMode) {
    setMode(nextMode);
    setNote("");
    setRestoreSubscription(nextMode.status === "RESOLVED" && canRestoreSubscription);
  }

  async function submit() {
    if (!mode) return;

    setLoading(true);
    try {
      await updateSubscriptionRiskReview(eventId, mode.status, note, {
        restoreSubscription: mode.status === "RESOLVED" && restoreSubscription,
      });
      toast.success("风控事件已更新");
      setMode(null);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "更新风控事件失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {availableModes.map((item) => (
          <Button
            key={item.status}
            size="sm"
            variant={item.status === "RESOLVED" ? "default" : "outline"}
            onClick={() => openDialog(item)}
          >
            <ModeIcon icon={item.icon} />
            {item.label}
          </Button>
        ))}
      </div>

      <Dialog open={mode != null} onOpenChange={(open) => !loading && !open && setMode(null)}>
        <DialogContent className="sm:max-w-lg">
          {mode && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  <ModeIcon icon={mode.icon} />
                </div>
                <DialogTitle>{mode.title}</DialogTitle>
                <DialogDescription>{mode.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`risk-note-${eventId}`}>处理备注</Label>
                  <Textarea
                    id={`risk-note-${eventId}`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    placeholder="例如：已联系用户确认是出差；或确认订阅链接外泄，已重置/暂停处理。"
                  />
                </div>

                {mode.status === "RESOLVED" && canRestoreSubscription && (
                  <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={restoreSubscription}
                      onChange={(event) => setRestoreSubscription(event.target.checked)}
                    />
                    <span>
                      同时恢复这个已暂停订阅
                      <span className="block text-xs text-muted-foreground">
                        会同步重新启用 3x-ui 客户端；如果远端面板失败，事件不会被误标记为已解决。
                      </span>
                    </span>
                  </label>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMode(null)} disabled={loading}>
                  先不处理
                </Button>
                <Button type="button" onClick={() => void submit()} disabled={loading}>
                  {loading ? "保存中..." : mode.label}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
