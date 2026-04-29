"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { deletePlanPermanently, togglePlan } from "@/actions/admin/plans";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import {
  PlanForm,
  type PlanFormValue,
  type StreamingServiceOption,
} from "./plan-form";

export function PlanActions({
  plan,
  isActive,
  services,
}: {
  plan: PlanFormValue;
  isActive: boolean;
  services: StreamingServiceOption[];
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PlanForm
        plan={plan}
        services={services}
        triggerLabel="编辑"
        triggerVariant="outline"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await togglePlan(plan.id, !isActive);
            toast.success(isActive ? "套餐已下架" : "套餐已上架");
            router.refresh();
          } catch (error) {
            toast.error(getErrorMessage(error, "切换套餐上下架状态失败"));
          }
        }}
      >
        {isActive ? "下架" : "上架"}
      </Button>
      <ConfirmActionButton
        variant="destructive"
        size="sm"
        title="彻底删除套餐？"
        description="关联订阅、本地订单记录和可同步的独占入口会一起处理。此操作无法恢复。"
        confirmLabel="删除套餐"
        successMessage="套餐已删除"
        errorMessage="删除失败"
        onConfirm={() => deletePlanPermanently(plan.id)}
        onSuccess={() => router.refresh()}
      >
        删除
      </ConfirmActionButton>
    </div>
  );
}
