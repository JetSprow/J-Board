import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { SubscriptionDetailCards } from "@/components/subscriptions/subscription-detail-cards";
import { SubscriptionTimelineSection } from "@/components/subscriptions/subscription-timeline-section";
import { TrafficLogList } from "@/components/subscriptions/traffic-log-list";
import { getAdminSubscriptionDetail } from "./subscription-detail-data";
import { AdminSubscriptionActions } from "../subscription-actions";
import { SubscriptionAccessRiskSection } from "./_components/subscription-access-risk-section";

export const metadata: Metadata = {
  title: "订阅详情",
  description: "查看订阅生命周期、资源绑定和流量日志。",
};

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAdminSubscriptionDetail(id);

  if (!data) {
    notFound();
  }

  const { subscription, auditLogs, trafficLogs, accessLogs, riskEvents, streamingServices } = data;

  return (
    <PageShell>
      <PageHeader
        eyebrow="订阅详情"
        title={subscription.plan.name}
        description={subscription.user.email}
        actions={
          <AdminSubscriptionActions
            subscriptionId={subscription.id}
            status={subscription.status}
            type={subscription.plan.type}
            streamingServices={streamingServices}
          />
        }
      />
      <SubscriptionDetailCards subscription={subscription} showClientEmail />
      <SubscriptionAccessRiskSection
        accessLogs={accessLogs}
        riskEvents={riskEvents}
        owner={subscription.user}
        subscription={subscription}
      />
      <SubscriptionTimelineSection logs={auditLogs} />
      <TrafficLogList logs={trafficLogs} />
    </PageShell>
  );
}
