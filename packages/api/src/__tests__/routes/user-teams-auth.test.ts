import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockPrisma } from "../setup";

vi.mock("../../lib/ftc-api", () => ({
  getFTCApi: () => ({
    getTeam: vi.fn().mockResolvedValue({ teams: [] }),
  }),
}));

const TEAM_ID = "team-uuid-1234";
const USER_ID = "user-123";
const MEMBER_ID = "member-456";

function authHeaders(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    Cookie: "authjs.session-token=valid-token",
    "X-User-Id": USER_ID,
    ...extra,
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

function ensureMockFields() {
  if (!(mockPrisma as any).teamInvite) {
    (mockPrisma as any).teamInvite = {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
  }
  if (!(mockPrisma as any).teamMember.count) {
    (mockPrisma as any).teamMember.count = vi.fn();
  }
  if (!(mockPrisma as any).teamMember.create) {
    (mockPrisma as any).teamMember.create = vi.fn();
  }
  if (!(mockPrisma as any).teamMember.delete) {
    (mockPrisma as any).teamMember.delete = vi.fn();
  }
  if (!(mockPrisma as any).teamMember.update) {
    (mockPrisma as any).teamMember.update = vi.fn();
  }
}

async function createApp() {
  const { authMiddleware, sanitizeInput } = await import("../../middleware/auth");
  const userTeams = (await import("../../routes/user-teams")).default;
  const app = new Hono();
  app.use("/api/user-teams/*", sanitizeInput);
  app.use("/api/user-teams/*", authMiddleware);
  app.route("/api/user-teams", userTeams);
  return app;
}

describe("User teams auth and role enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureMockFields();
  });

  it("STUDENT patching team settings returns 403", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "STUDENT",
    });

    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "New Name" }),
    });
    expect(res.status).toBe(403);
  });

  it("non-admin changing roles returns 403", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique
      .mockResolvedValueOnce({ userId: USER_ID, teamId: TEAM_ID, role: "STUDENT" });

    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/members/${MEMBER_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role: "MENTOR" }),
    });
    expect(res.status).toBe(403);
  });

  it("FRIEND creating invite returns 403", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "FRIEND",
    });

    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/invites`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it("maxUses enforcement returns 400 when invite exhausted", async () => {
    mockValidSession();
    (mockPrisma as any).teamInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      code: "ABCDEF",
      teamId: TEAM_ID,
      expiresAt: new Date(Date.now() + 86400000),
      maxUses: 1,
      uses: 1,
      team: { id: TEAM_ID, name: "Test Team" },
    });

    const app = await createApp();
    const res = await app.request("/api/user-teams/join", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ code: "ABCDEF" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("maximum uses");
  });

  it("expired invite returns 410", async () => {
    mockValidSession();
    (mockPrisma as any).teamInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      code: "EXPIRED",
      teamId: TEAM_ID,
      expiresAt: new Date(Date.now() - 86400000),
      maxUses: null,
      uses: 0,
      team: { id: TEAM_ID, name: "Test Team" },
    });

    const app = await createApp();
    const res = await app.request("/api/user-teams/join", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ code: "EXPIRED" }),
    });
    expect(res.status).toBe(410);
  });

  it("already member returns 409", async () => {
    mockValidSession();
    (mockPrisma as any).teamInvite.findUnique.mockResolvedValue({
      id: "invite-1",
      code: "VALIDCODE",
      teamId: TEAM_ID,
      expiresAt: new Date(Date.now() + 86400000),
      maxUses: null,
      uses: 0,
      team: { id: TEAM_ID, name: "Test Team" },
    });
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "STUDENT",
    });

    const app = await createApp();
    const res = await app.request("/api/user-teams/join", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ code: "VALIDCODE" }),
    });
    expect(res.status).toBe(409);
  });

  it("removing last admin returns 400", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique
      .mockResolvedValueOnce({ userId: USER_ID, teamId: TEAM_ID, role: "MENTOR" })
      .mockResolvedValueOnce({ id: MEMBER_ID, userId: USER_ID, teamId: TEAM_ID, role: "MENTOR" });
    (mockPrisma as any).teamMember.count.mockResolvedValue(1);

    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/members/${MEMBER_ID}`, {
      method: "DELETE",
      headers: { Cookie: "authjs.session-token=valid-token", "X-User-Id": USER_ID },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("last admin");
  });

  it("valid admin can update team settings", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "MENTOR",
    });
    mockPrisma.team.update.mockResolvedValue({
      id: TEAM_ID,
      name: "Updated Name",
    });

    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name: "Updated Name" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("valid LEADER can create invite", async () => {
    mockValidSession();
    mockPrisma.teamMember.findUnique.mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "LEADER",
    });
    (mockPrisma as any).teamInvite.findUnique.mockResolvedValue(null);
    (mockPrisma as any).teamInvite.create.mockResolvedValue({
      id: "invite-new",
      code: "NEWCODE",
      teamId: TEAM_ID,
    });

    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/invites`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
