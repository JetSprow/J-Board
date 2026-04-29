import type { Metadata } from "next";
import { ForgotPasswordClient } from "./forgot-password-client";

export const metadata: Metadata = {
  title: "找回密码",
  description: "通过邮箱重设 J-Board 账户密码。",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
