import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyTraceRoute } from "@/lib/route-classify";
import { normalizeTraceHops } from "@/lib/trace-normalize";
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

  const traces = await prisma.routeTrace.findMany({
    where: { nodeId: { in: nodeIds } },
    orderBy: { updatedAt: "desc" },
  });

  const result: Record<string, { carrier: string; summary: string; hopCount: number; hops: unknown; updatedAt: string }[]> = {};
  for (const row of traces) {
    if (!result[row.nodeId]) {
      result[row.nodeId] = [];
    }
    result[row.nodeId].push({
      carrier: row.carrier,
      summary: classifyTraceRoute({ summary: row.summary, hops: normalizeTraceHops(row.hops) }),
      hopCount: row.hopCount,
      hops: row.hops,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return NextResponse.json(result);
}
