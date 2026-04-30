import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/services/app-config";

const MAX_NODE_IDS = 100;

export async function GET(req: Request) {
  const config = await getAppConfig();
  if (!config.networkInsightsEnabled) {
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }

  const { searchParams } = new URL(req.url);
  const nodeIds = [...new Set(searchParams.get("nodeIds")?.split(",").filter(Boolean) ?? [])]
    .slice(0, MAX_NODE_IDS);

  if (nodeIds.length === 0) {
    return NextResponse.json({});
  }

  const latencies = await prisma.nodeLatency.findMany({
    where: { nodeId: { in: nodeIds } },
    orderBy: { checkedAt: "desc" },
  });

  const result: Record<string, { carrier: string; latencyMs: number }[]> = {};
  for (const row of latencies) {
    if (!result[row.nodeId]) {
      result[row.nodeId] = [];
    }
    result[row.nodeId].push({
      carrier: row.carrier,
      latencyMs: row.latencyMs,
    });
  }

  return NextResponse.json(result);
}
