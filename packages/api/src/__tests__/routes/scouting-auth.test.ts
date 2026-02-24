import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockPrisma } from "../setup";

vi.mock("../../lib/ftc-api", () => ({
  getFTCApi: () => ({
    getScores: vi.fn().mockRejectedValue(new Error("mocked")),
  }),
}));

const VALID_TEAM_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const USER_ID = "user-123";
const SCOUTED_TEAM_ID = "scouted-team-id";

function validPayload() {
  return {
    scoutedTeamNumber: 8569,
    eventCode: "USTXCMP",
    matchNumber: 1,
    alliance: "RED",
    scoutingTeamId: VALID_TEAM_ID,
    autoClassifiedCount: 0,
    autoOverflowCount: 0,
    autoPatternCount: 0,
    teleopClassifiedCount: 0,
    teleopOverflowCount: 0,
    teleopDepotCount: 0,
    teleopPatternCount: 0,
    teleopMotifCount: 0,
    endgameBaseStatus: "NONE",
    autoLeave: false,
  };
}

function mockValidSession() {
  mockPrisma.session.findUnique.mockResolvedValue({
    sessionToken: "valid-token",
    userId: USER_ID,
    expires: new Date(Date.now() + 86400000),
    user: { id: USER_ID, name: "Test", email: "test@test.com" },
  });
}

async function createApp() {
  const { authMiddleware, sanitizeInput } = await import("../../middleware/auth");
  const scouting = (await import("../../routes/scouting")).default;
  const app = new Hono();
  app.use("/api/scouting/*", sanitizeInput);
  app.use("/api/scouting/*", authMiddleware);
  app.route("/api/scouting", scouting);
  return app;
}

describe("Scouting route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure event mock exists
    if (!(mockPrisma as any).event) {
      (mockPrisma as any).event = { findUnique: vi.fn(), create: vi.fn() };
    }
  });

  it("returns 401 when no session cookie provided", async () => {
    const app = await createApp();
    const res = await app.request("/api/scouting/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload()),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when session is invalid", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const app = await createApp();
    const res = await app.request("/api/scouting/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "authjs.session-token=invalid-token",
      },
      body: JSON.stringify(validPayload()),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member of the scouting team", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue(null);

    const app = await createApp();
    const res = await app.request("/api/scouting/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: JSON.stringify(validPayload()),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Not a member");
  });

  it("returns 403 when user has FRIEND role", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: VALID_TEAM_ID,
      role: "FRIEND",
    });

    const app = await createApp();
    const res = await app.request("/api/scouting/entries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: JSON.stringify(validPayload()),
    });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("view-only");
  });

  it("returns 200 when authenticated STUDENT submits entry", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: VALID_TEAM_ID,
      role: "STUDENT",
    });
    mockPrisma.team.findUnique.mockResolvedValue({
      id: SCOUTED_TEAM_ID,
      teamNumber: 8569,
    });
    (mockPrisma as any).event.findUnique.mockResolvedValue({ eventCode: "USTXCMP" });
    mockPrisma.scoutingEntry.create.mockResolvedValue({
      id: "entry-1",
      ...validPayload(),
      autoScore: 0,
      teleopScore: 0,
      endgameScore: 0,
      totalScore: 0,
    });

    const app = await createApp();
    const res = await app.request("/api/scouting/entries?autoDeduct=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: JSON.stringify(validPayload()),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
