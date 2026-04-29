import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const announcementInclude = {
  targetUser: {
    select: { email: true },
  },
  createdBy: {
    select: { email: true },
  },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementRow = Prisma.AnnouncementGetPayload<{
  include: typeof announcementInclude;
}>;

export type AnnouncementOptionUser = {
  id: string;
  email: string;
};

export async function getAnnouncements(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams, 20);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const audience = typeof searchParams.audience === "string" ? searchParams.audience : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(audience
      ? { audience: audience as "PUBLIC" | "USERS" | "ADMINS" | "SPECIFIC_USER" }
      : {}),
    ...(status ? { isActive: status === "active" } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { body: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.AnnouncementWhereInput;

  const [announcements, total, users] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: announcementInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.announcement.count({ where }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, email: true },
    }),
  ]);

  return { announcements, total, users, page, pageSize, filters: { q, audience, status } };
}
