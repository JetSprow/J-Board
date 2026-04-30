import { z } from "zod";
import { decryptIfEncrypted, encrypt, isEncryptedValue } from "@/lib/crypto";

export interface PaymentConfigField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  type?: "text" | "checkboxes";
  options?: { value: string; label: string }[];
}

export interface PaymentProviderDefinition {
  id: string;
  name: string;
  description: string;
  fields: PaymentConfigField[];
}

const displayNameField = z.string().trim().optional().transform((v) => v ?? "");

const epaySchema = z.object({
  displayName: displayNameField,
  apiUrl: z.url("API 地址格式不正确"),
  pid: z.string().trim().min(1, "商户 ID 不能为空"),
  key: z.string().trim().min(1, "商户密钥不能为空"),
  channels: z.string().trim().optional().transform((v) => v ?? "alipay,wxpay"),
});

const alipayF2fSchema = z.object({
  displayName: displayNameField,
  appId: z.string().trim().min(1, "App ID 不能为空"),
  privateKey: z.string().trim().min(1, "应用私钥不能为空"),
  alipayPublicKey: z.string().trim().min(1, "支付宝公钥不能为空"),
  gateway: z.url("网关地址格式不正确"),
});

const usdtTrc20Schema = z.object({
  displayName: displayNameField,
  walletAddress: z.string().trim().min(1, "收款钱包地址不能为空"),
  exchangeRate: z.coerce.number().positive("汇率必须大于 0"),
  tronApiKey: z.string().trim().optional().transform((v) => v ?? ""),
  tronApiUrl: z
    .union([z.url("Tron API 地址格式不正确"), z.literal("")])
    .optional()
    .transform((value) => value ?? ""),
});

const paymentConfigSchemas = {
  epay: epaySchema,
  alipay_f2f: alipayF2fSchema,
  usdt_trc20: usdtTrc20Schema,
} as const;

export const PAYMENT_PROVIDER_DEFINITIONS: PaymentProviderDefinition[] = [
  {
    id: "epay",
    name: "易支付",
    description: "支持支付宝/微信，通过第三方易支付平台",
    fields: [
      { key: "displayName", label: "用户端显示名称", placeholder: "留空则用默认名" },
      { key: "apiUrl", label: "API 地址", placeholder: "https://pay.example.com" },
      { key: "pid", label: "商户 ID", placeholder: "1001" },
      { key: "key", label: "商户密钥", placeholder: "your-secret-key", secret: true },
      {
        key: "channels",
        label: "启用的支付渠道",
        type: "checkboxes",
        options: [
          { value: "alipay", label: "支付宝" },
          { value: "wxpay", label: "微信支付" },
        ],
      },
    ],
  },
  {
    id: "alipay_f2f",
    name: "支付宝当面付",
    description: "支付宝官方当面付，用户扫码支付",
    fields: [
      { key: "displayName", label: "用户端显示名称", placeholder: "例如：支付宝扫码" },
      { key: "appId", label: "App ID", placeholder: "2021..." },
      { key: "privateKey", label: "应用私钥", placeholder: "MIIEvQ...", secret: true },
      { key: "alipayPublicKey", label: "支付宝公钥", placeholder: "MIIBIj...", secret: true },
      { key: "gateway", label: "网关地址", placeholder: "https://openapi.alipay.com/gateway.do" },
    ],
  },
  {
    id: "usdt_trc20",
    name: "USDT (TRC20)",
    description: "加密货币支付，监听 TRC20 链上转账",
    fields: [
      { key: "displayName", label: "用户端显示名称", placeholder: "例如：USDT 转账" },
      { key: "walletAddress", label: "收款钱包地址", placeholder: "T..." },
      { key: "exchangeRate", label: "汇率 (1 USDT = ¥?)", placeholder: "7.2" },
      { key: "tronApiKey", label: "TronGrid API Key", placeholder: "免费注册: trongrid.io", secret: true },
      { key: "tronApiUrl", label: "Tron API (可选)", placeholder: "https://api.trongrid.io" },
    ],
  },
];

function normalizeConfig(config: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : String(value ?? ""),
    ]),
  );
}

function getSecretFieldKeys(provider: string) {
  return new Set(
    (getPaymentProviderDefinition(provider)?.fields ?? [])
      .filter((field) => field.secret)
      .map((field) => field.key),
  );
}

export function decryptPaymentConfigForUse(
  provider: string,
  config: Record<string, unknown>,
): Record<string, string> {
  const normalized = normalizeConfig(config);
  const secretKeys = getSecretFieldKeys(provider);

  for (const key of secretKeys) {
    if (normalized[key]) {
      normalized[key] = decryptIfEncrypted(normalized[key]);
    }
  }

  return normalized;
}

export function preparePaymentConfigForStorage(
  provider: string,
  incomingConfig: Record<string, unknown>,
  currentConfig?: Record<string, unknown> | null,
): Record<string, string> {
  const normalized = normalizeConfig(incomingConfig);
  const current = currentConfig ? normalizeConfig(currentConfig) : {};
  const secretKeys = getSecretFieldKeys(provider);

  for (const key of secretKeys) {
    const nextSecret = normalized[key]?.trim();
    const currentSecret = current[key]?.trim();

    if (nextSecret) {
      normalized[key] = encrypt(nextSecret);
    } else if (currentSecret) {
      normalized[key] = isEncryptedValue(currentSecret) ? currentSecret : encrypt(currentSecret);
    } else {
      normalized[key] = "";
    }
  }

  return normalized;
}

export function redactPaymentConfigForClient(
  provider: string,
  config: Record<string, unknown>,
): Record<string, string> {
  const normalized = normalizeConfig(config);
  for (const key of getSecretFieldKeys(provider)) {
    normalized[key] = "";
  }
  return normalized;
}

export function getPaymentSecretConfiguredState(
  provider: string,
  config: Record<string, unknown>,
): Record<string, boolean> {
  const normalized = normalizeConfig(config);
  const result: Record<string, boolean> = {};
  for (const key of getSecretFieldKeys(provider)) {
    result[key] = Boolean(normalized[key]);
  }
  return result;
}

export function getPaymentProviderDefinition(provider: string) {
  return PAYMENT_PROVIDER_DEFINITIONS.find((item) => item.id === provider) ?? null;
}

export function getPaymentProviderName(provider: string): string {
  return getPaymentProviderDefinition(provider)?.name ?? provider;
}

export function normalizePaymentConfig(config: Record<string, unknown>) {
  return normalizeConfig(config);
}

export function parsePaymentConfig(
  provider: string,
  config: Record<string, unknown>,
) {
  const normalized = normalizeConfig(config);
  const schema = paymentConfigSchemas[provider as keyof typeof paymentConfigSchemas];

  if (!schema) {
    throw new Error("未知支付方式");
  }

  return schema.parse(normalized);
}
