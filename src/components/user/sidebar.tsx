"use client";

import {
  LayoutDashboard,
  ShoppingBag,
  Radio,
  ClipboardList,
  ShoppingCart,
  UserCircle2,
  MessageSquareWarning,
} from "lucide-react";
import { Sidebar, type SidebarGroup, type SidebarLink } from "@/components/shared/sidebar";
import { NotificationPopover } from "./notification-popover";

export const userLinks: SidebarLink[] = [
  { href: "/dashboard", label: "我的概览", icon: <LayoutDashboard size={16} /> },
  { href: "/store", label: "套餐商店", icon: <ShoppingBag size={16} /> },
  { href: "/cart", label: "购物车", icon: <ShoppingCart size={16} /> },
  { href: "/subscriptions", label: "我的订阅", icon: <Radio size={16} /> },
  { href: "/orders", label: "我的订单", icon: <ClipboardList size={16} /> },
  { href: "/support", label: "工单售后", icon: <MessageSquareWarning size={16} /> },
  { href: "/account", label: "账户中心", icon: <UserCircle2 size={16} /> },
];

export const userNavGroups: SidebarGroup[] = [
  {
    label: "开始",
    links: userLinks.slice(0, 4),
  },
  {
    label: "记录",
    links: userLinks.slice(4, 5),
  },
  {
    label: "支持",
    links: userLinks.slice(5),
  },
];

export function UserSidebar({ userName, unreadCount, onNavigate }: { userName: string; unreadCount?: number; onNavigate?: () => void }) {
  return (
    <Sidebar
      title="J-Board"
      subtitle={userName}
      groups={userNavGroups}
      matchMode="exact"
      collapsibleGroups
      headerAction={<NotificationPopover unreadCount={unreadCount} />}
      onNavigate={onNavigate}
    />
  );
}
