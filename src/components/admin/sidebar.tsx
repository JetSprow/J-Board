"use client";

import {
  BarChart3,
  Package,
  BadgePercent,
  Film,
  Globe,
  Users,
  ClipboardList,
  CreditCard,
  Activity,
  Waypoints,
  ShieldAlert,
  ScrollText,
  Settings,
  Megaphone,
  ListChecks,
  DatabaseBackup,
  MessagesSquare,
} from "lucide-react";
import { Sidebar, type SidebarGroup, type SidebarLink } from "@/components/shared/sidebar";

export const adminLinks: SidebarLink[] = [
  { href: "/admin/dashboard", label: "仪表盘", icon: <BarChart3 size={16} /> },
  { href: "/admin/plans", label: "套餐管理", icon: <Package size={16} /> },
  { href: "/admin/commerce", label: "商业配置", icon: <BadgePercent size={16} /> },
  { href: "/admin/services", label: "流媒体", icon: <Film size={16} /> },
  { href: "/admin/nodes", label: "节点管理", icon: <Globe size={16} /> },
  { href: "/admin/users", label: "用户管理", icon: <Users size={16} /> },
  { href: "/admin/orders", label: "订单管理", icon: <ClipboardList size={16} /> },
  { href: "/admin/subscriptions", label: "订阅管理", icon: <Waypoints size={16} /> },
  { href: "/admin/subscription-risk", label: "订阅风控", icon: <ShieldAlert size={16} /> },
  { href: "/admin/payments", label: "支付配置", icon: <CreditCard size={16} /> },
  { href: "/admin/traffic", label: "流量监控", icon: <Activity size={16} /> },
  { href: "/admin/tasks", label: "任务中心", icon: <ListChecks size={16} /> },
  { href: "/admin/backups", label: "备份恢复", icon: <DatabaseBackup size={16} /> },
  { href: "/admin/support", label: "工单售后", icon: <MessagesSquare size={16} /> },
  { href: "/admin/announcements", label: "公告消息", icon: <Megaphone size={16} /> },
  { href: "/admin/audit-logs", label: "审计日志", icon: <ScrollText size={16} /> },
  { href: "/admin/settings", label: "系统设置", icon: <Settings size={16} /> },
];

export const adminNavGroups: SidebarGroup[] = [
  {
    label: "概览",
    links: [adminLinks[0]],
  },
  {
    label: "商品与订单",
    links: [adminLinks[1], adminLinks[2], adminLinks[3], adminLinks[6], adminLinks[7], adminLinks[8], adminLinks[9]],
  },
  {
    label: "基础设施",
    links: [adminLinks[4], adminLinks[10], adminLinks[11], adminLinks[12]],
    defaultCollapsed: true,
  },
  {
    label: "用户支持",
    links: [adminLinks[5], adminLinks[13], adminLinks[14]],
    defaultCollapsed: true,
  },
  {
    label: "系统",
    links: [adminLinks[15], adminLinks[16]],
    defaultCollapsed: true,
  },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  return (
    <Sidebar
      title="J-Board"
      subtitle="管理后台"
      groups={adminNavGroups}
      collapsibleGroups
      onNavigate={onNavigate}
    />
  );
}
