import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent, isAuthError } from "@/lib/agent-auth";
import { getAppConfig } from "@/services/app-config";

/**
 * POST /api/agent/latency
 * Probe agent pushes three-carrier TCP ping latency results.
 * Body: { latencies: [{ carrier: "telecom"|"unicom"|"mobile", latencyMs: number }] }
 */
export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (isAuthError(auth)) return auth;
  const { nodeId } = auth;
  const config = await getAppConfig();

  if (!config.networkInsightsEnabled) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: {
    latencies: Array<{ carrier: string; latencyMs: number }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效 JSON，期望格式：{ latencies: [{ carrier, latencyMs }] }" }, { status: 400 });
  }

  if (!Array.isArray(body.latencies) || body.latencies.length === 0) {
    return NextResponse.json({ error: "缺少延迟数据：latencies 必须是非空数组" }, { status: 400 });
  }

  const validCarriers = new Set(["telecom", "unicom", "mobile"]);

  for (const entry of body.latencies) {
    if (!validCarriers.has(entry.carrier)) continue;
    const latencyMs = Math.trunc(entry.latencyMs);
    if (!Number.isFinite(latencyMs) || latencyMs < 0) continue;

    await prisma.nodeLatency.upsert({
      where: {
        nodeId_carrier: { nodeId, carrier: entry.carrier },
      },
      create: {
        nodeId,
        carrier: entry.carrier,
        latencyMs,
      },
      update: {
        latencyMs,
        checkedAt: new Date(),
      },
    });

    await prisma.nodeLatencyLog.create({
      data: { nodeId, carrier: entry.carrier, latencyMs },
    });
  }

  return NextResponse.json({ ok: true });
}
