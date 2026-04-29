import { randomUUID } from "crypto";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitBuckets?: Map<string, Array<{ score: number; id: string }>>;
};

const buckets = globalForRateLimit.rateLimitBuckets ?? new Map<string, Array<{ score: number; id: string }>>();
globalForRateLimit.rateLimitBuckets = buckets;

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  for (const [bucketKey, items] of buckets) {
    const active = items.filter((item) => item.score > cutoff);
    if (active.length > 0) buckets.set(bucketKey, active);
    else buckets.delete(bucketKey);
  }

  const bucket = buckets.get(key) ?? [];
  bucket.push({ score: now, id: `${now}:${randomUUID()}` });
  buckets.set(key, bucket);

  const count = bucket.length;
  return {
    success: count <= limit,
    remaining: Math.max(0, limit - count),
    reset: Math.ceil(windowSeconds - (now % windowMs) / 1000),
  };
}
