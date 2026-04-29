interface EmailTemplateInput {
  siteName: string;
  title: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  note?: string;
  closing?: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderActionEmail({
  siteName,
  title,
  intro,
  actionLabel,
  actionUrl,
  note,
  closing = "如果这不是你的操作，可以忽略这封邮件。",
}: EmailTemplateInput) {
  const safeSiteName = escapeHtml(siteName);
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeNote = note ? escapeHtml(note) : "";
  const safeClosing = escapeHtml(closing);

  const text = [
    `${siteName} - ${title}`,
    intro,
    `${actionLabel}: ${actionUrl}`,
    note,
    closing,
  ].filter(Boolean).join("\n\n");

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f6f3ed;color:#24211c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeIntro}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3ed;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffefa;border:1px solid #e8e1d4;border-radius:18px;overflow:hidden;box-shadow:0 14px 40px rgba(58,48,31,.08);">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #eee7da;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#15957f;color:#fff;font-weight:700;">S</span>
                  <span style="font-size:14px;color:#746b5e;font-weight:600;">${safeSiteName}</span>
                </div>
                <h1 style="margin:22px 0 0;font-size:24px;line-height:1.25;letter-spacing:-.02em;color:#24211c;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 28px;">
                <p style="margin:0;font-size:15px;line-height:1.8;color:#4b453b;">${safeIntro}</p>
                <div style="margin:26px 0 24px;">
                  <a href="${safeActionUrl}" style="display:inline-block;border-radius:12px;background:#15957f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;">${safeActionLabel}</a>
                </div>
                <p style="margin:0 0 18px;font-size:12px;line-height:1.8;color:#8a8172;">如果按钮无法打开，请复制下面的链接到浏览器：</p>
                <p style="margin:0;word-break:break-all;border-radius:12px;background:#f3efe7;padding:12px;font-size:12px;line-height:1.6;color:#5f574b;">${safeActionUrl}</p>
                ${safeNote ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#746b5e;">${safeNote}</p>` : ""}
                <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#9b9285;">${safeClosing}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

export function renderRegistrationEmail(siteName: string, actionUrl: string) {
  return renderActionEmail({
    siteName,
    title: "验证你的邮箱",
    intro: "欢迎来到 J-Board。点击下方按钮完成邮箱验证，验证后即可使用你的账户。",
    actionLabel: "完成邮箱验证",
    actionUrl,
    note: "链接 30 分钟内有效。为了账户安全，请不要转发这封邮件。",
  });
}

export function renderPasswordResetEmail(siteName: string, actionUrl: string) {
  return renderActionEmail({
    siteName,
    title: "重设账户密码",
    intro: "我们收到了你的密码重设请求。点击下方按钮设置一个新密码。",
    actionLabel: "重设密码",
    actionUrl,
    note: "链接 20 分钟内有效。如果不是你本人发起，请忽略这封邮件。",
  });
}

export function renderEmailChangeEmail(siteName: string, actionUrl: string) {
  return renderActionEmail({
    siteName,
    title: "确认新的登录邮箱",
    intro: "你正在把 J-Board 账户绑定到这个邮箱。点击下方按钮确认变更。",
    actionLabel: "确认邮箱变更",
    actionUrl,
    note: "链接 30 分钟内有效。确认后，新邮箱会成为你的登录邮箱。",
  });
}

export function renderSmtpTestEmail(siteName: string) {
  return renderActionEmail({
    siteName,
    title: "SMTP 测试邮件",
    intro: "这是一封来自 J-Board 的测试邮件。收到它说明当前 SMTP 配置可以正常发信。",
    actionLabel: "返回 J-Board",
    actionUrl: "https://github.com/JetSprow/J-Board",
    note: "你可以回到后台继续配置邮箱验证、密码找回和账户邮箱变更流程。",
    closing: "测试完成后，无需回复这封邮件。",
  });
}
