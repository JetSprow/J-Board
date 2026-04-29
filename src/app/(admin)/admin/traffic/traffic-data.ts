import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const trafficClientInclude = {
  user: true,
  inbound: { include: { server: true } },
  subscription: { include: { plan: true } },
} satisfies Prisma.NodeClientInclude;

export type TrafficClientRow = Prisma.NodeClientGetPayload<{
  include: typeof trafficClientInclude;
}>;

export interface TrafficTrendPoint {
  date: string;
  valueGb: number;
}

export interface TrafficOverview {
  totalClients: number;
  enabledClients: number;
  disabledClients: number;
  activeClients24h: number;
}

export async function getTrafficClients(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const protocol = typeof searchParams.protocol === "string" ? searchParams.protocol : "";

  const where = {
    ...(status ? { isEnabled: status === "enabled" } : {}),
    ...(protocol
      ? {
          inbound: {
            protocol: protocol as "VMESS" | "VLESS" | "TROJAN" | "SHADOWSOCKS" | "HYSTERIA2",
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { user: { email: { contains: q } } },
            { inbound: { server: { name: { contains: q } } } },
            { email: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.NodeClientWhereInput;

  const [clients, total] = await Promise.all([
    prisma.nodeClient.findMany({
      where,
      include: trafficClientInclude,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.nodeClient.count({ where }),
  ]);

  return { clients, total, page, pageSize, filters: { q, status, protocol } };
}

export async function getSiteTrafficTrend(days = 14): Promise<TrafficTrendPoint[]> {
  const trafficWindowStart = new Date();
  trafficWindowStart.setDate(trafficWindowStart.getDate() - days);

  const logs = await prisma.trafficLog.findMany({
    where: { timestamp: { gte: trafficWindowStart } },
    select: { timestamp: true, upload: true, download: true },
    orderBy: { timestamp: "asc" },
  });

  const trendMap = new Map<string, number>();
  for (const log of logs) {
    const day = new Date(log.timestamp).toISOString().slice(5, 10);
    const valueGb = Number(log.upload + log.download) / 1024 ** 3;
    trendMap.set(day, (trendMap.get(day) ?? 0) + valueGb);
  }

  return Array.from(trendMap.entries()).map(([date, valueGb]) => ({
    date,
    valueGb: Number(valueGb.toFixed(2)),
  }));
}

export async function getTrafficOverview(): Promise<TrafficOverview> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalClients, enabledClients, activeClientIds] = await Promise.all([
    prisma.nodeClient.count(),
    prisma.nodeClient.count({ where: { isEnabled: true } }),
    prisma.trafficLog.findMany({
      where: { timestamp: { gte: since } },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
  ]);

  return {
    totalClients,
    enabledClients,
    disabledClients: totalClients - enabledClients,
    activeClients24h: activeClientIds.length,
  };
}
