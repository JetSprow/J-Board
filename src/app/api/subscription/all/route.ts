import { NextResponse } from "next/server";
import {
  buildSubscriptionUserInfo,
  generateAggregateSubscriptionContent,
  getSubscriptionContentType,
  getSubscriptionFilename,
  resolveSubscriptionFormat,
  verifyAggregateSubscriptionToken,
} from "@/services/subscription";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? url.searchParams.get("user");
  const token = url.searchParams.get("token");

  if (!userId || !token) {
    return NextResponse.json({ error: "总订阅链接缺少 userId 或 token 参数，请从订阅页面重新复制完整链接" }, { status: 401 });
  }

  if (!verifyAggregateSubscriptionToken(userId, token)) {
    return NextResponse.json({ error: "总订阅 token 无效，请登录后在订阅页面重新复制链接" }, { status: 401 });
  }

  const format = resolveSubscriptionFormat(url.searchParams, req.headers.get("user-agent"));
  const activeProxyWhere = {
    userId,
    status: "ACTIVE" as const,
    endDate: { gt: new Date() },
    plan: { type: "PROXY" as const },
    nodeClient: { isNot: null },
  };
  const [content, statsRows] = await Promise.all([
    generateAggregateSubscriptionContent(userId, format),
    prisma.userSubscription.findMany({
      where: activeProxyWhere,
      select: {
        trafficUsed: true,
        trafficLimit: true,
        endDate: true,
      },
    }),
  ]);
  const hasUnlimitedTraffic = statsRows.some((row) => row.trafficLimit == null);
  const userInfo = buildSubscriptionUserInfo({
    upload: 0,
    download: statsRows.reduce((sum, row) => sum + row.trafficUsed, BigInt(0)),
    total: hasUnlimitedTraffic
      ? null
      : statsRows.reduce((sum, row) => sum + (row.trafficLimit ?? BigInt(0)), BigInt(0)),
    expire: statsRows.reduce<Date | null>((earliest, row) => {
      if (!earliest || row.endDate < earliest) return row.endDate;
      return earliest;
    }, null),
  });
  const headers = new Headers({
    "Content-Type": getSubscriptionContentType(format),
    "Content-Disposition": `attachment; filename="${getSubscriptionFilename("jboard-all-sub", format)}"`,
    "Cache-Control": "no-store",
    "profile-update-interval": "12",
    "profile-web-page-url": `${url.origin}/subscriptions`,
  });
  if (userInfo) headers.set("Subscription-Userinfo", userInfo);

  return new Response(content, {
    headers,
  });
}
