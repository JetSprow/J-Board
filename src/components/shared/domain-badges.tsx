import type {
  AnnouncementAudience,
  OrderReviewStatus,
  OrderStatus,
  Role,
  SubscriptionStatus,
  SubscriptionType,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  orderReviewStatusLabels,
  orderStatusLabels,
  subscriptionStatusLabels,
  subscriptionTypeLabels,
  taskStatusLabels,
  userRoleLabels,
  userStatusLabels,
} from "@/lib/domain-labels";

export {
  announcementAudienceLabels,
  announcementDisplayTypeLabels,
  orderKindLabels,
  orderReviewStatusLabels,
  orderStatusLabels,
  subscriptionStatusLabels,
  subscriptionTypeLabels,
  taskKindLabels,
  taskStatusLabels,
  userRoleLabels,
  userStatusLabels,
} from "@/lib/domain-labels";

export function getOrderStatusTone(status: OrderStatus): StatusTone {
  if (status === "PAID") return "success";
  if (status === "PENDING") return "warning";
  return "danger";
}

export function getOrderReviewStatusTone(status: OrderReviewStatus): StatusTone {
  if (status === "RESOLVED") return "success";
  if (status === "FLAGGED") return "danger";
  return "neutral";
}

export function getSubscriptionStatusTone(status: SubscriptionStatus): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  return "neutral";
}

export function getSubscriptionTypeTone(type: SubscriptionType): StatusTone {
  return type === "PROXY" ? "info" : "warning";
}

export function getUserStatusTone(status: UserStatus): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING_EMAIL") return "info";
  if (status === "DISABLED") return "warning";
  return "danger";
}

export function getUserRoleTone(role: Role): StatusTone {
  return role === "ADMIN" ? "info" : "neutral";
}

export function getTaskStatusTone(status: TaskStatus): StatusTone {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "danger";
  if (status === "RUNNING") return "warning";
  return "neutral";
}

export function getAnnouncementAudienceTone(audience: AnnouncementAudience): StatusTone {
  if (audience === "SPECIFIC_USER") return "warning";
  if (audience === "PUBLIC") return "info";
  return "neutral";
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge tone={getOrderStatusTone(status)}>{orderStatusLabels[status]}</StatusBadge>;
}

export function OrderReviewStatusBadge({ status }: { status: OrderReviewStatus }) {
  return (
    <StatusBadge tone={getOrderReviewStatusTone(status)}>
      {orderReviewStatusLabels[status]}
    </StatusBadge>
  );
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <StatusBadge tone={getSubscriptionStatusTone(status)}>
      {subscriptionStatusLabels[status]}
    </StatusBadge>
  );
}

export function SubscriptionTypeBadge({ type }: { type: SubscriptionType }) {
  return (
    <StatusBadge tone={getSubscriptionTypeTone(type)}>
      {subscriptionTypeLabels[type]}
    </StatusBadge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <StatusBadge tone={getUserStatusTone(status)}>{userStatusLabels[status]}</StatusBadge>;
}

export function UserRoleBadge({ role }: { role: Role }) {
  return <StatusBadge tone={getUserRoleTone(role)}>{userRoleLabels[role]}</StatusBadge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge tone={getTaskStatusTone(status)}>{taskStatusLabels[status]}</StatusBadge>;
}
