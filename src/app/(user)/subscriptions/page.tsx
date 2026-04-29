import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import {
  getActiveSubscriptions,
  getHistorySubscriptions,
} from "./subscriptions-calculations";
import {
  getSubscriptionBaseUrl,
  getTrafficPoolMap,
  getUserSubscriptions,
} from "./subscriptions-data";
import { ActiveSubscriptionsSection } from "./_components/active-subscriptions-section";
import { HistorySubscriptionsSection } from "./_components/history-subscriptions-section";
import { SubscriptionMetrics } from "./_components/subscription-metrics";
import { getAggregateSubscriptionToken } from "@/services/subscription";

export const metadata: Metadata = {
  title: "我的订阅",
  description: "管理活跃订阅，并复制适配 Clash 与通用客户端的订阅 URL。",
};

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions);
  const [subs, baseUrl] = await Promise.all([
    getUserSubscriptions(session!.user.id),
    getSubscriptionBaseUrl(),
  ]);
  const activeSubs = getActiveSubscriptions(subs);
  const historySubs = getHistorySubscriptions(subs);
  const poolMap = await getTrafficPoolMap(subs);
  const aggregateSubscriptionUrl = baseUrl
    ? `${baseUrl}/api/subscription/all?userId=${encodeURIComponent(session!.user.id)}&token=${encodeURIComponent(getAggregateSubscriptionToken(session!.user.id))}`
    : null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="订阅管理"
        title="我的订阅"
        description="总订阅链接负责导入全部代理节点；复制 Clash 或通用订阅 URL 后粘贴到客户端。"
      />

      <SubscriptionMetrics
        activeCount={activeSubs.length}
        historyCount={historySubs.length}
        totalCount={subs.length}
      />

      <ActiveSubscriptionsSection
        subscriptions={activeSubs}
        aggregateSubscriptionUrl={aggregateSubscriptionUrl}
        poolMap={poolMap}
      />
      <HistorySubscriptionsSection subscriptions={historySubs} />
    </PageShell>
  );
}
