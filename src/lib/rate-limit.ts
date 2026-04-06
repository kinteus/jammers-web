type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type ConsumeRateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

declare global {
  var __jammersRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

const rateLimitStore = global.__jammersRateLimitStore ?? new Map<string, RateLimitBucket>();

if (!global.__jammersRateLimitStore) {
  global.__jammersRateLimitStore = rateLimitStore;
}

export function consumeRateLimit({ key, limit, windowMs }: ConsumeRateLimitOptions) {
  const now = Date.now();

  for (const [entryKey, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(entryKey);
    }
  }

  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function getClientIpFromHeaders(
  headers: Pick<Headers, "get"> | { get(name: string): string | null | undefined },
) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
