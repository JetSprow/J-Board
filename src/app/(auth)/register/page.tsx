import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAppConfig } from "@/services/app-config";
import { RegisterPageClient } from "./register-page-client";

export const metadata: Metadata = {
  title: "注册",
  description: "创建 J-Board Lite 新账户并开始订阅服务。",
};

export default async function RegisterPage() {
  const config = await getAppConfig();
  if (!config.allowRegistration) redirect("/login");
  return <RegisterPageClient siteKey={config.turnstileSiteKey} />;
}
