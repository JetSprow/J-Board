import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import { getConfiguredSiteUrl } from "@/services/site-url";
import { sanitizeInboundSettings } from "@/services/node-inbound-sanitize";

const nodeSelect = {
  id: true,
  name: true,
  panelUrl: true,
  panelUsername: true,
  status: true,
  agentToken: true,
  _count: { select: { inbounds: true } },
  inbounds: {
    where: { isActive: true },
    select: {
      id: true,
      protocol: true,
      port: true,
      tag: true,
      settings: true,
    },
    orderBy: { updatedAt: "desc" },
  },
} satisfies Prisma.NodeServerSelect;

export type NodeServerRow = Prisma.NodeServerGetPayload<{
  select: typeof nodeSelect;
}>;

export async function getNodeServers(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { panelUrl: { contains: q } },
          ],
        }
      : {}),
  } satisfies Prisma.NodeServerWhereInput;

  const [nodes, total, siteUrl] = await Promise.all([
    prisma.nodeServer.findMany({
      where,
      select: nodeSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.nodeServer.count({ where }),
    getConfiguredSiteUrl(),
  ]);

  const safeNodes = nodes.map((node) => ({
    ...node,
    agentToken: node.agentToken ? "configured" : null,
    inbounds: node.inbounds.map((inbound) => ({
      ...inbound,
      settings: sanitizeInboundSettings(inbound.settings),
    })),
  }));

  return { nodes: safeNodes, total, page, pageSize, filters: { q, status }, siteUrl };
}
