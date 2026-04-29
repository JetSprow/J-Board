import { NextResponse } from "next/server";
import { generateSubscriptionContent } from "@/services/subscription";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientRequestContext } from "@/lib/request-context";
import { recordSubscriptionAccess } from "@/services/subscription-risk";

const SUBSCRIPTION_TOKEN_LIMIT = 60;
const SUBSCRIPTION_IP_LIMIT = 180;
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

  const sub = await prisma.userSubscription.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      downloadToken: true,
      status: true,
      plan: { select: { type: true } },
    },
  });

  const ipLimit = await rateLimit(
    `ratelimit:subscription:ip:${context.ip}`,
    SUBSCRIPTION_IP_LIMIT,
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
    return jsonError("Too many subscription requests", 429);
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
    return jsonError("Missing token", 401);
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
    return jsonError("Invalid token", 401);
  }

  const tokenLimit = await rateLimit(
    `ratelimit:subscription:single:${sub.id}`,
    SUBSCRIPTION_TOKEN_LIMIT,
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
    return jsonError("Too many subscription requests", 429);
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
    return jsonError("Subscription inactive", 403);
  }

  const risk = await recordSubscriptionAccess({
    kind: "SINGLE",
    context,
    userId: sub.userId,
    subscriptionId: sub.id,
    evaluateRisk: sub.plan.type === "PROXY",
  });

  if (risk.suspended) {
    return jsonError("Subscription suspended by risk control", 403);
  }

  const content = await generateSubscriptionContent(id);
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="jboard-sub.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
