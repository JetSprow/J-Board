import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getPaymentAdapter } from "@/services/payment/factory";
import { rateLimit } from "@/lib/rate-limit";
import { getSiteBaseUrl } from "@/services/site-url";
import { getActiveSubscriptionRiskRestriction } from "@/services/subscription-risk-review";
import { getOrderStatusLabel } from "@/lib/domain-labels";
import { v4 as uuidv4 } from "uuid";

const createPaymentSchema = z.object({
  orderId: z.string().trim().min(1, "订单 ID 不能为空"),
  provider: z.string().trim().min(1, "支付方式不能为空"),
  channel: z.string().trim().optional(),
});

function isSafePaymentUrl(value: string | undefined) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const session = await getActiveSession();
    if (!session) {
      return jsonError("未登录", { status: 401 });
    }

    const restriction = await getActiveSubscriptionRiskRestriction(session.user.id);
    if (restriction) {
      return jsonError("账户存在未处理的订阅风控限制，请先新建工单联系客服", { status: 403 });
    }

    const { success, remaining } = await rateLimit(
      `ratelimit:payment:${session.user.id}`,
      5,
      60,
    );
    if (!success) {
      return jsonError("请求过于频繁，请稍后再试", {
        status: 429,
        headers: { "X-RateLimit-Remaining": String(remaining) },
      });
    }

    const payload = createPaymentSchema.parse(await req.json());
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        amount: true,
        tradeNo: true,
      },
    });

    if (!order || order.userId !== session.user.id) {
      return jsonError("订单不存在", { status: 404 });
    }

    if (order.status !== "PENDING") {
      return jsonError(`订单当前状态为${getOrderStatusLabel(order.status)}，无法继续支付`, {
        status: 400,
      });
    }

    const adapter = await getPaymentAdapter(payload.provider);
    const tradeNo =
      order.tradeNo
      || `${Date.now()}-${uuidv4().slice(0, 8)}-${Number(order.amount).toFixed(2)}`;

    const baseUrl = await getSiteBaseUrl({ headers: req.headers, requestUrl: req.url });
    if (!baseUrl) {
      return jsonError("请先在后台系统设置里配置网站 URL", { status: 400 });
    }
    const result = await adapter.createPayment({
      tradeNo,
      amount: Number(order.amount),
      subject: `J-Board订单-${tradeNo.slice(0, 8)}`,
      notifyUrl: `${baseUrl}/api/payment/notify/${payload.provider}`,
      returnUrl: `${baseUrl}/pay/${payload.orderId}?status=return`,
      channel: payload.channel,
    });

    if (!result.success) {
      return jsonError("支付单创建失败，请检查支付配置或稍后重试", {
        status: 500,
      });
    }
    if (!isSafePaymentUrl(result.paymentUrl)) {
      return jsonError("支付网关返回了无效跳转地址", { status: 502 });
    }

    await prisma.order.update({
      where: { id: payload.orderId },
      data: {
        tradeNo,
        paymentMethod: payload.provider,
        paymentUrl: result.paymentUrl || null,
        expireAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    return jsonOk({
      tradeNo,
      paymentUrl: result.paymentUrl,
      qrCode: result.qrCode,
      raw: result.raw,
    });
  } catch (error) {
    return jsonError(error, { fallback: "创建支付失败" });
  }
}
