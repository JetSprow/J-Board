import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { getAppConfig } from "@/services/app-config";
import type { AccountPanelUser } from "./account-types";

export async function getAccountPageData(userId: string): Promise<{
  user: AccountPanelUser;
  siteNotice: string | null;
}> {
  const [user, rewardAggregate, config] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        emailVerifiedAt: true,
        name: true,
        inviteCode: true,
        createdAt: true,
        _count: {
          select: {
            invitedUsers: true,
          },
        },
      },
    }),
    prisma.inviteRewardLedger.aggregate({
      where: { inviterId: userId, status: "ISSUED" },
      _count: { _all: true },
      _sum: { rewardAmount: true },
    }),
    getAppConfig(),
  ]);

  return {
    user: {
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : null,
      name: user.name,
      inviteCode: user.inviteCode,
      createdAt: formatDate(user.createdAt),
      invitedUsersCount: user._count.invitedUsers,
      inviteRewardCount: rewardAggregate._count._all,
      inviteRewardAmount: Number(rewardAggregate._sum.rewardAmount ?? 0),
    },
    siteNotice: config.siteNotice,
  };
}
