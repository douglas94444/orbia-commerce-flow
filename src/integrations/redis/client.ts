import { getServerConfig } from "@/lib/config.server";

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<void>;
  setnx(key: string, value: string, ttlSec: number): Promise<boolean>;
  decrby(key: string, amount: number): Promise<number>;
  incrby(key: string, amount: number): Promise<number>;
  del(key: string): Promise<void>;
}

function upstashUrl(): string | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return `${url.replace(/\/$/, "")}`;
}

function upstashToken(): string | null {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? null;
}

async function upstashCommand<T>(command: unknown[]): Promise<T> {
  const base = upstashUrl();
  const token = upstashToken();
  if (!base || !token) throw new Error("Redis não configurado");

  const res = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const json = (await res.json()) as { result: T };
  return json.result;
}

let client: RedisClient | null = null;

export function getRedisClient(): RedisClient | null {
  if (!upstashUrl() || !upstashToken()) return null;
  if (client) return client;

  client = {
    async get(key) {
      return upstashCommand<string | null>(["GET", key]);
    },
    async set(key, value, opts) {
      if (opts?.ex) {
        await upstashCommand(["SET", key, value, "EX", opts.ex]);
      } else {
        await upstashCommand(["SET", key, value]);
      }
    },
    async setnx(key, value, ttlSec) {
      const result = await upstashCommand<string | null>([
        "SET",
        key,
        value,
        "NX",
        "EX",
        ttlSec,
      ]);
      return result === "OK";
    },
    async decrby(key, amount) {
      return upstashCommand<number>(["DECRBY", key, amount]);
    },
    async incrby(key, amount) {
      return upstashCommand<number>(["INCRBY", key, amount]);
    },
    async del(key) {
      await upstashCommand(["DEL", key]);
    },
  };

  return client;
}

export function stockRedisKey(clientId: string, sku: string): string {
  return `stock:${clientId}:${sku}`;
}

export function isRedisEnabled(): boolean {
  getServerConfig();
  return Boolean(upstashUrl() && upstashToken());
}
