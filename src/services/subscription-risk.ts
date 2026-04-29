import { revalidatePath } from "next/cache";
import type {
  Prisma,
  SubscriptionAccessKind,
  SubscriptionRiskLevel,
  SubscriptionRiskReason,
} from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import type { ClientRequestContext } from "@/lib/request-context";
import { recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";
import { createPanelAdapter } from "@/services/node-panel/factory";

const RISK_WINDOW_HOURS = 24;
const CITY_WARNING_COUNT = 4;
const CITY_SUSPEND_COUNT = 5;
const REGION_WARNING_COUNT = 2;
const REGION_SUSPEND_COUNT = 3;

interface RecordSubscriptionAccessInput {
  kind: SubscriptionAccessKind;
  context: ClientRequestContext;
  userId?: string | null;
  subscriptionId?: string | null;
  allowed?: boolean;
  reason?: string | null;
  evaluateRisk?: boolean;
}

interface RiskDecision {
  level: SubscriptionRiskLevel;
  reason: SubscriptionRiskReason;
}

interface RiskEvaluationResult {
  warned: boolean;
  suspended: boolean;
  eventId?: string;
}

function normalizeLocationPart(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function hasLocationPart(value: string | null | undefined) {
  return normalizeLocationPart(value) != null;
}

function addLocationKey(
  map: Map<string, string>,
  parts: Array<string | null | undefined>,
  labelParts: Array<string | null | undefined>,
) {
  const normalizedParts = parts.map(normalizeLocationPart).filter(Boolean);
  if (normalizedParts.length === 0) return;

  const key = normalizedParts.join(":");
  const label = labelParts.map((part) => part?.trim()).filter(Boolean).join(" / ");
  map.set(key, label || key);
}

function formatKeyPreview(values: string[]) {
  if (values.length === 0) return "未知";
  const preview = values.slice(0, 5).join("、");
  return values.length > 5 ? `${preview} 等 ${values.length} 个` : preview;
}

function getScopeLabel(kind: SubscriptionAccessKind) {
  return kind === "AGGREGATE" ? "总订阅" : "单订阅";
}

function riskMessage(options: {
  decision: RiskDecision;
  kind: SubscriptionAccessKind;
  ip: string;
  cityCount: number;
  regionCount: number;
  cityLabels: string[];
  regionLabels: string[];
}) {
  const scope = getScopeLabel(options.kind);
  const locationSummary = options.decision.reason.startsWith("REGION")
    ? `${options.regionCount} 个省/地区：${formatKeyPreview(options.regionLabels)}`
    : `${options.cityCount} 个城市：${formatKeyPreview(options.cityLabels)}`;

  if (options.decision.level === "SUSPENDED") {
    return `${scope}访问地区异常，24 小时内出现 ${locationSummary}，最近 IP ${options.ip}，已自动暂停。`;
  }

  return `${scope}访问地区异常，24 小时内出现 ${locationSummary}，最近 IP ${options.ip}，已记录警告。`;
}

function decideRisk(cityCount: number, regionCount: number): RiskDecision | null {
  if (regionCount >= REGION_SUSPEND_COUNT) {
    return { level: "SUSPENDED", reason: "REGION_VARIANCE_SUSPEND" };
  }
  if (cityCount >= CITY_SUSPEND_COUNT) {
    return { level: "SUSPENDED", reason: "CITY_VARIANCE_SUSPEND" };
  }
  if (regionCount >= REGION_WARNING_COUNT) {
    return { level: "WARNING", reason: "REGION_VARIANCE_WARNING" };
  }
  if (cityCount >= CITY_WARNING_COUNT) {
    return { level: "WARNING", reason: "CITY_VARIANCE_WARNING" };
  }

  return null;
}

function riskDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function scopeKey(input: { kind: SubscriptionAccessKind; userId?: string | null; subscriptionId?: string | null }) {
  if (input.kind === "SINGLE") return `subscription:${input.subscriptionId}`;
  return `aggregate:${input.userId}`;
}

async function getTargetLabel(input: { userId?: string | null; subscriptionId?: string | null }, db: DbClient) {
  if (input.subscriptionId) {
    const subscription = await db.userSubscription.findUnique({
      where: { id: input.subscriptionId },
      select: {
        plan: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    if (subscription) return `${subscription.user.email} / ${subscription.plan.name}`;
  }

  if (input.userId) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    return user?.email ?? input.userId;
  }

  return null;
}

function revalidateRiskViews(subscriptionIds: string[] = []) {
  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  for (const id of subscriptionIds) {
    revalidatePath(`/admin/subscriptions/${id}`);
    revalidatePath(`/subscriptions/${id}`);
  }
}

async function disableProxyClient(subscriptionId: string) {
  const client = await prisma.nodeClient.findUnique({
    where: { subscriptionId },
    select: {
      id: true,
      uuid: true,
      inbound: {
        select: {
          panelInboundId: true,
          server: true,
        },
      },
    },
  });

  if (!client) return null;
  if (client.inbound.panelInboundId == null) {
    throw new Error("3x-ui 入站 ID 缺失，请重新同步节点入站");
  }

  const adapter = createPanelAdapter(client.inbound.server);
  await adapter.login();
  await adapter.updateClientEnable(client.inbound.panelInboundId, client.uuid, false);

  await prisma.nodeClient.update({
    where: { id: client.id },
    data: { isEnabled: false },
  });

  return client.id;
}

async function suspendSubscriptionForRisk(subscriptionId: string, message: string) {
  const subscription = await prisma.userSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: true,
    },
  });

  if (!subscription || subscription.status !== "ACTIVE") {
    return false;
  }

  let disableError: string | null = null;
  if (subscription.plan.type === "PROXY") {
    try {
      await disableProxyClient(subscription.id);
    } catch (error) {
      disableError = error instanceof Error ? error.message : String(error);
    }
  }

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { status: "SUSPENDED" },
  });

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "ERROR",
    title: "订阅已自动暂停",
    body: `${subscription.plan.name} 因订阅访问地区异常已被系统暂停，请联系管理员确认。`,
    link: `/subscriptions/${subscription.id}`,
    dedupeKey: `risk:suspended:${subscription.id}:${riskDayKey()}`,
  });

  await recordAuditLog({
    action: "subscription.auto_suspend",
    targetType: "UserSubscription",
    targetId: subscription.id,
    targetLabel: `${subscription.user.email} / ${subscription.plan.name}`,
    message,
    metadata: {
      reason: "subscription_access_risk",
      disableProxyClientError: disableError,
    },
  });

  return true;
}

async function suspendScopeForRisk(input: {
  kind: SubscriptionAccessKind;
  userId?: string | null;
  subscriptionId?: string | null;
  message: string;
}) {
  if (input.kind === "SINGLE" && input.subscriptionId) {
    const suspended = await suspendSubscriptionForRisk(input.subscriptionId, input.message);
    return suspended ? [input.subscriptionId] : [];
  }

  if (input.kind === "AGGREGATE" && input.userId) {
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId: input.userId,
        status: "ACTIVE",
        plan: { type: "PROXY" },
      },
      select: { id: true },
    });

    const suspendedIds: string[] = [];
    for (const subscription of subscriptions) {
      const suspended = await suspendSubscriptionForRisk(subscription.id, input.message);
      if (suspended) suspendedIds.push(subscription.id);
    }

    return suspendedIds;
  }

  return [];
}

async function createRiskEvent(input: {
  kind: SubscriptionAccessKind;
  userId?: string | null;
  subscriptionId?: string | null;
  ip: string;
  decision: RiskDecision;
  message: string;
  windowStartedAt: Date;
  countryLabels: string[];
  regionLabels: string[];
  cityLabels: string[];
  db: DbClient;
}) {
  const dedupeKey = [
    "subscription-risk",
    scopeKey(input),
    input.decision.reason,
    riskDayKey(),
  ].join(":");

  const existing = await input.db.subscriptionRiskEvent.findUnique({
    where: { dedupeKey },
  });
  if (existing) return { event: existing, created: false };

  const event = await input.db.subscriptionRiskEvent.create({
    data: {
      userId: input.userId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      kind: input.kind,
      level: input.decision.level,
      reason: input.decision.reason,
      ip: input.ip === "unknown" ? null : input.ip,
      countryCount: input.countryLabels.length,
      regionCount: input.regionLabels.length,
      cityCount: input.cityLabels.length,
      countryKeys: input.countryLabels as Prisma.InputJsonValue,
      regionKeys: input.regionLabels as Prisma.InputJsonValue,
      cityKeys: input.cityLabels as Prisma.InputJsonValue,
      message: input.message,
      dedupeKey,
      windowStartedAt: input.windowStartedAt,
    },
  });

  return { event, created: true };
}

async function evaluateSubscriptionRisk(input: {
  kind: SubscriptionAccessKind;
  userId?: string | null;
  subscriptionId?: string | null;
  ip: string;
  db: DbClient;
}): Promise<RiskEvaluationResult> {
  if (!input.userId) return { warned: false, suspended: false };
  if (input.kind === "SINGLE" && !input.subscriptionId) return { warned: false, suspended: false };

  const windowStartedAt = new Date(Date.now() - RISK_WINDOW_HOURS * 60 * 60 * 1000);
  const logs = await input.db.subscriptionAccessLog.findMany({
    where: {
      allowed: true,
      createdAt: { gte: windowStartedAt },
      ...(input.kind === "SINGLE"
        ? { kind: "SINGLE", subscriptionId: input.subscriptionId }
        : { kind: "AGGREGATE", userId: input.userId }),
    },
    select: {
      country: true,
      region: true,
      regionCode: true,
      city: true,
    },
  });

  const countryMap = new Map<string, string>();
  const regionMap = new Map<string, string>();
  const cityMap = new Map<string, string>();

  for (const log of logs) {
    addLocationKey(countryMap, [log.country], [log.country]);

    if (hasLocationPart(log.regionCode) || hasLocationPart(log.region)) {
      addLocationKey(
        regionMap,
        [log.country, log.regionCode ?? log.region],
        [log.country, log.region ?? log.regionCode],
      );
    }

    if (hasLocationPart(log.city)) {
      addLocationKey(
        cityMap,
        [log.country, log.regionCode ?? log.region, log.city],
        [log.country, log.region ?? log.regionCode, log.city],
      );
    }
  }

  const countryLabels = Array.from(countryMap.values());
  const regionLabels = Array.from(regionMap.values());
  const cityLabels = Array.from(cityMap.values());
  const decision = decideRisk(cityLabels.length, regionLabels.length);
  if (!decision) return { warned: false, suspended: false };

  const message = riskMessage({
    decision,
    kind: input.kind,
    ip: input.ip,
    cityCount: cityLabels.length,
    regionCount: regionLabels.length,
    cityLabels,
    regionLabels,
  });

  const { event, created } = await createRiskEvent({
    ...input,
    decision,
    message,
    windowStartedAt,
    countryLabels,
    regionLabels,
    cityLabels,
    db: input.db,
  });

  const targetLabel = created
    ? await getTargetLabel({ userId: input.userId, subscriptionId: input.subscriptionId }, input.db)
    : null;

  if (created) {
    await recordAuditLog({
      action: decision.level === "SUSPENDED" ? "risk.subscription.suspend" : "risk.subscription.warning",
      targetType: input.subscriptionId ? "UserSubscription" : "User",
      targetId: input.subscriptionId ?? input.userId ?? null,
      targetLabel,
      message,
      metadata: {
        eventId: event.id,
        reason: decision.reason,
        kind: input.kind,
        ip: input.ip,
        countryCount: countryLabels.length,
        regionCount: regionLabels.length,
        cityCount: cityLabels.length,
        windowStartedAt: windowStartedAt.toISOString(),
      },
    }, input.db);

    if (input.userId && decision.level === "WARNING") {
      await createNotification({
        userId: input.userId,
        type: "SUBSCRIPTION",
        level: "WARNING",
        title: "订阅访问异常",
        body: "检测到订阅链接在多个地区访问。如果不是你本人操作，请重置订阅访问并联系管理员。",
        link: input.subscriptionId ? `/subscriptions/${input.subscriptionId}` : "/subscriptions",
        dedupeKey: `risk:warning:${event.id}`,
      }, input.db);
    }
  }

  if (decision.level === "SUSPENDED") {
    const suspendedIds = await suspendScopeForRisk({
      kind: input.kind,
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      message,
    });
    revalidateRiskViews(suspendedIds);
    return { warned: false, suspended: true, eventId: event.id };
  }

  if (created) revalidateRiskViews(input.subscriptionId ? [input.subscriptionId] : []);
  return { warned: true, suspended: false, eventId: event.id };
}

export async function recordSubscriptionAccess(
  input: RecordSubscriptionAccessInput,
  db: DbClient = prisma,
): Promise<RiskEvaluationResult> {
  await db.subscriptionAccessLog.create({
    data: {
      userId: input.userId ?? null,
      subscriptionId: input.subscriptionId ?? null,
      kind: input.kind,
      ip: input.context.ip,
      userAgent: input.context.userAgent,
      country: input.context.geo.country,
      region: input.context.geo.region,
      regionCode: input.context.geo.regionCode,
      city: input.context.geo.city,
      latitude: input.context.geo.latitude,
      longitude: input.context.geo.longitude,
      geoSource: input.context.geo.source,
      allowed: input.allowed ?? true,
      reason: input.reason ?? null,
    },
  });

  if (input.allowed === false || input.evaluateRisk === false) {
    return { warned: false, suspended: false };
  }

  return evaluateSubscriptionRisk({
    kind: input.kind,
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    ip: input.context.ip,
    db,
  });
}
