import { config } from "dotenv";
import path from "path";

// Load .env from workspace root
config({ path: path.resolve(process.cwd(), "../../.env") });

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prisma } from "@ftcmetrics/db";

// Import routes
import events from "./routes/events";
import teams from "./routes/teams";
import userTeams from "./routes/user-teams";
import scouting from "./routes/scouting";
import analytics from "./routes/analytics";

// Import middleware
import { rateLimit, sanitizeInput } from "./middleware/auth";

// Create the main app
const app = new Hono();

// Global Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

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
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "healthy";
  } catch {
    checks.database = "unhealthy";
  }

  const allHealthy = Object.values(checks).every((s) => s === "healthy");

  return c.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    allHealthy ? 200 : 503
  );
});

// Mount routes
app.route("/api/events", events);
app.route("/api/teams", teams);
app.route("/api/user-teams", userTeams);
app.route("/api/scouting", scouting);
app.route("/api/analytics", analytics);

// Start server
const port = parseInt(process.env.PORT || "3001", 10);

console.log(`🚀 FTC Metrics API running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
