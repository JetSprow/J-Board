import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import type { StreamingServiceOption } from "./plan-form";

const planInclude = {
  node: true,
  inbound: true,
  streamingService: true,
  inboundOptions: {
    include: {
      inbound: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  _count: { select: { subscriptions: true } },
} satisfies Prisma.SubscriptionPlanInclude;

export type AdminPlanRow = Prisma.SubscriptionPlanGetPayload<{
  include: typeof planInclude;
}>;

export async function getAdminPlans(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const type = typeof searchParams.type === "string" ? searchParams.type : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(type ? { type: type as "PROXY" | "STREAMING" } : {}),
    ...(status ? { isActive: status === "active" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.SubscriptionPlanWhereInput;

  const [plans, total, services, activeGroups] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.subscriptionPlan.count({ where }),
    prisma.streamingService.findMany({
      where: { isActive: true },
      select: { id: true, name: true, usedSlots: true, maxSlots: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userSubscription.groupBy({
      by: ["planId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  const activeCountMap = new Map(
    activeGroups.map((item) => [item.planId, item._count._all]),
  );
  const serviceOptions: StreamingServiceOption[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    usedSlots: service.usedSlots,
    maxSlots: service.maxSlots,
  }));
  return {
    plans,
    total,
    page,
    pageSize,
    filters: { q, type, status },
    activeCountMap,
    serviceOptions,
  };
}
