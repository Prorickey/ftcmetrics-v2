import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";
import { randomBytes, createHash } from "crypto";

const app = new Hono();

const VALID_SCOPES = ["events:read", "teams:read", "analytics:read", "rankings:read"];

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(32);
  const raw = `ftcm_${bytes.toString("base64url")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = `ftcm_${bytes.toString("base64url").slice(0, 4)}...`;
  return { raw, hash, prefix };
}

// POST / - Create a new API key
app.post("/", async (c) => {
  const userId = (c as any).get("userId");
  if (!userId) return c.json({ success: false, error: "Authentication required" }, 401);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ success: false, error: "Invalid JSON" }, 400); }

  const { name, scopes, expiresAt } = body;

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 64) {
    return c.json({ success: false, error: "Name is required (max 64 characters)" }, 400);
  }

  // Validate scopes
  if (!Array.isArray(scopes) || scopes.length === 0 || !scopes.every((s: string) => VALID_SCOPES.includes(s))) {
    return c.json({ success: false, error: `Invalid scopes. Valid: ${VALID_SCOPES.join(", ")}` }, 400);
  }

  // Validate expiresAt if provided
  let parsedExpiry: Date | null = null;
  if (expiresAt) {
    parsedExpiry = new Date(expiresAt);
    if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      return c.json({ success: false, error: "expiresAt must be a future date" }, 400);
    }
  }

  // Check max 10 active keys
  const activeCount = await prisma.apiKey.count({
    where: { userId, revokedAt: null },
  });
  if (activeCount >= 10) {
    return c.json({ success: false, error: "Maximum 10 active API keys allowed" }, 400);
  }

  const { raw, hash, prefix } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: userId as string,
      name: name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
      scopes: [...new Set(scopes)],
      expiresAt: parsedExpiry,
    },
  });

  return c.json({
    success: true,
    data: {
      id: apiKey.id,
      name: apiKey.name,
      key: raw, // Only shown once
      prefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    },
  }, 201);
});

// GET / - List user's API keys
app.get("/", async (c) => {
  const userId = (c as any).get("userId");
  if (!userId) return c.json({ success: false, error: "Authentication required" }, 401);

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ success: true, data: keys });
});

// DELETE /:keyId - Revoke an API key
app.delete("/:keyId", async (c) => {
  const userId = (c as any).get("userId");
  if (!userId) return c.json({ success: false, error: "Authentication required" }, 401);

  const keyId = c.req.param("keyId");

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, userId },
  });

  if (!apiKey) {
    return c.json({ success: false, error: "API key not found" }, 404);
  }

  if (apiKey.revokedAt) {
    return c.json({ success: false, error: "API key already revoked" }, 400);
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return c.json({ success: true });
});

export default app;
