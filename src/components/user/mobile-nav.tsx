"use client";

import { MobileHeader } from "@/components/shared/mobile-header";
import { NotificationPopover } from "./notification-popover";
import { userNavGroups } from "./sidebar";

export function UserMobileNav({ userName, unreadCount }: { userName: string; unreadCount: number }) {
  return (
    <MobileHeader
      title="J-Board"
      subtitle={userName}
      groups={userNavGroups}
      matchMode="exact"
      collapsibleGroups
      actions={<NotificationPopover unreadCount={unreadCount} className="size-10" />}
    />
  );
}
