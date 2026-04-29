import crypto from "crypto";
import nodemailer from "nodemailer";
import type { AppConfig, EmailToken, EmailTokenPurpose, Prisma } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getAppConfig } from "@/services/app-config";
import {
  renderEmailChangeEmail,
  renderPasswordResetEmail,
  renderRegistrationEmail,
  renderSmtpTestEmail,
} from "@/services/email-templates";
import { getSiteBaseUrl } from "@/services/site-url";

const TOKEN_BYTES = 32;
const REGISTRATION_TTL_MINUTES = 30;
const EMAIL_CHANGE_TTL_MINUTES = 30;
const PASSWORD_RESET_TTL_MINUTES = 20;

type EmailPurpose = EmailTokenPurpose;

type MailContent = {
  subject: string;
  html: string;
  text: string;
};

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function addMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function tokenTtl(purpose: EmailPurpose) {
  if (purpose === "PASSWORD_RESET") return PASSWORD_RESET_TTL_MINUTES;
  if (purpose === "EMAIL_CHANGE") return EMAIL_CHANGE_TTL_MINUTES;
  return REGISTRATION_TTL_MINUTES;
}

function smtpPassword(config: AppConfig) {
  if (!config.smtpPassword) return undefined;
  try {
    return decrypt(config.smtpPassword);
  } catch {
    return config.smtpPassword;
  }
}

export function isSmtpConfigured(config: AppConfig) {
  return Boolean(
    config.smtpEnabled &&
    config.smtpHost &&
    config.smtpPort &&
    config.smtpFromEmail,
  );
}

function assertSmtpConfigured(config: AppConfig) {
  if (!isSmtpConfigured(config)) {
    throw new Error("邮件服务尚未配置，请联系管理员");
  }
}

async function sendMail(config: AppConfig, to: string, content: MailContent) {
  assertSmtpConfigured(config);

  const user = config.smtpUser?.trim() || undefined;
  const pass = smtpPassword(config);
  const transporter = nodemailer.createTransport({
    host: config.smtpHost!,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: user ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from: {
      name: config.smtpFromName || config.siteName,
      address: config.smtpFromEmail!,
    },
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}

async function createEmailToken(input: {
  email: string;
  purpose: EmailPurpose;
  userId?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const email = normalizeEmailAddress(input.email);
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const now = new Date();

  await db.emailToken.updateMany({
    where: {
      email,
      purpose: input.purpose,
      userId: input.userId ?? null,
      consumedAt: null,
    },
    data: { consumedAt: now },
  });

  await db.emailToken.create({
    data: {
      email,
      userId: input.userId ?? null,
      purpose: input.purpose,
      tokenHash: hashToken(token),
      expiresAt: addMinutes(tokenTtl(input.purpose)),
    },
  });

  return token;
}

async function buildActionUrl(pathname: string, token: string, options: { headers?: Headers; requestUrl?: string } = {}) {
  const baseUrl = await getSiteBaseUrl({
    headers: options.headers,
    requestUrl: options.requestUrl,
    allowRequestFallback: true,
  });
  if (!baseUrl) {
    throw new Error("请先在系统设置中填写站点域名");
  }

  const url = new URL(pathname, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendRegistrationVerificationEmail(input: {
  userId: string;
  email: string;
  headers?: Headers;
  requestUrl?: string;
}) {
  const config = await getAppConfig();
  const token = await createEmailToken({
    userId: input.userId,
    email: input.email,
    purpose: "REGISTRATION_VERIFY",
  });
  const url = await buildActionUrl("/verify-email", token, input);
  const template = renderRegistrationEmail(config.siteName, url);

  await sendMail(config, input.email, {
    subject: `验证你的 ${config.siteName} 邮箱`,
    ...template,
  });
}

export async function sendPasswordResetEmail(input: {
  userId: string;
  email: string;
  headers?: Headers;
  requestUrl?: string;
}) {
  const config = await getAppConfig();
  const token = await createEmailToken({
    userId: input.userId,
    email: input.email,
    purpose: "PASSWORD_RESET",
  });
  const url = await buildActionUrl("/reset-password", token, input);
  const template = renderPasswordResetEmail(config.siteName, url);

  await sendMail(config, input.email, {
    subject: `${config.siteName} 密码重设`,
    ...template,
  });
}

export async function sendEmailChangeConfirmation(input: {
  userId: string;
  email: string;
  headers?: Headers;
  requestUrl?: string;
}) {
  const config = await getAppConfig();
  const token = await createEmailToken({
    userId: input.userId,
    email: input.email,
    purpose: "EMAIL_CHANGE",
  });
  const url = await buildActionUrl("/verify-email", token, input);
  const template = renderEmailChangeEmail(config.siteName, url);

  await sendMail(config, input.email, {
    subject: `${config.siteName} 邮箱变更确认`,
    ...template,
  });
}

export async function sendSmtpTestEmail(to: string) {
  const config = await getAppConfig();
  const template = renderSmtpTestEmail(config.siteName);
  await sendMail(config, normalizeEmailAddress(to), {
    subject: `${config.siteName} SMTP 测试`,
    ...template,
  });
}

export async function consumeEmailToken(token: string, purpose?: EmailPurpose) {
  const tokenHash = hashToken(token.trim());
  const record = await prisma.emailToken.findUnique({ where: { tokenHash } });

  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
    return null;
  }
  if (purpose && record.purpose !== purpose) {
    return null;
  }

  const result = await prisma.emailToken.updateMany({
    where: {
      id: record.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(purpose ? { purpose } : {}),
    },
    data: { consumedAt: new Date() },
  });

  return result.count === 1 ? record : null;
}

export async function verifyEmailToken(token: string) {
  const record = await consumeEmailToken(token);
  if (!record) return { ok: false as const, message: "验证链接无效或已过期" };

  if (record.purpose === "REGISTRATION_VERIFY") {
    if (!record.userId) return { ok: false as const, message: "验证链接缺少账户信息" };
    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    return { ok: true as const, message: "邮箱验证完成，现在可以登录账户。" };
  }

  if (record.purpose === "EMAIL_CHANGE") {
    if (!record.userId) return { ok: false as const, message: "验证链接缺少账户信息" };
    try {
      await prisma.user.update({
        where: { id: record.userId },
        data: {
          email: record.email,
          emailVerifiedAt: new Date(),
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        return { ok: false as const, message: "这个邮箱已经被其他账户使用" };
      }
      throw error;
    }
    return { ok: true as const, message: "邮箱变更已确认，之后请使用新邮箱登录。" };
  }

  return { ok: false as const, message: "这个链接不能用于邮箱验证" };
}

export async function consumePasswordResetToken(token: string) {
  const record = await consumeEmailToken(token, "PASSWORD_RESET");
  if (!record?.userId) {
    throw new Error("重设链接无效或已过期");
  }

  return record as EmailToken & { userId: string };
}

export async function deleteEmailTokens(where: Prisma.EmailTokenWhereInput, db: DbClient = prisma) {
  await db.emailToken.deleteMany({ where });
}
