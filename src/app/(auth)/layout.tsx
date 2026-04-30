import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/require-auth";
import { AnnouncementLoader } from "@/components/announcements/announcement-loader";
import { PageTransition } from "@/components/shared/page-transition";

export const metadata: Metadata = {
  title: {
    default: "账户入口",
    template: "%s | J-Board Lite",
  },
  description: "登录 J-Board Lite 账号，或通过邮箱找回密码。",
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActiveSession();
  if (session) {
    redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
  }
  return (
    <>
      <Suspense fallback={null}>
        <AnnouncementLoader />
      </Suspense>
      <PageTransition>{children}</PageTransition>
    </>
  );
}
