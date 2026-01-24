import { Context, Next } from "hono";
import { prisma } from "@ftcmetrics/db";

/**
 * Authentication middleware that validates user ID from header
 * and attaches user info to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json(
      { success: false, error: "Authentication required" },
      401
    );
  }

  try {
    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return c.json(
        { success: false, error: "Invalid user" },
        401
      );
    }

    // Attach user to context
    c.set("user", user);
    c.set("userId", userId);

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
 * Optional auth middleware - doesn't require auth but attaches user if present
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const userId = c.req.header("X-User-Id");

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (user) {
        c.set("user", user);
        c.set("userId", userId);
      }
    } catch (error) {
      // Continue without auth on error
      console.error("Optional auth middleware error:", error);
    }
  }

  await next();
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
 * Team mentor/admin validation middleware
 * Must be used after requireTeamMembership
 */
export async function requireMentorRole(c: Context, next: Next) {
  const role = c.get("teamRole");

  if (role !== "MENTOR") {
    return c.json(
      { success: false, error: "Mentor access required" },
      403
    );
  }

  await next();
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 * For production, use Redis-backed rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  return async (c: Context, next: Next) => {
    const identifier = c.req.header("X-User-Id") || c.req.header("X-Forwarded-For") || "anonymous";
    const now = Date.now();
    const key = `${identifier}:${c.req.path}`;

    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= maxRequests) {
      return c.json(
        {
          success: false,
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
        429
      );
    } else {
      entry.count++;
    }

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of rateLimitStore) {
        if (now > v.resetAt) {
          rateLimitStore.delete(k);
        }
      }
    }

    await next();
  };
}

/**
 * Input sanitization middleware
 * Trims strings and removes potentially dangerous characters
 */
export async function sanitizeInput(c: Context, next: Next) {
  if (c.req.header("Content-Type")?.includes("application/json")) {
    try {
      const body = await c.req.json();
      const sanitized = sanitizeObject(body);
      // Store sanitized body for later use
      c.set("sanitizedBody", sanitized);
    } catch {
      // If body parsing fails, continue without sanitization
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
