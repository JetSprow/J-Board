import { prisma } from "@/lib/prisma";
import type { PaymentAdapter } from "./adapter";
import { EasyPayAdapter, type EasyPayConfig } from "./epay";
import { AlipayF2FAdapter, type AlipayF2FConfig } from "./alipay-f2f";
import { UsdtTrc20Adapter, type UsdtTrc20Config } from "./usdt-trc20";
import {
  decryptPaymentConfigForUse,
  getPaymentProviderName,
  parsePaymentConfig,
} from "./catalog";

export async function getPaymentAdapter(provider: string): Promise<PaymentAdapter> {
  // epay_alipay / epay_wxpay both use the epay adapter
  const realProvider = provider.startsWith("epay") ? "epay" : provider;

  const config = await prisma.paymentConfig.findUnique({
    where: { provider: realProvider },
  });

  if (!config || !config.enabled) {
    throw new Error(`${getPaymentProviderName(realProvider)}未配置或未启用`);
  }

  const cfg = parsePaymentConfig(
    realProvider,
    decryptPaymentConfigForUse(realProvider, config.config as Record<string, unknown>),
  );

  switch (realProvider) {
    case "epay":
      return new EasyPayAdapter(cfg as EasyPayConfig);
    case "alipay_f2f":
      return new AlipayF2FAdapter(cfg as AlipayF2FConfig);
    case "usdt_trc20":
      return new UsdtTrc20Adapter(cfg as UsdtTrc20Config);
    default:
      throw new Error("未知支付方式");
  }
}

export interface EnabledProvider {
  provider: string;
  name: string;
  channel?: string;
}

export async function getEnabledProviders(): Promise<EnabledProvider[]> {
  const configs = await prisma.paymentConfig.findMany({
    where: { enabled: true },
    select: { provider: true, config: true },
  });

  const result: EnabledProvider[] = [];

  for (const c of configs) {
    const cfg = c.config as Record<string, string> | null;

    if (c.provider === "epay") {
      // Read admin-configured channels (default: both)
      const channelsStr = cfg?.channels || "alipay,wxpay";
      const channels = channelsStr.split(",").map((s) => s.trim()).filter(Boolean);
      const displayName = cfg?.displayName || "";

      const channelLabels: Record<string, string> = {
        alipay: "支付宝",
        wxpay: "微信支付",
      };

      for (const ch of channels) {
        const defaultLabel = channelLabels[ch] ?? ch;
        const name = displayName
          ? channels.length > 1 ? `${displayName} (${defaultLabel})` : displayName
          : defaultLabel;
        result.push({ provider: "epay", name, channel: ch });
      }
    } else {
      result.push({
        provider: c.provider,
        name: cfg?.displayName || getPaymentProviderName(c.provider),
      });
    }
  }

  return result;
}
