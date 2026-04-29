import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const serviceInclude = {
  _count: {
    select: {
      slots: true,
    },
  },
} satisfies Prisma.StreamingServiceInclude;

export type StreamingServiceRow = Prisma.StreamingServiceGetPayload<{
  include: typeof serviceInclude;
}>;

export async function getStreamingServices(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(status ? { isActive: status === "active" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.StreamingServiceWhereInput;

  const [services, total] = await Promise.all([
    prisma.streamingService.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: serviceInclude,
      skip,
      take: pageSize,
    }),
    prisma.streamingService.count({ where }),
  ]);

  return { services, total, page, pageSize, filters: { q, status } };
}
