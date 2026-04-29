import { NextResponse } from "next/server";
import {
  buildSubscriptionUserInfo,
  generateSubscriptionContent,
  getSubscriptionContentType,
  getSubscriptionFilename,
  resolveSubscriptionFormat,
} from "@/services/subscription";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "订阅链接缺少 token 参数，请从订阅页面重新复制完整链接" }, { status: 401 });
  }

  const sub = await prisma.userSubscription.findUnique({
    where: { id },
  });

  if (!sub || sub.downloadToken !== token) {
    return NextResponse.json({ error: "订阅 token 无效或已被重置，请在订阅详情页重新复制链接" }, { status: 401 });
  }

  if (sub.status !== "ACTIVE") {
    return NextResponse.json({ error: `订阅当前状态为 ${sub.status}，只有 ACTIVE 状态可以拉取配置` }, { status: 403 });
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
