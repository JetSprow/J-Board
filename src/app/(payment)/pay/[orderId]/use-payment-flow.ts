"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { cancelOwnPendingOrder, resetOwnPendingPaymentChoice } from "@/actions/user/orders";
import { fetchJson } from "@/lib/fetch-json";
import { getErrorMessage } from "@/lib/errors";
import { getOrderStatusLabel } from "@/lib/domain-labels";
import type {
  OrderPaymentSnapshot,
  PaymentInfo,
  PaymentPageStatus,
  PaymentProvider,
  PaymentQueryResult,
} from "./payment-types";

const orderStatusLabel: Record<PaymentQueryResult["status"], string> = {
  pending: "等待支付确认",
  paid: "支付成功",
  cancelled: "订单已取消",
  refunded: "订单已退款",
  processing_failed: "支付已确认，但开通失败",
};

function isSafePaymentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

interface CreatePaymentOptions {
  redirectToGateway?: boolean;
  silent?: boolean;
  channel?: string;
}

export function usePaymentFlow(orderId: string) {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [status, setStatus] = useState<PaymentPageStatus>("booting");
  const [pageError, setPageError] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => (selectedIdx >= 0 ? providers[selectedIdx] : null),
    [providers, selectedIdx],
  );

  async function createOrRestorePayment(
    provider: string,
    options?: CreatePaymentOptions,
  ) {
    setPageError(null);
    setStatus("creating");

    try {
      const data = await fetchJson<PaymentInfo>("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, provider, channel: options?.channel }),
      });

      setPayment(data);
      setStatus("waiting");

      if (
        data.paymentUrl
        && provider === "epay"
        && options?.redirectToGateway !== false
        && isSafePaymentUrl(data.paymentUrl)
      ) {
        window.location.href = data.paymentUrl;
      }
    } catch (error) {
      const message = getErrorMessage(error, "支付方式暂时无法使用");
      setPageError(message);
      setStatus("idle");
      if (!options?.silent) {
        console.error(`[pay/${orderId}] ${message}`);
      }
    }
  }

  const loadPageState = useEffectEvent(async () => {
    try {
      const [providerList, order] = await Promise.all([
        fetchJson<PaymentProvider[]>("/api/payment/providers"),
        fetchJson<OrderPaymentSnapshot>(`/api/payment/order/${orderId}`),
      ]);

      setProviders(providerList);

      if (order.status === "PAID") {
        setStatus("paid");
        setPageError(null);
        return;
      }

      let defaultIdx = -1;
      if (order.paymentMethod) {
        defaultIdx = providerList.findIndex((provider) => provider.provider === order.paymentMethod);
      } else if (providerList.length === 1) {
        defaultIdx = 0;
      }
      setSelectedIdx(defaultIdx);

      if (order.note?.startsWith("Provision failed: ")) {
        setPageError(order.note.replace(/^Provision failed:\s*/, ""));
      }

      if (order.status !== "PENDING") {
        setStatus("idle");
        setPageError(`这笔订单当前为${getOrderStatusLabel(order.status)}，无法继续支付。`);
        return;
      }

      if (!order.paymentMethod || !order.tradeNo) {
        setPayment(null);
        setStatus("idle");
        return;
      }

      if (order.paymentMethod === "epay") {
        setPayment({
          tradeNo: order.tradeNo,
          paymentUrl: order.paymentUrl ?? undefined,
        });
        setStatus("waiting");
        return;
      }

      await createOrRestorePayment(order.paymentMethod, {
        redirectToGateway: false,
        silent: true,
        channel: providerList[defaultIdx]?.channel,
      });
    } catch (error) {
      setPageError(getErrorMessage(error, "加载支付信息失败"));
      setStatus("idle");
    }
  });

  const pollPaymentStatus = useEffectEvent(async () => {
    if (!payment?.tradeNo) return;

    try {
      const result = await fetchJson<PaymentQueryResult>(
        `/api/payment/query/${payment.tradeNo}`,
      );

      if (result.status === "paid") {
        setPageError(null);
        setStatus("paid");
        return;
      }

      if (result.status === "pending") {
        return;
      }

      setStatus("idle");
      setPageError(
        result.error || `订单状态更新：${orderStatusLabel[result.status] ?? "未知状态"}`,
      );
    } catch (error) {
      setStatus("idle");
      setPageError(getErrorMessage(error, "查询支付状态失败"));
    }
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPageState();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [orderId]);

  useEffect(() => {
    if (status !== "waiting" || !payment?.tradeNo) return;

    const initialTimer = window.setTimeout(() => {
      void pollPaymentStatus();
    }, 0);
    const interval = setInterval(() => {
      void pollPaymentStatus();
    }, 5000);

    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [payment?.tradeNo, status]);

  function startSelectedPayment() {
    if (!selectedProvider) return;
    void createOrRestorePayment(selectedProvider.provider, {
      channel: selectedProvider.channel,
    });
  }

  async function resetPaymentChoice() {
    await resetOwnPendingPaymentChoice(orderId);
    setPayment(null);
    setStatus("idle");
    setPageError(null);
    setSelectedIdx(providers.length === 1 ? 0 : -1);
  }

  async function cancelOrder() {
    await cancelOwnPendingOrder(orderId);
    setPayment(null);
    setStatus("idle");
    setPageError("订单已取消。你可以回到商店重新选择。");
  }

  return {
    providers,
    selectedIdx,
    setSelectedIdx,
    selectedProvider,
    payment,
    status,
    pageError,
    startSelectedPayment,
    resetPaymentChoice,
    cancelOrder,
  };
}
