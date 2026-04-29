import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const taskRunInclude = {
  triggeredBy: {
    select: { email: true },
  },
} satisfies Prisma.TaskRunInclude;

export type AdminTaskRunRow = Prisma.TaskRunGetPayload<{
  include: typeof taskRunInclude;
}>;

export async function getAdminTaskRuns(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams, 30);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const kind = typeof searchParams.kind === "string" ? searchParams.kind : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(kind
      ? {
          kind: kind as
            | "REMINDER_DISPATCH"
            | "ORDER_PROVISION_RETRY",
        }
      : {}),
    ...(status ? { status: status as "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { errorMessage: { contains: q } },
            { targetType: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.TaskRunWhereInput;

  const [tasks, total] = await Promise.all([
    prisma.taskRun.findMany({
      where,
      include: taskRunInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.taskRun.count({ where }),
  ]);

  return { tasks, total, page, pageSize, filters: { q, kind, status } };
}
