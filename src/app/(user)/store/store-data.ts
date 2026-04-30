import { prisma } from "@/lib/prisma";
import { normalizeTraceText } from "@/lib/trace-normalize";
import { getPlanAvailability, type PlanAvailability } from "@/services/plan-availability";
import { getLatencyRecommendations } from "@/services/latency-recommendations";
import { getAppConfig } from "@/services/app-config";

export async function getStorePageData(userId?: string) {
  const [config, plans, pendingOrder] = await Promise.all([
    getAppConfig(),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        node: true,
        inbound: true,
        streamingService: true,
        inboundOptions: {
          include: { inbound: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    userId
      ? prisma.order.findFirst({
          where: { userId, status: "PENDING" },
          include: { plan: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : null,
  ]);
  const latencyRecommendations = config.networkInsightsEnabled
    ? await getLatencyRecommendations()
    : [];

  const availabilityMap = new Map<string, PlanAvailability>();
  await Promise.all(
    plans.map(async (plan) => {
      const availability = await getPlanAvailability(plan, { userId });
      availabilityMap.set(plan.id, availability);
    }),
  );

  return {
    plans,
    availabilityMap,
    networkInsightsEnabled: config.networkInsightsEnabled,
    latencyRecommendations,
    pendingOrder: pendingOrder
      ? {
          id: pendingOrder.id,
          amount: Number(pendingOrder.amount),
          planName: normalizeTraceText(pendingOrder.plan.name),
          createdAt: pendingOrder.createdAt.toISOString(),
        }
      : null,
  };
}
