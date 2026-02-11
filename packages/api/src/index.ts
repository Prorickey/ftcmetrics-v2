import { config } from "dotenv";
import path from "path";
import fs from "fs";

// Load .env from workspace root
config({ path: path.resolve(process.cwd(), "../../.env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prisma } from "@ftcmetrics/db";
import { isRedisHealthy } from "./lib/redis";

// Import routes
import events from "./routes/events";
import teams from "./routes/teams";
import userTeams from "./routes/user-teams";
import scouting from "./routes/scouting";
import analytics from "./routes/analytics";
import rankings from "./routes/rankings";

// Import middleware
import { rateLimit, sanitizeInput } from "./middleware/auth";

// Create the main app
const app = new Hono();

// Global Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = [
        "http://localhost:3000",
        process.env.CORS_ORIGIN,
      ].filter(Boolean);
      return allowed.includes(origin) ? origin : allowed[0];
    },
    credentials: true,
  })
);

// Static file serving for uploads (before rate limiter)
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

app.get("/api/uploads/:filename", async (c) => {
  const filename = c.req.param("filename");

  // Validate filename: no path traversal
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const filePath = path.join(UPLOADS_DIR, filename);

  // Ensure resolved path is still within uploads dir
  if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_DIR))) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  try {
    await fs.promises.access(filePath);
  } catch {
    return c.json({ error: "File not found" }, 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const fileBuffer = await fs.promises.readFile(filePath);

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// Rate limiting (100 requests per minute per user/IP)
app.use("/api/*", rateLimit(100, 60000));

// Input sanitization for JSON requests
app.use("/api/*", sanitizeInput);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "FTC Metrics API",
    version: "0.0.1",
    status: "ok",
    season: "DECODE 2025-2026",
  });
});

app.get("/api/health", async (c) => {
  const checks: Record<string, string> = {
    api: "healthy",
    database: "unknown",
    redis: "unknown",
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "healthy";
  } catch {
    checks.database = "unhealthy";
  }

  // Check Redis connectivity (degraded, not unhealthy — app works without it)
  checks.redis = (await isRedisHealthy()) ? "healthy" : "degraded";

  const isHealthy =
    checks.api === "healthy" && checks.database === "healthy";
  const isDegraded = !isHealthy || checks.redis === "degraded";

  return c.json(
    {
      status: isHealthy ? (isDegraded ? "degraded" : "healthy") : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    },
    isHealthy ? 200 : 503
  );
});

// Mount routes
app.route("/api/events", events);
app.route("/api/teams", teams);
app.route("/api/user-teams", userTeams);
app.route("/api/scouting", scouting);
app.route("/api/analytics", analytics);
app.route("/api/rankings", rankings);

// Start server
const port = parseInt(process.env.PORT || "3001", 10);

console.log(`🚀 FTC Metrics API running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
