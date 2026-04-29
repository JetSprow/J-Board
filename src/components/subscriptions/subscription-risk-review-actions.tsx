"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  SubscriptionRiskFinalAction,
  SubscriptionRiskReviewStatus,
} from "@prisma/client";
import {
  FileText,
  LockKeyhole,
  RotateCcw,
  Send,
  ShieldCheck,
  UnlockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import {
  finalizeSubscriptionRiskDecision,
  generateSubscriptionRiskReport,
  sendSubscriptionRiskReport,
  updateSubscriptionRiskReview,
} from "@/actions/admin/subscription-risk";
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
  icon: "ack" | "open";
}

const modes: Record<"OPEN" | "ACKNOWLEDGED", RiskReviewMode> = {
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
    description: "适合先记录已看到、正在核查，暂不解除或关闭事件。",
    icon: "ack",
  },
};

type DialogState =
  | { type: "review"; mode: RiskReviewMode }
  | { type: "final"; action: SubscriptionRiskFinalAction }
  | { type: "report" }
  | null;

function ModeIcon({ icon }: { icon: RiskReviewMode["icon"] }) {
  if (icon === "open") return <RotateCcw className="size-4" />;
  return <ShieldCheck className="size-4" />;
}

function finalActionCopy(action: SubscriptionRiskFinalAction, restorableSubscriptionCount: number) {
  if (action === "RESTORE_ACCESS") {
    return {
      icon: <UnlockKeyhole className="size-4" />,
      label: "解除限制",
      title: "确认解除风控限制？",
      description: restorableSubscriptionCount > 0
        ? "会恢复可恢复的暂停订阅，并关闭用户端强制通知。"
        : "会关闭用户端强制通知，并把事件记录为已解除；当前没有可自动恢复的暂停订阅。",
      confirm: "确认解除",
    };
  }

  return {
    icon: <LockKeyhole className="size-4" />,
    label: "保持封禁/暂停",
    title: "确认保持封禁或暂停？",
    description: "订阅和用户限制会维持当前处置，适合确认订阅链接外泄、公共代理滥用或用户无法解释异常访问来源的情况。",
    confirm: "保持限制",
  };
}

export function SubscriptionRiskReviewActions({
  eventId,
  reviewStatus,
  canRestoreSubscription = false,
  restorableSubscriptionCount = 0,
  riskReport = null,
  reportSentAt = null,
  userRestrictionActive = false,
  finalAction = null,
}: {
  eventId: string;
  reviewStatus: SubscriptionRiskReviewStatus;
  canRestoreSubscription?: boolean;
  restorableSubscriptionCount?: number;
  riskReport?: string | null;
  reportSentAt?: Date | string | null;
  userRestrictionActive?: boolean;
  finalAction?: SubscriptionRiskFinalAction | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [note, setNote] = useState("");
  const [notifyUser, setNotifyUser] = useState(Boolean(reportSentAt || userRestrictionActive));
  const [reportPreview, setReportPreview] = useState(riskReport ?? "");
  const [pending, startTransition] = useTransition();

  const availableModes = useMemo(() => {
    return [modes.ACKNOWLEDGED, modes.OPEN].filter((item) => item.status !== reviewStatus);
  }, [reviewStatus]);

  const activeFinalCopy = dialog?.type === "final"
    ? finalActionCopy(dialog.action, restorableSubscriptionCount)
    : null;

  function openReviewDialog(mode: RiskReviewMode) {
    setDialog({ type: "review", mode });
    setNote("");
  }

  function openFinalDialog(action: SubscriptionRiskFinalAction) {
    setDialog({ type: "final", action });
    setNote("");
    setNotifyUser(action === "KEEP_RESTRICTED" ? true : Boolean(reportSentAt || userRestrictionActive));
  }

  function handleGenerateReport(openAfterGenerate = true) {
    startTransition(async () => {
      try {
        const result = await generateSubscriptionRiskReport(eventId);
        setReportPreview(result.report);
        toast.success("风险报告已生成");
        if (openAfterGenerate) setDialog({ type: "report" });
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "生成风险报告失败"));
      }
    });
  }

  function handleSendReport() {
    startTransition(async () => {
      try {
        await sendSubscriptionRiskReport(eventId);
        toast.success("已发送用户端强制通知");
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "发送用户通知失败"));
      }
    });
  }

  function submitReview() {
    if (dialog?.type !== "review") return;

    startTransition(async () => {
      try {
        await updateSubscriptionRiskReview(eventId, dialog.mode.status, note);
        toast.success("风控事件已更新");
        setDialog(null);
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "更新风控事件失败"));
      }
    });
  }

  function submitFinalDecision() {
    if (dialog?.type !== "final") return;

    startTransition(async () => {
      try {
        await finalizeSubscriptionRiskDecision(eventId, dialog.action, note, {
          notifyUser: dialog.action === "KEEP_RESTRICTED" && notifyUser,
        });
        toast.success(dialog.action === "RESTORE_ACCESS" ? "已解除限制" : "已保持限制并记录处置");
        setDialog(null);
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error, "保存最终处置失败"));
      }
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">风险报告</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={() => handleGenerateReport(true)}>
              <FileText className="size-4" />
              {reportPreview ? "重生成" : "生成报告"}
            </Button>
            {reportPreview && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDialog({ type: "report" })}>
                查看报告
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={pending} onClick={handleSendReport} className={reportPreview ? "sm:col-span-2 xl:col-span-1 2xl:col-span-2" : ""}>
              <Send className="size-4" />
              {reportSentAt ? "重新发送用户" : "发送用户"}
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground">最终处置</p>
          <div className="grid gap-2">
            <Button
              size="sm"
              variant={canRestoreSubscription || userRestrictionActive ? "default" : "outline"}
              disabled={pending || (!canRestoreSubscription && !userRestrictionActive && reviewStatus === "RESOLVED")}
              onClick={() => openFinalDialog("RESTORE_ACCESS")}
              className="justify-start"
            >
              <UnlockKeyhole className="size-4" />
              解除限制
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending || finalAction === "KEEP_RESTRICTED"}
              onClick={() => openFinalDialog("KEEP_RESTRICTED")}
              className="justify-start"
            >
              <LockKeyhole className="size-4" />
              保持封禁/暂停
            </Button>
          </div>
        </div>

        {availableModes.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-xs font-medium text-muted-foreground">队列状态</p>
            <div className="flex flex-wrap gap-2">
              {availableModes.map((item) => (
                <Button
                  key={item.status}
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => openReviewDialog(item)}
                >
                  <ModeIcon icon={item.icon} />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialog != null} onOpenChange={(open) => !pending && !open && setDialog(null)}>
        <DialogContent className={dialog?.type === "report" ? "sm:max-w-3xl" : "sm:max-w-lg"}>
          {dialog?.type === "review" && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  <ModeIcon icon={dialog.mode.icon} />
                </div>
                <DialogTitle>{dialog.mode.title}</DialogTitle>
                <DialogDescription>{dialog.mode.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor={"risk-note-" + eventId}>处理备注</Label>
                <Textarea
                  id={"risk-note-" + eventId}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={1000}
                  placeholder="例如：已联系用户确认是出差；或确认订阅链接外泄，继续限制。"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                  先不处理
                </Button>
                <Button type="button" onClick={submitReview} disabled={pending}>
                  {pending ? "保存中..." : dialog.mode.label}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog?.type === "final" && activeFinalCopy && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  {activeFinalCopy.icon}
                </div>
                <DialogTitle>{activeFinalCopy.title}</DialogTitle>
                <DialogDescription>{activeFinalCopy.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {dialog.action === "RESTORE_ACCESS" && restorableSubscriptionCount > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm leading-6 text-primary">
                    将尝试恢复 {restorableSubscriptionCount} 个仍在有效期内的暂停代理订阅。
                  </div>
                )}
                {dialog.action === "KEEP_RESTRICTED" && (
                  <label className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm leading-6">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={notifyUser}
                      onChange={(event) => setNotifyUser(event.target.checked)}
                    />
                    <span>
                      同时发送用户端强制通知
                      <span className="block text-xs text-muted-foreground">
                        用户会看到全屏不可关闭说明，只能进入工单页面联系客服。
                      </span>
                    </span>
                  </label>
                )}
                <div className="space-y-2">
                  <Label htmlFor={"risk-final-note-" + eventId}>最终处理备注</Label>
                  <Textarea
                    id={"risk-final-note-" + eventId}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    placeholder="记录最终判断依据，例如：用户提交工单证明为本人出差；或确认链接被多人共享，保持限制。"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                  返回
                </Button>
                <Button
                  type="button"
                  variant={dialog.action === "KEEP_RESTRICTED" ? "destructive" : "default"}
                  onClick={submitFinalDecision}
                  disabled={pending}
                >
                  {pending ? "保存中..." : activeFinalCopy.confirm}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog?.type === "report" && (
            <>
              <DialogHeader>
                <div className="mb-1 flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </div>
                <DialogTitle>风险报告总结</DialogTitle>
                <DialogDescription>
                  可作为人工复核依据，也可以发送给用户端形成强制通知。
                </DialogDescription>
              </DialogHeader>
              <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/30 p-4 text-xs leading-6 text-foreground">
                {reportPreview || "尚未生成风险报告。"}
              </pre>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={pending}>
                  关闭
                </Button>
                <Button type="button" variant="outline" onClick={() => handleGenerateReport(false)} disabled={pending}>
                  {pending ? "生成中..." : "重新生成"}
                </Button>
                <Button type="button" onClick={handleSendReport} disabled={pending}>
                  <Send className="size-4" />
                  发送用户
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
