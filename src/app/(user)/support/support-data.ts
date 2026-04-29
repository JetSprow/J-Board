import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const supportTicketReplyInclude = {
  author: {
    select: { email: true },
  },
  attachments: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
    },
  },
} satisfies Prisma.SupportTicketReplyInclude;

const userSupportTicketDetailInclude = {
  replies: {
    include: supportTicketReplyInclude,
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SupportTicketInclude;

export type UserSupportTicketDetail = Prisma.SupportTicketGetPayload<{
  include: typeof userSupportTicketDetailInclude;
}>;

export async function getUserSupportTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function getUserOpenSupportTicketCount(userId: string) {
  return prisma.supportTicket.count({
    where: {
      userId,
      status: { not: "CLOSED" },
    },
  });
}

export async function getUserSupportTicketDetail({
  ticketId,
  userId,
}: {
  ticketId: string;
  userId: string;
}) {
  return prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      userId,
    },
    include: userSupportTicketDetailInclude,
  });
}
