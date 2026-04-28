"use client";

import { MobileHeader } from "@/components/shared/mobile-header";
import { adminNavGroups } from "./sidebar";

export function AdminMobileNav() {
  return (
    <MobileHeader
      title="J-Board"
      subtitle="管理后台"
      groups={adminNavGroups}
      collapsibleGroups
    />
  );
}
