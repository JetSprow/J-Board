import type { Metadata } from "next";
import { getAppConfig } from "@/services/app-config";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = {
  title: "登录",
  description: "登录 J-Board Lite 账户并进入用户中心。",
};

export default async function LoginPage() {
  const config = await getAppConfig();
  return <LoginPageClient siteKey={config.turnstileSiteKey} allowRegistration={config.allowRegistration} />;
}
