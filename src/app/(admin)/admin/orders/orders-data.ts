import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const adminOrderInclude = {
  user: true,
  plan: true,
} satisfies Prisma.OrderInclude;

export type AdminOrderRow = Prisma.OrderGetPayload<{
  include: typeof adminOrderInclude;
}>;

export async function getAdminOrders(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const kind = typeof searchParams.kind === "string" ? searchParams.kind : "";
  const reviewStatus =
    typeof searchParams.reviewStatus === "string" ? searchParams.reviewStatus : "";

  const where = {
    ...(status ? { status: status as "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" } : {}),
    ...(kind ? { kind: kind as "NEW_PURCHASE" | "RENEWAL" | "TRAFFIC_TOPUP" } : {}),
    ...(reviewStatus
      ? { reviewStatus: reviewStatus as "NORMAL" | "FLAGGED" | "RESOLVED" }
      : {}),
    ...(q
      ? {
          OR: [
            { user: { email: { contains: q } } },
            { user: { name: { contains: q } } },
            { plan: { name: { contains: q } } },
            { tradeNo: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.OrderWhereInput;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: adminOrderInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, pageSize, filters: { q, status, kind, reviewStatus } };
}
