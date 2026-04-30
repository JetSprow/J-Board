import type {
  Prisma,
  SubscriptionAccessKind,
  SubscriptionRiskEvent,
  SubscriptionRiskReason,
} from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { getSubscriptionStatusLabel, getSubscriptionTypeLabel } from "@/lib/domain-labels";

export const subscriptionRiskAccessLogSelect = {
  id: true,
  userId: true,
  subscriptionId: true,
  kind: true,
  ip: true,
  userAgent: true,
  country: true,
  region: true,
  regionCode: true,
  city: true,
  latitude: true,
  longitude: true,
  geoSource: true,
  allowed: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.SubscriptionAccessLogSelect;

export type SubscriptionRiskAccessLog = Prisma.SubscriptionAccessLogGetPayload<{
  select: typeof subscriptionRiskAccessLogSelect;
}>;

export type SubscriptionRiskUserBrief = {
  id: string;
  email: string;
  name: string | null;
  status?: string;
  createdAt?: Date;
};

export type SubscriptionRiskSubscriptionBrief = {
  id: string;
  status: string;
  endDate: Date;
  plan: {
    name: string;
    type: string;
  };
};

export type SubscriptionRiskGeoPoint = {
  key: string;
  ip: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  accessCount: number;
  lastSeenAt: string;
  allowed: boolean;
};

export type SubscriptionRiskCountrySummary = {
  country: string;
  accessCount: number;
  ipCount: number;
  regionCount: number;
  cityCount: number;
  topRegions: string[];
  topCities: string[];
};

export type SubscriptionRiskRecentAccess = {
  id: string;
  ip: string;
  location: string;
  allowed: boolean;
  reason: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type SubscriptionRiskAnalysisLog = SubscriptionRiskRecentAccess & {
  source: string;
  detailLines: string[];
};

export type SubscriptionRiskGeoSummary = {
  totalLogs: number;
  allowedLogs: number;
  blockedLogs: number;
  uniqueIpCount: number;
  uniqueCountryCount: number;
  uniqueRegionCount: number;
  uniqueCityCount: number;
  countries: SubscriptionRiskCountrySummary[];
  points: SubscriptionRiskGeoPoint[];
  recentAccesses: SubscriptionRiskRecentAccess[];
  analysisLogs: SubscriptionRiskAnalysisLog[];
};

type RiskEventScope = Pick<
  SubscriptionRiskEvent,
  "kind" | "userId" | "subscriptionId" | "windowStartedAt" | "createdAt"
>;

function safeLabel(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function normalizeKey(value: string | null | undefined, fallback: string) {
  return safeLabel(value, fallback).toLowerCase();
}

function locationLabel(log: Pick<SubscriptionRiskAccessLog, "country" | "region" | "regionCode" | "city">) {
  const parts = [log.country, log.region || log.regionCode, log.city]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "未知地区";
}

function parseCoordinate(value: string | null | undefined, min: number, max: number) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function analysisSource(log: Pick<SubscriptionRiskAccessLog, "kind" | "reason" | "userAgent">) {
  if (log.userAgent === "jboard-agent/xray-access-log" || log.reason?.includes("节点 Xray access log")) {
    return "节点 Xray 日志";
  }
  if (log.kind === "AGGREGATE") return "总订阅访问";
  return "订阅访问";
}

function splitAnalysisReason(reason: string | null | undefined) {
  return (reason ?? "")
    .split("；")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function uniquePreview(values: Iterable<string>, limit = 4) {
  const list = Array.from(new Set(Array.from(values).filter(Boolean)));
  if (list.length <= limit) return list;
  return [...list.slice(0, limit), `等 ${list.length} 项`];
}

export function reasonLabel(reason: SubscriptionRiskReason) {
  switch (reason) {
    case "CITY_VARIANCE_WARNING":
      return "城市异常警告";
    case "CITY_VARIANCE_SUSPEND":
      return "城市异常暂停";
    case "REGION_VARIANCE_WARNING":
      return "省/地区异常警告";
    case "REGION_VARIANCE_SUSPEND":
      return "省/地区异常暂停";
    case "COUNTRY_VARIANCE_WARNING":
      return "国家异常警告";
    case "COUNTRY_VARIANCE_SUSPEND":
      return "国家异常暂停";
    case "NODE_ACCESS_VOLUME_WARNING":
      return "节点高频警告";
    case "NODE_ACCESS_VOLUME_SUSPEND":
      return "节点高频暂停";
    case "NODE_ACCESS_TARGET_WARNING":
      return "目标分散警告";
    case "NODE_ACCESS_TARGET_SUSPEND":
      return "目标分散暂停";
  }
}

export function riskKindLabel(kind: SubscriptionAccessKind) {
  return kind === "AGGREGATE" ? "总订阅" : "单订阅";
}

export function getSubscriptionRiskLogWhere(event: RiskEventScope): Prisma.SubscriptionAccessLogWhereInput {
  const base: Prisma.SubscriptionAccessLogWhereInput = {
    createdAt: {
      gte: event.windowStartedAt,
      lte: event.createdAt,
    },
  };

  if (event.kind === "SINGLE" && event.subscriptionId) {
    return {
      ...base,
      kind: "SINGLE",
      subscriptionId: event.subscriptionId,
    };
  }

  if (event.kind === "AGGREGATE" && event.userId) {
    return {
      ...base,
      kind: "AGGREGATE",
      userId: event.userId,
    };
  }

  return {
    ...base,
    id: "__missing-risk-scope__",
  };
}

export async function getSubscriptionRiskAccessLogsForEvent(
  event: RiskEventScope,
  db: DbClient = prisma,
  take = 120,
) {
  return db.subscriptionAccessLog.findMany({
    where: getSubscriptionRiskLogWhere(event),
    select: subscriptionRiskAccessLogSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function buildSubscriptionRiskGeoSummary(logs: SubscriptionRiskAccessLog[]): SubscriptionRiskGeoSummary {
  const uniqueIps = new Set<string>();
  const uniqueCountries = new Set<string>();
  const uniqueRegions = new Set<string>();
  const uniqueCities = new Set<string>();
  const countryMap = new Map<string, {
    country: string;
    accessCount: number;
    ips: Set<string>;
    regions: Set<string>;
    cities: Set<string>;
  }>();
  const pointMap = new Map<string, SubscriptionRiskGeoPoint>();

  for (const log of logs) {
    uniqueIps.add(log.ip);

    const country = safeLabel(log.country, "未知国家/地区");
    const region = safeLabel(log.region || log.regionCode, "未知省/地区");
    const city = safeLabel(log.city, "未知城市");
    const countryKey = normalizeKey(log.country, "unknown-country");
    const regionKey = [countryKey, normalizeKey(log.regionCode || log.region, "unknown-region")].join(":");
    const cityKey = [regionKey, normalizeKey(log.city, "unknown-city")].join(":");

    uniqueCountries.add(countryKey);
    if (log.region || log.regionCode) uniqueRegions.add(regionKey);
    if (log.city) uniqueCities.add(cityKey);

    const countryItem = countryMap.get(countryKey) ?? {
      country,
      accessCount: 0,
      ips: new Set<string>(),
      regions: new Set<string>(),
      cities: new Set<string>(),
    };
    countryItem.accessCount += 1;
    countryItem.ips.add(log.ip);
    if (log.region || log.regionCode) countryItem.regions.add(region);
    if (log.city) countryItem.cities.add(city);
    countryMap.set(countryKey, countryItem);

    const latitude = parseCoordinate(log.latitude, -90, 90);
    const longitude = parseCoordinate(log.longitude, -180, 180);
    if (latitude == null || longitude == null) continue;

    const pointKey = [log.ip, latitude.toFixed(3), longitude.toFixed(3)].join(":");
    const existing = pointMap.get(pointKey);
    if (existing) {
      existing.accessCount += 1;
      if (new Date(log.createdAt).getTime() > new Date(existing.lastSeenAt).getTime()) {
        existing.lastSeenAt = log.createdAt.toISOString();
        existing.allowed = log.allowed;
      }
    } else {
      pointMap.set(pointKey, {
        key: pointKey,
        ip: log.ip,
        country,
        region,
        city,
        latitude,
        longitude,
        accessCount: 1,
        lastSeenAt: log.createdAt.toISOString(),
        allowed: log.allowed,
      });
    }
  }

  const countries = Array.from(countryMap.values())
    .map((item) => ({
      country: item.country,
      accessCount: item.accessCount,
      ipCount: item.ips.size,
      regionCount: item.regions.size,
      cityCount: item.cities.size,
      topRegions: uniquePreview(item.regions),
      topCities: uniquePreview(item.cities),
    }))
    .sort((a, b) => b.accessCount - a.accessCount || b.ipCount - a.ipCount || a.country.localeCompare(b.country));

  return {
    totalLogs: logs.length,
    allowedLogs: logs.filter((log) => log.allowed).length,
    blockedLogs: logs.filter((log) => !log.allowed).length,
    uniqueIpCount: uniqueIps.size,
    uniqueCountryCount: uniqueCountries.size,
    uniqueRegionCount: uniqueRegions.size,
    uniqueCityCount: uniqueCities.size,
    countries,
    points: Array.from(pointMap.values()).sort((a, b) => b.accessCount - a.accessCount),
    recentAccesses: logs.slice(0, 12).map((log) => ({
      id: log.id,
      ip: log.ip,
      location: locationLabel(log),
      allowed: log.allowed,
      reason: log.reason,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    })),
    analysisLogs: logs.slice(0, 40).map((log) => ({
      id: log.id,
      ip: log.ip,
      location: locationLabel(log),
      allowed: log.allowed,
      reason: log.reason,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
      source: analysisSource(log),
      detailLines: splitAnalysisReason(log.reason),
    })),
  };
}

function formatCountrySummary(summary: SubscriptionRiskGeoSummary) {
  if (summary.countries.length === 0) return "暂无可识别地区。";

  return summary.countries
    .slice(0, 8)
    .map((country) => {
      const regions = country.topRegions.length > 0 ? country.topRegions.join("、") : "未识别";
      const cities = country.topCities.length > 0 ? country.topCities.join("、") : "未识别";
      return `- ${country.country}：${country.ipCount} 个 IP，${country.regionCount} 个省/地区，${country.cityCount} 个城市，访问 ${country.accessCount} 次；省/地区：${regions}；城市：${cities}`;
    })
    .join("\n");
}

function formatAccessEvidence(summary: SubscriptionRiskGeoSummary) {
  if (summary.recentAccesses.length === 0) return "暂无访问明细。";

  return summary.recentAccesses
    .slice(0, 10)
    .map((access) => {
      const result = access.allowed ? "放行" : access.reason || "拦截";
      return `- ${formatDate(access.createdAt)} | ${access.ip} | ${access.location} | ${result}`;
    })
    .join("\n");
}

export function buildSubscriptionRiskReport(input: {
  event: SubscriptionRiskEvent;
  logs: SubscriptionRiskAccessLog[];
  user?: SubscriptionRiskUserBrief | null;
  subscription?: SubscriptionRiskSubscriptionBrief | null;
}) {
  const { event, logs, user, subscription } = input;
  const summary = buildSubscriptionRiskGeoSummary(logs);
  const target = subscription
    ? `${subscription.plan.name}（${getSubscriptionTypeLabel(subscription.plan.type)}，当前状态：${getSubscriptionStatusLabel(subscription.status)}）`
    : "用户总订阅";
  const userLabel = user ? `${user.email}${user.name ? `（${user.name}）` : ""}` : event.userId ?? "未知用户";
  const windowRange = `${formatDate(event.windowStartedAt)} 至 ${formatDate(event.createdAt)}`;
  const actionSuggestion = event.level === "SUSPENDED"
    ? "建议保持暂停，等待用户确认是否本人跨地区使用、订阅链接是否外泄或节点连接是否被共享，并在工单中补充说明后再解除限制。"
    : "建议先联系用户确认近期访问/连接来源；如果用户无法解释这些地区/IP，建议重置订阅链接并临时暂停相关订阅。";

  return [
    "订阅风控风险报告",
    "",
    `用户：${userLabel}`,
    `风控范围：${riskKindLabel(event.kind)} / ${target}`,
    `事件编号：${event.id}`,
    `触发时间：${formatDate(event.createdAt)}`,
    `检测窗口：${windowRange}`,
    `风险判定：${reasonLabel(event.reason)}（${event.level === "SUSPENDED" ? "已暂停" : "警告"}）`,
    "",
    "触发原因",
    event.message,
    "",
    "地区与 IP 概览",
    `- 访问记录：${summary.totalLogs} 条，其中放行 ${summary.allowedLogs} 条，拦截 ${summary.blockedLogs} 条`,
    `- 不同 IP：${summary.uniqueIpCount} 个`,
    `- 不同国家/地区：${summary.uniqueCountryCount} 个，不同省/地区：${summary.uniqueRegionCount} 个，不同城市：${summary.uniqueCityCount} 个`,
    formatCountrySummary(summary),
    "",
    "关键访问证据",
    formatAccessEvidence(summary),
    "",
    "处理建议",
    actionSuggestion,
  ].join("\n");
}

export async function getActiveSubscriptionRiskRestriction(userId: string, db: DbClient = prisma) {
  return db.subscriptionRiskEvent.findFirst({
    where: {
      userId,
      userRestrictionActive: true,
      reportSentAt: { not: null },
    },
    orderBy: { reportSentAt: "desc" },
    select: {
      id: true,
      level: true,
      reason: true,
      message: true,
      riskReport: true,
      reportSentAt: true,
      createdAt: true,
    },
  });
}
