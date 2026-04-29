import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RANGES: Record<string, { ms: number; bucketMs: number }> = {
  "1d": { ms: 24 * 60 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
  "7d": { ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
  "30d": { ms: 30 * 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000 },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");
  const range = searchParams.get("range") ?? "1d";

  if (!nodeId || nodeId.length > 128 || !RANGES[range]) {
    return NextResponse.json(
      { error: "参数错误：nodeId 不能为空且长度不超过 128，range 只能是 1d、7d 或 30d" },
      { status: 400 },
    );
  }

  const { ms, bucketMs } = RANGES[range];
  const since = new Date(Date.now() - ms);

  const logs = await prisma.nodeLatencyLog.findMany({
    where: { nodeId, checkedAt: { gte: since } },
    orderBy: { checkedAt: "asc" },
    select: { carrier: true, latencyMs: true, checkedAt: true },
  });

  // Check data sufficiency: span covers at least 50% of range
  let sufficient = false;
  if (logs.length >= 2) {
    const span = logs[logs.length - 1].checkedAt.getTime() - logs[0].checkedAt.getTime();
    sufficient = span >= ms * 0.5;
  }

  // Bucket aggregation
  const carriers = new Set<string>();
  const buckets = new Map<number, Map<string, { sum: number; count: number }>>();

  for (const log of logs) {
    carriers.add(log.carrier);
    const bucket = Math.floor(log.checkedAt.getTime() / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) buckets.set(bucket, new Map());
    const carrierMap = buckets.get(bucket)!;
    if (!carrierMap.has(log.carrier)) carrierMap.set(log.carrier, { sum: 0, count: 0 });
    const entry = carrierMap.get(log.carrier)!;
    entry.sum += log.latencyMs;
    entry.count += 1;
  }

  const sortedBuckets = [...buckets.keys()].sort((a, b) => a - b);
  const carrierList = [...carriers].sort();

  const points = sortedBuckets.map((bucket) => {
    const carrierMap = buckets.get(bucket)!;
    const point: Record<string, string | number> = {
      time: new Date(bucket).toISOString(),
    };
    for (const c of carrierList) {
      const entry = carrierMap.get(c);
      point[c] = entry ? Math.round(entry.sum / entry.count) : 0;
    }
    return point;
  });

  return NextResponse.json({ carriers: carrierList, points, sufficient });
}
