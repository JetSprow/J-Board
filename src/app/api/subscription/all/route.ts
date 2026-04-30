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
import { rateLimit } from "@/lib/rate-limit";
import { getClientRequestContext } from "@/lib/request-context";
import { recordSubscriptionAccess } from "@/services/subscription-risk";
import { getAppConfig } from "@/services/app-config";
import { getUserStatusLabel } from "@/lib/domain-labels";

const SUBSCRIPTION_RATE_WINDOW_SECONDS = 60 * 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? url.searchParams.get("user");
  const token = url.searchParams.get("token");
  const context = getClientRequestContext(req.headers);
  const config = await getAppConfig();

  if (config.subscriptionRiskEnabled) {
    const ipLimit = await rateLimit(
      `ratelimit:subscription:ip:${context.ip}`,
      config.subscriptionRiskIpLimitPerHour,
      SUBSCRIPTION_RATE_WINDOW_SECONDS,
    );

    if (!ipLimit.success) {
      await recordSubscriptionAccess({
        kind: "AGGREGATE",
        context,
        userId,
        allowed: false,
        reason: "rate_limited",
      });
      return jsonError("订阅请求过于频繁，请稍后再试", 429);
    }
  }

  if (!userId || !token) {
    await recordSubscriptionAccess({
      kind: "AGGREGATE",
      context,
      userId,
      allowed: false,
      reason: "missing_subscription_token",
    });
    return jsonError("总订阅链接缺少 userId 或 token 参数，请从订阅页面重新复制完整链接", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user || !verifyAggregateSubscriptionToken(userId, token)) {
    await recordSubscriptionAccess({
      kind: "AGGREGATE",
      context,
      userId,
      allowed: false,
      reason: "invalid_subscription_token",
    });
    return jsonError("总订阅 token 无效，请登录后在订阅页面重新复制链接", 401);
  }

  if (config.subscriptionRiskEnabled) {
    const tokenLimit = await rateLimit(
      `ratelimit:subscription:aggregate:${userId}`,
      config.subscriptionRiskTokenLimitPerHour,
      SUBSCRIPTION_RATE_WINDOW_SECONDS,
    );

    if (!tokenLimit.success) {
      await recordSubscriptionAccess({
        kind: "AGGREGATE",
        context,
        userId,
        allowed: false,
        reason: "rate_limited",
      });
      return jsonError("订阅请求过于频繁，请稍后再试", 429);
    }
  }

  if (user.status !== "ACTIVE") {
    await recordSubscriptionAccess({
      kind: "AGGREGATE",
      context,
      userId,
      allowed: false,
      reason: "user_inactive",
    });
    return jsonError(`账户当前状态为${getUserStatusLabel(user.status)}，暂时无法拉取总订阅`, 403);
  }

  const risk = await recordSubscriptionAccess({
    kind: "AGGREGATE",
    context,
    userId,
    evaluateRisk: config.subscriptionRiskEnabled,
    riskConfig: config,
  });

  if (risk.suspended) {
    return jsonError("总订阅已被风控暂停，请联系管理员处理", 403);
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
