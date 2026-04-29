import type { Prisma, SubscriptionRiskEvent, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import {
  buildSubscriptionRiskGeoSummary,
  getSubscriptionRiskAccessLogsForEvent,
  type SubscriptionRiskGeoSummary,
} from "@/services/subscription-risk-review";

type RiskUser = {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
};

type RiskSubscription = {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED";
  endDate: Date;
  plan: {
    name: string;
    type: "PROXY" | "STREAMING";
  };
  user: RiskUser;
};

export type SubscriptionRiskEventRow = SubscriptionRiskEvent & {
  user: RiskUser | null;
  subscription: RiskSubscription | null;
  canRestoreSubscription: boolean;
  restorableSubscriptionCount: number;
  geoSummary: SubscriptionRiskGeoSummary;
};

async function searchRelatedIds(q: string) {
  if (!q) return { userIds: [] as string[], subscriptionIds: [] as string[] };

  const [users, subscriptions] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
        ],
      },
      select: { id: true },
      take: 100,
    }),
    prisma.userSubscription.findMany({
      where: {
        OR: [
          { id: q },
          { user: { email: { contains: q } } },
          { user: { name: { contains: q } } },
          { plan: { name: { contains: q } } },
        ],
      },
      select: { id: true },
      take: 100,
    }),
  ]);

  return {
    userIds: users.map((user) => user.id),
    subscriptionIds: subscriptions.map((subscription) => subscription.id),
  };
}

export async function getSubscriptionRiskEvents(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const level = typeof searchParams.level === "string" ? searchParams.level : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const kind = typeof searchParams.kind === "string" ? searchParams.kind : "";
  const { userIds, subscriptionIds } = await searchRelatedIds(q);

  const where = {
    ...(level ? { level: level as "WARNING" | "SUSPENDED" } : {}),
    ...(status ? { reviewStatus: status as "OPEN" | "ACKNOWLEDGED" | "RESOLVED" } : {}),
    ...(kind ? { kind: kind as "SINGLE" | "AGGREGATE" } : {}),
    ...(q
      ? {
          OR: [
            { id: q },
            { userId: q },
            { subscriptionId: q },
            { ip: { contains: q } },
            { message: { contains: q } },
            ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
            ...(subscriptionIds.length > 0 ? [{ subscriptionId: { in: subscriptionIds } }] : []),
          ],
        }
      : {}),
  } satisfies Prisma.SubscriptionRiskEventWhereInput;

  const [events, total] = await Promise.all([
    prisma.subscriptionRiskEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.subscriptionRiskEvent.count({ where }),
  ]);

  const eventUserIds = Array.from(new Set(events.map((event) => event.userId).filter(Boolean))) as string[];
  const eventSubscriptionIds = Array.from(new Set(events.map((event) => event.subscriptionId).filter(Boolean))) as string[];

  const now = new Date();
  const [users, subscriptions, restorableSubscriptions, geoSummaries] = await Promise.all([
    eventUserIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: eventUserIds } },
          select: { id: true, email: true, name: true, status: true },
        })
      : Promise.resolve([]),
    eventSubscriptionIds.length > 0
      ? prisma.userSubscription.findMany({
          where: { id: { in: eventSubscriptionIds } },
          select: {
            id: true,
            status: true,
            endDate: true,
            plan: { select: { name: true, type: true } },
            user: { select: { id: true, email: true, name: true, status: true } },
          },
        })
      : Promise.resolve([]),
    eventUserIds.length > 0
      ? prisma.userSubscription.findMany({
          where: {
            userId: { in: eventUserIds },
            status: "SUSPENDED",
            endDate: { gt: now },
            plan: { type: "PROXY" },
          },
          select: { id: true, userId: true },
        })
      : Promise.resolve([]),
    Promise.all(
      events.map(async (event) => {
        const logs = await getSubscriptionRiskAccessLogsForEvent(event);
        return [event.id, buildSubscriptionRiskGeoSummary(logs)] as const;
      }),
    ),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const subscriptionById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  const geoSummaryByEventId = new Map(geoSummaries);
  const restorableCountByUserId = new Map<string, number>();
  for (const subscription of restorableSubscriptions) {
    restorableCountByUserId.set(
      subscription.userId,
      (restorableCountByUserId.get(subscription.userId) ?? 0) + 1,
    );
  }

  const rows: SubscriptionRiskEventRow[] = events.map((event) => {
    const subscription = event.subscriptionId ? subscriptionById.get(event.subscriptionId) ?? null : null;
    const user = subscription?.user ?? (event.userId ? userById.get(event.userId) ?? null : null);
    const singleRestorable = Boolean(
      subscription
        && subscription.status === "SUSPENDED"
        && subscription.endDate > now
        && event.reviewStatus !== "RESOLVED",
    );
    const aggregateRestorableCount = event.kind === "AGGREGATE" && event.userId
      ? restorableCountByUserId.get(event.userId) ?? 0
      : 0;
    const restorableSubscriptionCount = singleRestorable ? 1 : aggregateRestorableCount;

    return {
      ...event,
      user,
      subscription,
      canRestoreSubscription: restorableSubscriptionCount > 0 && event.reviewStatus !== "RESOLVED",
      restorableSubscriptionCount,
      geoSummary: geoSummaryByEventId.get(event.id) ?? buildSubscriptionRiskGeoSummary([]),
    };
  });

  return {
    events: rows,
    total,
    page,
    pageSize,
    filters: { q, level, status, kind },
  };
}
