// Server-only in-memory rate limiter (per Worker instance).
// For distributed limiting across all Workers, replace with a Cloudflare
// RateLimit binding configured in wrangler.toml.

interface Bucket {
  count: number;
  reset: number;
}

const store = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
