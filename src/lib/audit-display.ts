import {
  booleanAppSettingLabels,
  getBooleanAppSettingLabel,
  getPaymentProviderLabel,
  getTaskKindLabel,
  getUserRoleLabel,
  nodeStatusLabels,
  orderStatusLabels,
  paymentProviderLabels,
  subscriptionStatusLabels,
  subscriptionTypeLabels,
  taskKindLabels,
  userStatusLabels,
} from "@/lib/domain-labels";

export const auditActionFilterOptions = [
  { label: "全部动作", value: "" },
  { label: "用户操作", value: "user." },
  { label: "订单操作", value: "order." },
  { label: "订阅操作", value: "subscription." },
  { label: "套餐操作", value: "plan." },
  { label: "服务操作", value: "service." },
  { label: "节点操作", value: "node." },
  { label: "入站操作", value: "inbound." },
  { label: "任务操作", value: "task." },
  { label: "风控操作", value: "risk." },
  { label: "系统设置", value: "settings." },
  { label: "支付配置", value: "payment." },
  { label: "公告操作", value: "announcement." },
  { label: "工单操作", value: "support." },
  { label: "优惠规则", value: "coupon." },
  { label: "满减规则", value: "promotion." },
  { label: "备份恢复", value: "backup." },
  { label: "流量同步", value: "traffic." },
  { label: "日志清理", value: "logs." },
  { label: "流媒体槽位", value: "streaming-slot." },
];

const auditActionLabels: Record<string, string> = {
  "announcement.create": "创建公告",
  "announcement.update": "更新公告",
  "announcement.enable": "启用公告",
  "announcement.disable": "停用公告",
  "announcement.delete": "删除公告",
  "backup.restore": "恢复数据库",
  "coupon.create": "创建优惠券",
  "coupon.toggle": "切换优惠券状态",
  "inbound.delete": "删除线路入口",
  "inbound.display_name.update": "更新线路名称",
  "logs.cleanup": "清理过期日志",
  "logs.delete": "删除日志记录",
  "node.create": "创建节点",
  "node.update": "更新节点",
  "node.delete": "删除节点",
  "node.test": "同步节点入站",
  "node.probe_token.generate": "生成探测 Token",
  "node.probe_token.revoke": "撤销探测 Token",
  "order.confirm": "确认订单",
  "order.cancel": "取消订单",
  "order.review": "更新订单审查",
  "payment.config": "更新支付配置",
  "plan.create": "创建套餐",
  "plan.update": "更新套餐",
  "plan.enable": "上架套餐",
  "plan.disable": "下架套餐",
  "plan.delete": "删除套餐",
  "plan.batch_enable": "批量上架套餐",
  "plan.batch_disable": "批量下架套餐",
  "promotion.create": "创建满减规则",
  "promotion.toggle": "切换满减规则状态",
  "risk.node_access.suspend": "节点风控暂停订阅",
  "risk.node_access.warning": "记录节点访问警告",
  "risk.subscription.finalize": "完成风控处置",
  "risk.subscription.report.generate": "生成风控报告",
  "risk.subscription.report.send": "发送风控通知",
  "risk.subscription.review": "更新订阅风控事件",
  "risk.subscription.suspend": "风控暂停订阅",
  "risk.subscription.warning": "记录订阅风险警告",
  "service.create": "创建流媒体服务",
  "service.update": "更新流媒体服务",
  "service.delete": "删除流媒体服务",
  "service.enable": "启用流媒体服务",
  "service.disable": "停用流媒体服务",
  "service.batch_enable": "批量启用流媒体服务",
  "service.batch_disable": "批量停用流媒体服务",
  "settings.toggle": "切换系统开关",
  "settings.update": "更新系统设置",
  "streaming-slot.reassign": "调配流媒体槽位",
  "subscription.activate": "恢复订阅",
  "subscription.auto_suspend": "自动暂停订阅",
  "subscription.cancel": "取消订阅",
  "subscription.create": "创建订阅",
  "subscription.delete": "删除订阅",
  "subscription.renew": "续费订阅",
  "subscription.rotate_access": "重置订阅访问密钥",
  "subscription.suspend": "暂停订阅",
  "subscription.topup": "追加流量",
  "support.close": "关闭工单",
  "support.delete": "删除工单",
  "support.reply": "回复工单",
  "support.update": "更新工单",
  "task.retry": "重试任务",
  "task.run": "执行任务",
  "traffic.sync": "同步流量视图",
  "user.batch_status": "批量更新用户状态",
  "user.create": "创建用户",
  "user.force_delete": "强制删除用户",
  "user.status": "更新用户状态",
  "user.update": "更新用户",
};

const auditTargetTypeLabels: Record<string, string> = {
  Announcement: "公告",
  AppConfig: "系统设置",
  Coupon: "优惠券",
  Database: "数据库",
  LogCleanup: "日志清理",
  LogEntry: "日志记录",
  NodeInbound: "线路入口",
  NodeServer: "节点",
  Order: "订单",
  PaymentConfig: "支付配置",
  PromotionRule: "满减规则",
  StreamingService: "流媒体服务",
  StreamingSlot: "流媒体槽位",
  SubscriptionPlan: "套餐",
  SupportTicket: "工单",
  TaskRun: "任务",
  TrafficSync: "流量同步",
  User: "用户",
  UserSubscription: "订阅",
};

const tokenLabels: Record<string, string> = {
  ...booleanAppSettingLabels,
  ...nodeStatusLabels,
  ...orderStatusLabels,
  ...paymentProviderLabels,
  ...subscriptionStatusLabels,
  ...subscriptionTypeLabels,
  ...taskKindLabels,
  ...userStatusLabels,
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceKnownTokens(value: string) {
  return Object.entries(tokenLabels)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [token, label]) => {
      const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "g");
      return text.replace(pattern, label);
    }, value);
}

export function formatAuditAction(action: string) {
  const exact = auditActionLabels[action];
  if (exact) return exact;

  const prefix = auditActionFilterOptions.find((option) => option.value && action.startsWith(option.value));
  return prefix?.label ?? "系统操作";
}

export function formatAuditTargetType(targetType: string | null | undefined) {
  if (!targetType) return "系统";
  return auditTargetTypeLabels[targetType] ?? "业务对象";
}

export function formatAuditTargetLabel({
  targetType,
  targetLabel,
  targetId,
}: {
  targetType: string | null | undefined;
  targetLabel?: string | null;
  targetId?: string | null;
}) {
  if (targetLabel) {
    if (targetType === "PaymentConfig") return getPaymentProviderLabel(targetLabel);
    if (targetType === "TaskRun") return getTaskKindLabel(targetLabel);
    return replaceKnownTokens(targetLabel);
  }

  if (targetType === "Database") return "数据库";
  if (targetType === "TrafficSync") return "全站流量";
  if (targetId) return `ID ${targetId.slice(0, 8)}`;
  return "—";
}

export function formatAuditActorRole(role: string | null | undefined) {
  if (!role) return "系统";
  return getUserRoleLabel(role);
}

export function formatAuditMessage(message: string) {
  const withSettingLabels = message.replace(
    /系统开关\s+([A-Za-z][A-Za-z0-9_]*)/g,
    (_match, field: string) => `${getBooleanAppSettingLabel(field)}开关`,
  );
  return replaceKnownTokens(withSettingLabels);
}
