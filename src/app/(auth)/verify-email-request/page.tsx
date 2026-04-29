import type { Metadata } from "next";
import { VerifyEmailRequestClient } from "./verify-email-request-client";

export const metadata: Metadata = {
  title: "重新发送验证邮件",
  description: "重新发送 J-Board 注册邮箱验证邮件。",
};

export default function VerifyEmailRequestPage() {
  return <VerifyEmailRequestClient />;
}
