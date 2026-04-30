import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { PRODUCT_NAME } from "@/lib/product";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} - JB面板轻量版`,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description: "J-Board Lite（JB面板轻量版）订阅共享与节点管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
