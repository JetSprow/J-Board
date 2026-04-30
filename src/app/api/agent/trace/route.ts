import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent, isAuthError } from "@/lib/agent-auth";
import { normalizeTraceHops, normalizeTraceText } from "@/lib/trace-normalize";
import { classifyTraceRoute } from "@/lib/route-classify";
import { getAppConfig } from "@/services/app-config";

export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (isAuthError(auth)) return auth;
  const { nodeId } = auth;
  const config = await getAppConfig();

  if (!config.networkInsightsEnabled) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: {
    traces: Array<{
      carrier: string;
      hops: unknown;
      summary?: string;
      hopCount?: number;
    }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效 JSON，期望格式：{ traces: [{ carrier, hops }] }" }, { status: 400 });
  }

  if (!Array.isArray(body.traces) || body.traces.length === 0) {
    return NextResponse.json({ error: "缺少路由追踪数据：traces 必须是非空数组" }, { status: 400 });
  }

  const validCarriers = new Set(["telecom", "unicom", "mobile"]);

  for (const trace of body.traces) {
    if (!validCarriers.has(trace.carrier)) continue;
    const normalizedHops = normalizeTraceHops(trace.hops);
    const submittedSummary = normalizeTraceText(trace.summary);
    const normalizedSummary = classifyTraceRoute({ summary: submittedSummary, hops: normalizedHops });
    const hopCount = Number(trace.hopCount);
    const normalizedHopCount =
      Number.isFinite(hopCount) && hopCount > 0
        ? Math.trunc(hopCount)
        : normalizedHops.length;

    await prisma.routeTrace.upsert({
      where: {
        nodeId_carrier: {
          nodeId,
          carrier: trace.carrier,
        },
      },
      create: {
        nodeId,
        carrier: trace.carrier,
        hops: normalizedHops as object,
        summary: normalizedSummary,
        hopCount: normalizedHopCount,
      },
      update: {
        hops: normalizedHops as object,
        summary: normalizedSummary,
        hopCount: normalizedHopCount,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
