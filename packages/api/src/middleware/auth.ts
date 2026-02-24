import { Context, Next } from "hono";
import { createHash } from "crypto";
import { prisma } from "@ftcmetrics/db";
import { getRedis } from "../lib/redis";

/**
 * Extract the NextAuth session token from cookies.
 * In production, the cookie is prefixed with __Secure-.
 */
function getSessionToken(c: Context): string | undefined {
  const cookieHeader = c.req.header("Cookie");
  if (!cookieHeader) return undefined;

  // Parse cookies manually to avoid dependency
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    if (key) {
      cookies[key.trim()] = rest.join("=").trim();
    }
  }

  // Try production cookie name first, then dev
  return (
    cookies["__Secure-authjs.session-token"] ||
    cookies["authjs.session-token"]
  );
}

/**
 * Extract a Bearer token from the Authorization header.
 * Only returns the token if it starts with "ftcm_".
 */
function getBearerToken(c: Context): string | undefined {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return undefined;

  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return undefined;

  const token = match[1];
  return token.startsWith("ftcm_") ? token : undefined;
}

/**
 * Returns the SHA-256 hex digest of a given string.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Authentication middleware that verifies the NextAuth session
 * by looking up the session token in the database.
 */
export async function authMiddleware(c: Context, next: Next) {
  const sessionToken = getSessionToken(c);

  if (!sessionToken) {
    return c.json(
      { success: false, error: "Authentication required" },
      401
    );
  }

  try {
    // Look up session in database and include user data
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!session) {
      return c.json(
        { success: false, error: "Invalid session" },
        401
      );
    }

    // Check session expiry
    if (session.expires < new Date()) {
      return c.json(
        { success: false, error: "Session expired" },
        401
      );
    }

    // Attach verified user to context
    c.set("user", session.user);
    c.set("userId", session.userId);

    await next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json(
      { success: false, error: "Authentication failed" },
      500
    );
  }
}

/**
 * Optional auth middleware - doesn't require auth but attaches user if present.
 * Supports both NextAuth session cookies and Bearer API key tokens.
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const sessionToken = getSessionToken(c);

  if (sessionToken) {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionToken },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (session && session.expires > new Date()) {
        c.set("user", session.user);
        c.set("userId", session.userId);
      }
    } catch (error) {
      // Continue without auth on error
      console.error("Optional auth middleware error:", error);
    }
  } else {
    // No session found — try Bearer token auth
    const bearerToken = getBearerToken(c);

    if (bearerToken) {
      try {
        const keyHash = hashApiKey(bearerToken);
        const apiKey = await prisma.apiKey.findUnique({
          where: { keyHash },
        });

        if (
          apiKey &&
          apiKey.revokedAt === null &&
          (apiKey.expiresAt === null || apiKey.expiresAt > new Date())
        ) {
          c.set("userId", apiKey.userId);

          const user = await prisma.user.findUnique({
            where: { id: apiKey.userId },
            select: { id: true, name: true, email: true },
          });

          if (user) {
            c.set("user", user);
          }

          c.set("apiKeyScopes", apiKey.scopes);

          // Fire-and-forget lastUsedAt update
          prisma.apiKey
            .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
            .catch(() => {});
        }
      } catch (error) {
        // Continue without auth on error
        console.error("Bearer token auth error:", error);
      }
    }
  }

  await next();
}

/**
 * Scope-based authorization middleware factory.
 * Session users are always allowed through. API key users must have the required scope.
 */
export function requireScope(scope: string) {
  return async (c: Context, next: Next) => {
    const apiKeyScopes: string[] | undefined = c.get("apiKeyScopes");

    // Session-authenticated user — no scope restriction
    if (!apiKeyScopes) {
      await next();
      return;
    }

    // API key user — verify scope is present
    if (!apiKeyScopes.includes(scope)) {
      return c.json(
        {
          success: false,
          error: `Insufficient scope. Required: ${scope}`,
        },
        403
      );
    }

    await next();
  };
}

/**
 * Team membership validation middleware
 * Must be used after authMiddleware
 */
export function requireTeamMembership(paramName: string = "teamId") {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    const teamId = c.req.param(paramName);

    if (!userId) {
      return c.json(
        { success: false, error: "Authentication required" },
        401
      );
    }

    if (!teamId) {
      return c.json(
        { success: false, error: "Team ID required" },
        400
      );
    }

    try {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: { userId, teamId },
        },
      });

      if (!membership) {
        return c.json(
          { success: false, error: "Not a team member" },
          403
        );
      }

      c.set("membership", membership);
      c.set("teamRole", membership.role);

      await next();
    } catch (error) {
      console.error("Team membership middleware error:", error);
      return c.json(
        { success: false, error: "Authorization failed" },
        500
      );
    }
  };
}

/**
 * Rate limiting middleware backed by Redis.
 * Falls back to allowing requests if Redis is unavailable.
 */
export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (c: Context, next: Next) => {
    const identifier =
      c.get("userId") ||
      c.req.header("X-Forwarded-For") ||
      "anonymous";
    const redisKey = `rate:${identifier}:${c.req.path}`;

    const redis = getRedis();
    if (!redis) {
      // Redis unavailable — degrade open
      await next();
      return;
    }

    try {
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, windowSeconds);
      }

      if (count > maxRequests) {
        const ttl = await redis.ttl(redisKey);
        return c.json(
          {
            success: false,
            error: "Rate limit exceeded",
            retryAfter: ttl > 0 ? ttl : windowSeconds,
          },
          429
        );
      }
    } catch {
      // Redis error — degrade open
    }

    await next();
  };
}

/**
 * Input sanitization middleware
 * Trims strings and removes potentially dangerous characters
 */
export async function sanitizeInput(c: Context, next: Next) {
  const method = c.req.method.toUpperCase();
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    c.req.header("Content-Type")?.includes("application/json")
  ) {
    try {
      const body = await c.req.json();
      const sanitized = sanitizeObject(body);
      // Store sanitized body for later use
      c.set("sanitizedBody", sanitized);
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
  }

  await next();
}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    // Trim whitespace and remove null bytes
    return obj.trim().replace(/\0/g, "");
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip prototype pollution attempts
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}
