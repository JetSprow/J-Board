import type {
  AnnouncementAudience,
  AnnouncementDisplayType,
  OrderKind,
  OrderReviewStatus,
  OrderStatus,
  Role,
  SubscriptionStatus,
  SubscriptionType,
  TaskKind,
  TaskStatus,
  UserStatus,
} from "@prisma/client";

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "待确认",
  PAID: "已支付",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
};

export const orderKindLabels: Record<OrderKind, string> = {
  NEW_PURCHASE: "新购",
  RENEWAL: "续费",
  TRAFFIC_TOPUP: "增流量",
};

export const orderReviewStatusLabels: Record<OrderReviewStatus, string> = {
  NORMAL: "正常",
  FLAGGED: "异常",
  RESOLVED: "已解决",
};

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "活跃",
  EXPIRED: "已过期",
  CANCELLED: "已取消",
  SUSPENDED: "已暂停",
};

export const subscriptionTypeLabels: Record<SubscriptionType, string> = {
  PROXY: "代理",
  STREAMING: "流媒体",
};

export const userRoleLabels: Record<Role, string> = {
  ADMIN: "管理员",
  USER: "用户",
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "正常",
  PENDING_EMAIL: "待邮箱验证",
  DISABLED: "禁用",
  BANNED: "封禁",
};

export const taskKindLabels: Record<TaskKind, string> = {
  REMINDER_DISPATCH: "提醒派发",
  ORDER_PROVISION_RETRY: "订单重试",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDING: "待执行",
  RUNNING: "运行中",
  SUCCESS: "成功",
  FAILED: "失败",
};

export const announcementAudienceLabels: Record<AnnouncementAudience, string> = {
  PUBLIC: "公开",
  USERS: "全部用户",
  ADMINS: "全部管理员",
  SPECIFIC_USER: "指定用户",
};

export const announcementDisplayTypeLabels: Record<AnnouncementDisplayType, string> = {
  INLINE: "普通公告",
  BIG: "大公告",
  POPUP: "弹窗公告",
};

export const booleanAppSettingLabels = {
  allowRegistration: "开放注册",
  emailVerificationRequired: "注册邮箱验证",
  requireInviteCode: "邀请码注册",
  autoReminderDispatchEnabled: "自动提醒派发",
  trafficSyncEnabled: "3x-ui 流量定时同步",
  networkRecommendationsEnabled: "三网推荐",
  networkInsightsEnabled: "线路体验",
  subscriptionRiskEnabled: "订阅访问风控",
  subscriptionRiskAutoSuspend: "风控自动暂停",
  nodeAccessRiskEnabled: "节点日志风控",
  inviteRewardEnabled: "自动发放奖励",
  smtpEnabled: "邮件服务",
  smtpSecure: "SMTP SSL 直连",
} as const;

export type BooleanAppSettingField = keyof typeof booleanAppSettingLabels;

export const booleanAppSettingFields = Object.keys(booleanAppSettingLabels) as [
  BooleanAppSettingField,
  ...BooleanAppSettingField[],
];

export const nodeStatusLabels: Record<string, string> = {
  active: "已启用",
  inactive: "已停用",
  disabled: "已停用",
  error: "异常",
  offline: "离线",
};

export const paymentProviderLabels: Record<string, string> = {
  epay: "易支付",
  alipay_f2f: "支付宝当面付",
  usdt_trc20: "USDT (TRC20)",
};

export const paymentChannelLabels: Record<string, string> = {
  alipay: "支付宝",
  wxpay: "微信支付",
};

function labelFromMap(map: Partial<Record<string, string>>, value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  return map[value] ?? fallback;
}

export function getOrderStatusLabel(status: string | null | undefined) {
  return labelFromMap(orderStatusLabels, status, "未知订单状态");
}

export function getOrderKindLabel(kind: string | null | undefined) {
  return labelFromMap(orderKindLabels, kind, "未知订单类型");
}

export function getSubscriptionStatusLabel(status: string | null | undefined) {
  return labelFromMap(subscriptionStatusLabels, status, "未知订阅状态");
}

export function getSubscriptionTypeLabel(type: string | null | undefined) {
  return labelFromMap(subscriptionTypeLabels, type, "未知套餐类型");
}

export function getUserStatusLabel(status: string | null | undefined) {
  return labelFromMap(userStatusLabels, status, "未知用户状态");
}

export function getUserRoleLabel(role: string | null | undefined) {
  return labelFromMap(userRoleLabels, role, "未知角色");
}

export function getTaskKindLabel(kind: string | null | undefined) {
  return labelFromMap(taskKindLabels, kind, "任务");
}

export function getNodeStatusLabel(status: string | null | undefined) {
  return labelFromMap(nodeStatusLabels, status, "未知状态");
}

export function getPaymentProviderLabel(provider: string | null | undefined) {
  return labelFromMap(paymentProviderLabels, provider, "支付方式");
}

export function getBooleanAppSettingLabel(field: string | null | undefined) {
  return labelFromMap(booleanAppSettingLabels, field, "系统开关");
}
