import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAppConfig } from "@/services/app-config";
import { verifyTurnstile } from "@/lib/turnstile";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmailAddress, sendRegistrationVerificationEmail } from "@/services/email";

const schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少需要 6 位"),
  name: z.string().optional(),
  inviteCode: z.string().optional(),
  turnstileToken: z.string().optional(),
});

function formatValidationErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "请求体";
      return `${field}：${issue.message}`;
    })
    .join("；");
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || "unknown";
  const { success, remaining } = await rateLimit(`ratelimit:register:${ip}`, 5, 60);
  if (!success) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "注册参数错误：请求体不是有效 JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: `注册参数错误：${formatValidationErrors(parsed.error)}` }, { status: 400 });
  }

  const { password, name, inviteCode, turnstileToken } = parsed.data;
  const email = normalizeEmailAddress(parsed.data.email);
  const config = await getAppConfig();

  if (config.turnstileSecretKey) {
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, config.turnstileSecretKey))) {
      return NextResponse.json({ error: "人机验证失败：Turnstile token 缺失、已过期或校验未通过" }, { status: 403 });
    }
  }

  if (!config.allowRegistration) {
    return NextResponse.json({ error: "当前站点暂未开放注册" }, { status: 403 });
  }
  if (config.requireInviteCode && !inviteCode) {
    return NextResponse.json({ error: "当前注册必须填写邀请码：请向管理员或邀请人获取有效邀请码" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "邮箱已注册" }, { status: 400 });
  }

  let inviterId: string | null = null;
  if (inviteCode) {
    const inviter = await prisma.user.findUnique({ where: { inviteCode } });
    if (!inviter) {
      return NextResponse.json({ error: "邀请码无效：没有找到对应邀请人，请检查大小写或重新复制" }, { status: 400 });
    }
    inviterId = inviter.id;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      emailVerifiedAt: config.emailVerificationRequired ? null : new Date(),
      password: hashedPassword,
      name: name || null,
      invitedById: inviterId,
    },
    select: { id: true, email: true },
  });

  if (config.emailVerificationRequired) {
    try {
      await sendRegistrationVerificationEmail({
        userId: user.id,
        email: user.email,
        headers: req.headers,
        requestUrl: req.url,
      });
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "验证邮件发送失败" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, requiresEmailVerification: config.emailVerificationRequired });
}
