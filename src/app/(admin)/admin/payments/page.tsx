import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PaymentConfigItem } from "./config-form";
import { getPaymentProviderConfigs } from "./payments-data";

export const metadata: Metadata = {
  title: "支付配置",
  description: "配置支付渠道、密钥与启用状态。",
};

export default async function PaymentsPage() {
  const providerConfigs = await getPaymentProviderConfigs();

  return (
    <PageShell>
      <PageHeader
        eyebrow="系统"
        title="支付配置"
      />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {providerConfigs.map(({ provider, config, secretConfigured }) => (
          <PaymentConfigItem
            key={provider.id}
            providerName={provider.name}
            providerDescription={provider.description}
            provider={provider.id}
            fields={provider.fields}
            currentConfig={config?.config}
            secretConfigured={secretConfigured}
            enabled={config?.enabled ?? false}
          />
        ))}
      </div>
    </PageShell>
  );
}
