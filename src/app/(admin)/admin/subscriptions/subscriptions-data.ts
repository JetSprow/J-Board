import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import type { StreamingServiceOption } from "./streaming-slot-dialog";

const adminSubscriptionInclude = {
  user: true,
  plan: true,
  nodeClient: {
    include: {
      inbound: {
        include: {
          server: true,
        },
      },
    },
  },
  streamingSlot: {
    include: {
      service: true,
    },
  },
} satisfies Prisma.UserSubscriptionInclude;

export type AdminSubscriptionRow = Prisma.UserSubscriptionGetPayload<{
  include: typeof adminSubscriptionInclude;
}>;

export async function getAdminSubscriptions(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const type = typeof searchParams.type === "string" ? searchParams.type : "";

  const where = {
    ...(status ? { status: status as "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED" } : {}),
    ...(type ? { plan: { type: type as "PROXY" | "STREAMING" } } : {}),
    ...(q
      ? {
          OR: [
            { user: { email: { contains: q } } },
            { user: { name: { contains: q } } },
            { plan: { name: { contains: q } } },
          ],
        }
      : {}),
  } satisfies Prisma.UserSubscriptionWhereInput;

  const [subscriptions, total, streamingServices] = await Promise.all([
    prisma.userSubscription.findMany({
      where,
      include: adminSubscriptionInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.userSubscription.count({ where }),
    prisma.streamingService.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        usedSlots: true,
        maxSlots: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    subscriptions,
    total,
    page,
    pageSize,
    filters: { q, status, type },
    streamingServices: streamingServices satisfies StreamingServiceOption[],
  };
}
