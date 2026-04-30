"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import {
  decryptPaymentConfigForUse,
  getPaymentProviderName,
  normalizePaymentConfig,
  parsePaymentConfig,
  preparePaymentConfigForStorage,
} from "@/services/payment/catalog";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { z } from "zod";

export async function savePaymentConfig(
  provider: string,
  config: Record<string, string>,
  enabled: boolean
) {
  const session = await requireAdmin();

  const normalizedConfig = normalizePaymentConfig(config);
  const current = await prisma.paymentConfig.findUnique({
    where: { provider },
    select: { config: true },
  });
  const storageConfig = preparePaymentConfigForStorage(
    provider,
    normalizedConfig,
    current?.config as Record<string, unknown> | undefined,
  );

  if (enabled) {
    try {
      parsePaymentConfig(provider, decryptPaymentConfigForUse(provider, storageConfig));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues.map((e) => e.message).join("；");
        throw new Error(messages);
      }
      throw error;
    }
  }

  const jsonConfig = JSON.parse(JSON.stringify(storageConfig));

  await prisma.paymentConfig.upsert({
    where: { provider },
    create: { provider, config: jsonConfig, enabled },
    update: { config: jsonConfig, enabled },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "payment.config",
    targetType: "PaymentConfig",
    targetId: provider,
    targetLabel: getPaymentProviderName(provider),
    message: `${enabled ? "启用并更新" : "更新"}支付配置 ${getPaymentProviderName(provider)}`,
  });
  revalidatePath("/admin/payments");
}
