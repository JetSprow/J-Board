"use client";

import { useState } from "react";
import { toast } from "sonner";
import { queryPlanNextAvailability } from "@/actions/user/purchase";
import { getErrorMessage } from "@/lib/errors";

export function usePlanAvailabilityCheck(planId: string) {
  const [checking, setChecking] = useState(false);

  async function checkAvailability() {
    setChecking(true);
    try {
      const result = await queryPlanNextAvailability(planId);
      if (result.available) {
        toast.success("这款套餐现在可以购买");
      } else {
        toast.error(getErrorMessage(result.message, "这款套餐暂时不可购买"));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "暂时无法确认补位时间"));
    } finally {
      setChecking(false);
    }
  }

  return { checking, checkAvailability };
}
