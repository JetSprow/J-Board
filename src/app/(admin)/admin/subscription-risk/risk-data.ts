import type { Prisma, SubscriptionRiskEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

type RiskUser = {
  id: string;
  email: string;
  name: string | null;
  status: "ACTIVE" | "DISABLED" | "BANNED";
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
};

async function searchRelatedIds(q: string) {
  if (!q) return { userIds: [] as string[], subscriptionIds: [] as string[] };

  const [users, subscriptions] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 100,
    }),
    prisma.userSubscription.findMany({
      where: {
        OR: [
          { id: q },
          { user: { email: { contains: q, mode: "insensitive" } } },
          { user: { name: { contains: q, mode: "insensitive" } } },
          { plan: { name: { contains: q, mode: "insensitive" } } },
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
            { ip: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
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

  const [users, subscriptions] = await Promise.all([
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
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const subscriptionById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  const now = new Date();
  const rows: SubscriptionRiskEventRow[] = events.map((event) => {
    const subscription = event.subscriptionId ? subscriptionById.get(event.subscriptionId) ?? null : null;
    const user = subscription?.user ?? (event.userId ? userById.get(event.userId) ?? null : null);

    return {
      ...event,
      user,
      subscription,
      canRestoreSubscription: Boolean(
        subscription
          && subscription.status === "SUSPENDED"
          && subscription.endDate > now
          && event.reviewStatus !== "RESOLVED",
      ),
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
