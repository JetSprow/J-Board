import { NextResponse } from "next/server";
import {
  generateAggregateSubscriptionContent,
  verifyAggregateSubscriptionToken,
} from "@/services/subscription";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientRequestContext } from "@/lib/request-context";
import { recordSubscriptionAccess } from "@/services/subscription-risk";

const AGGREGATE_TOKEN_LIMIT = 60;
const SUBSCRIPTION_IP_LIMIT = 180;
const SUBSCRIPTION_RATE_WINDOW_SECONDS = 60 * 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? url.searchParams.get("user");
  const token = url.searchParams.get("token");
  const context = getClientRequestContext(req.headers);

  const ipLimit = await rateLimit(
    `ratelimit:subscription:ip:${context.ip}`,
    SUBSCRIPTION_IP_LIMIT,
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
    return jsonError("Too many subscription requests", 429);
  }

  if (!userId || !token) {
    await recordSubscriptionAccess({
      kind: "AGGREGATE",
      context,
      userId,
      allowed: false,
      reason: "missing_subscription_token",
    });
    return jsonError("Missing subscription token", 401);
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
    return jsonError("Invalid subscription token", 401);
  }

  const tokenLimit = await rateLimit(
    `ratelimit:subscription:aggregate:${userId}`,
    AGGREGATE_TOKEN_LIMIT,
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
    return jsonError("Too many subscription requests", 429);
  }

  if (user.status !== "ACTIVE") {
    await recordSubscriptionAccess({
      kind: "AGGREGATE",
      context,
      userId,
      allowed: false,
      reason: "user_inactive",
    });
    return jsonError("User inactive", 403);
  }

  const risk = await recordSubscriptionAccess({
    kind: "AGGREGATE",
    context,
    userId,
  });

  if (risk.suspended) {
    return jsonError("Subscriptions suspended by risk control", 403);
  }

  const content = await generateAggregateSubscriptionContent(userId);
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jboard-all-sub.txt"',
      "Cache-Control": "no-store",
    },
  });
}
