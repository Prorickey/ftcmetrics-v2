import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

// Import routes
import events from "./routes/events";
import teams from "./routes/teams";

// Create the main app
const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "FTC Metrics API",
    version: "0.0.1",
    status: "ok",
    season: "DECODE 2025-2026",
  });
});

app.get("/api/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Mount routes
app.route("/api/events", events);
app.route("/api/teams", teams);

// Start server
const port = parseInt(process.env.PORT || "3001", 10);

console.log(`🚀 FTC Metrics API running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
