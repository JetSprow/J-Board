import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const adminSupportTicketInclude = {
  user: { select: { email: true } },
  _count: { select: { replies: true } },
} satisfies Prisma.SupportTicketInclude;

const adminSupportTicketDetailInclude = {
  user: { select: { email: true } },
  replies: {
    include: {
      author: { select: { email: true } },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          size: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SupportTicketInclude;

export type AdminSupportTicketRow = Prisma.SupportTicketGetPayload<{
  include: typeof adminSupportTicketInclude;
}>;

export type AdminSupportTicketDetail = Prisma.SupportTicketGetPayload<{
  include: typeof adminSupportTicketDetailInclude;
}>;

export async function getAdminSupportTickets(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams, 30);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const priority = typeof searchParams.priority === "string" ? searchParams.priority : "";

  const where = {
    ...(status
      ? { status: status as "OPEN" | "USER_REPLIED" | "ADMIN_REPLIED" | "CLOSED" }
      : {}),
    ...(priority ? { priority: priority as "LOW" | "NORMAL" | "HIGH" | "URGENT" } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q } },
            { category: { contains: q } },
            { user: { email: { contains: q } } },
          ],
        }
      : {}),
  } satisfies Prisma.SupportTicketWhereInput;

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: adminSupportTicketInclude,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { tickets, total, page, pageSize, filters: { q, status, priority } };
}

export async function getAdminSupportTicketDetail(ticketId: string) {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: adminSupportTicketDetailInclude,
  });
}
