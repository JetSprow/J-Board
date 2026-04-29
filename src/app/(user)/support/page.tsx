import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/services/app-config";
import { reasonLabel } from "@/services/subscription-risk-review";
import { CreateSupportTicketForm } from "./_components/create-support-ticket-form";
import { UserSupportTicketTable } from "./_components/user-support-ticket-table";
import { getUserOpenSupportTicketCount, getUserSupportTickets } from "./support-data";

export const metadata: Metadata = {
  title: "工单售后",
  description: "提交问题并跟踪工单处理进度。",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = await searchParams;
  const riskEventId = typeof resolvedSearchParams.riskEventId === "string" ? resolvedSearchParams.riskEventId : "";
  const [tickets, openTicketCount, config, riskEvent] = await Promise.all([
    getUserSupportTickets(session!.user.id),
    getUserOpenSupportTicketCount(session!.user.id),
    getAppConfig(),
    riskEventId
      ? prisma.subscriptionRiskEvent.findFirst({
          where: {
            id: riskEventId,
            userId: session!.user.id,
            reportSentAt: { not: null },
          },
          select: {
            id: true,
            reason: true,
            message: true,
            createdAt: true,
          },
        })
      : Promise.resolve(null),
  ]);
  const preset = riskEvent
    ? {
        riskEventId: riskEvent.id,
        subject: "订阅风控复核申请",
        category: "订阅风控",
        priority: "HIGH" as const,
        body: "我需要复核订阅风控限制。\n\n请在这里补充：近期访问订阅的设备、所在城市/国家、是否出差或旅行、是否曾分享订阅链接。\n\n系统判定：" + reasonLabel(riskEvent.reason) + "\n" + riskEvent.message,
      }
    : undefined;

  return (
    <PageShell>
      <PageHeader
        eyebrow="工单售后"
        title="需要帮助？"
      />

      <CreateSupportTicketForm
        defaultOpen={Boolean(preset)}
        openTicketCount={openTicketCount}
        openTicketLimit={config.supportOpenTicketLimit}
        preset={preset}
      />
      <UserSupportTicketTable tickets={tickets} />
    </PageShell>
  );
}
