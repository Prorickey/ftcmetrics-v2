import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockPrisma } from "../setup";

const mockGetEvent = vi.fn();
vi.mock("../../lib/ftc-api", () => ({
  getFTCApi: () => ({
    getEvent: mockGetEvent,
    getEvents: vi.fn().mockResolvedValue({ events: [] }),
  }),
}));

async function createApp() {
  const { optionalAuthMiddleware } = await import("../../middleware/auth");
  const events = (await import("../../routes/events")).default;
  const app = new Hono();
  app.use("/api/events/*", optionalAuthMiddleware);
  app.route("/api/events", events);
  return app;
}

describe("Event code validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valid alphanumeric event code passes", async () => {
    mockGetEvent.mockResolvedValue({ events: [{ eventCode: "USTXCMP" }] });
    const app = await createApp();
    const res = await app.request("/api/events/USTXCMP");
    expect(res.status).toBe(200);
  });

  it("path traversal ../../ returns 400", async () => {
    const app = await createApp();
    const res = await app.request("/api/events/..%2F..%2Fetc");
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid event code");
  });

  it("SQL injection attempt returns 400", async () => {
    const app = await createApp();
    // Use a payload that reaches the route handler (no angle brackets)
    const res = await app.request("/api/events/1%27OR%271%27%3D%271");
    expect(res.status).toBe(400);
  });

  it("spaces in event code return 400", async () => {
    const app = await createApp();
    const res = await app.request("/api/events/US%20TX%20CMP");
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid event code");
  });

  it("event code with hyphens returns 400", async () => {
    const app = await createApp();
    const res = await app.request("/api/events/US-TX-CMP");
    expect(res.status).toBe(400);
  });
});
