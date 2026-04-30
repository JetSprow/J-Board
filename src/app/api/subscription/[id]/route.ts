import { NextResponse } from "next/server";
import {
  buildSubscriptionUserInfo,
  generateSubscriptionContent,
  getSubscriptionContentType,
  getSubscriptionFilename,
  resolveSubscriptionFormat,
} from "@/services/subscription";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientRequestContext } from "@/lib/request-context";
import { recordSubscriptionAccess } from "@/services/subscription-risk";
import { getAppConfig } from "@/services/app-config";
import { getSubscriptionStatusLabel } from "@/lib/domain-labels";

const SUBSCRIPTION_RATE_WINDOW_SECONDS = 60 * 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const context = getClientRequestContext(req.headers);

  const [sub, config] = await Promise.all([
    prisma.userSubscription.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        downloadToken: true,
        status: true,
        trafficUsed: true,
        trafficLimit: true,
        endDate: true,
        plan: { select: { type: true } },
      },
    }),
    getAppConfig(),
  ]);

  if (config.subscriptionRiskEnabled) {
    const ipLimit = await rateLimit(
      `ratelimit:subscription:ip:${context.ip}`,
      config.subscriptionRiskIpLimitPerHour,
      SUBSCRIPTION_RATE_WINDOW_SECONDS,
    );

    if (!ipLimit.success) {
      await recordSubscriptionAccess({
        kind: "SINGLE",
        context,
        userId: sub?.userId,
        subscriptionId: sub?.id ?? id,
        allowed: false,
        reason: "rate_limited",
      });
      return jsonError("订阅请求过于频繁，请稍后再试", 429);
    }
  }

  if (!token) {
    await recordSubscriptionAccess({
      kind: "SINGLE",
      context,
      userId: sub?.userId,
      subscriptionId: sub?.id ?? id,
      allowed: false,
      reason: "missing_token",
    });
    return jsonError("订阅链接缺少 token 参数，请从订阅页面重新复制完整链接", 401);
  }

  if (!sub || sub.downloadToken !== token) {
    await recordSubscriptionAccess({
      kind: "SINGLE",
      context,
      userId: sub?.userId,
      subscriptionId: sub?.id ?? id,
      allowed: false,
      reason: "invalid_token",
    });
    return jsonError("订阅 token 无效或已被重置，请在订阅详情页重新复制链接", 401);
  }

  if (config.subscriptionRiskEnabled) {
    const tokenLimit = await rateLimit(
      `ratelimit:subscription:single:${sub.id}`,
      config.subscriptionRiskTokenLimitPerHour,
      SUBSCRIPTION_RATE_WINDOW_SECONDS,
    );

    if (!tokenLimit.success) {
      await recordSubscriptionAccess({
        kind: "SINGLE",
        context,
        userId: sub.userId,
        subscriptionId: sub.id,
        allowed: false,
        reason: "rate_limited",
      });
      return jsonError("订阅请求过于频繁，请稍后再试", 429);
    }
  }

  if (sub.status !== "ACTIVE") {
    await recordSubscriptionAccess({
      kind: "SINGLE",
      context,
      userId: sub.userId,
      subscriptionId: sub.id,
      allowed: false,
      reason: "subscription_inactive",
    });
    return jsonError(`订阅当前状态为${getSubscriptionStatusLabel(sub.status)}，只有活跃订阅可以拉取配置`, 403);
  }

  const risk = await recordSubscriptionAccess({
    kind: "SINGLE",
    context,
    userId: sub.userId,
    subscriptionId: sub.id,
    evaluateRisk: config.subscriptionRiskEnabled && sub.plan.type === "PROXY",
    riskConfig: config,
  });

  if (risk.suspended) {
    return jsonError("订阅已被风控暂停，请联系管理员处理", 403);
  }

  const format = resolveSubscriptionFormat(url.searchParams, req.headers.get("user-agent"));
  const content = await generateSubscriptionContent(id, format);
  const userInfo = buildSubscriptionUserInfo({
    upload: 0,
    download: sub.trafficUsed,
    total: sub.trafficLimit,
    expire: sub.endDate,
  });
  const headers = new Headers({
    "Content-Type": getSubscriptionContentType(format),
    "Content-Disposition": `attachment; filename="${getSubscriptionFilename("jboard-sub", format)}"`,
    "Cache-Control": "no-store",
    "profile-update-interval": "12",
    "profile-web-page-url": `${url.origin}/subscriptions/${id}`,
  });
  if (userInfo) headers.set("Subscription-Userinfo", userInfo);

  return new Response(content, {
    headers,
  });
}
