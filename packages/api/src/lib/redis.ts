/**
 * Redis Client Singleton
 *
 * Provides a shared Redis connection for caching FTC API responses.
 * Gracefully degrades — app works identically if Redis is unavailable.
 */

import Redis from "ioredis";

let redisInstance: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisInstance) return redisInstance;

  const url = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisInstance = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      commandTimeout: 2000,
      retryStrategy(times) {
        // Reconnect with backoff, cap at 5s
        return Math.min(times * 500, 5000);
      },
    });

    redisInstance.on("error", (err) => {
      console.warn("[Redis] Connection error:", err.message);
    });

    // Initiate connection (non-blocking, won't throw)
    redisInstance.connect().catch(() => {
      // Swallowed — errors surface via the "error" event above
    });
  } catch {
    console.warn("[Redis] Failed to create client, caching disabled");
    redisInstance = null;
  }

  return redisInstance;
}

/**
 * Check if Redis is reachable. Returns true/false, never throws.
 */
export async function isRedisHealthy(): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
