import { NextResponse } from "next/server";
import { getLatencyRecommendations } from "@/services/latency-recommendations";
import { getAppConfig } from "@/services/app-config";

export async function GET() {
  const config = await getAppConfig();
  if (!config.networkInsightsEnabled) {
    return NextResponse.json({
      items: [],
      updatedAt: new Date().toISOString(),
      refreshIntervalMs: 5 * 60 * 1000,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const items = await getLatencyRecommendations();
  return NextResponse.json({
    items,
    updatedAt: new Date().toISOString(),
    refreshIntervalMs: 5 * 60 * 1000,
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
