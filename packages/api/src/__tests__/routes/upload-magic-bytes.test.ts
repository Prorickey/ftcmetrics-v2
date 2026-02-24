import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockPrisma } from "../setup";

vi.mock("../../lib/ftc-api", () => ({
  getFTCApi: () => ({}),
}));

vi.mock("fs", () => ({
  default: {
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

const TEAM_ID = "team-uuid-1234";
const USER_ID = "user-123";

function ensureMediaMocks() {
  if (!(mockPrisma as any).teamMedia) {
    (mockPrisma as any).teamMedia = {
      create: vi.fn(),
      aggregate: vi.fn(),
    };
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

function mockAuthAndMembership() {
  mockPrisma.session.findUnique.mockResolvedValue({
    sessionToken: "valid-token",
    userId: USER_ID,
    expires: new Date(Date.now() + 86400000),
    user: { id: USER_ID, name: "Test", email: "test@test.com" },
  });
  mockPrisma.teamMember.findUnique.mockResolvedValue({
    userId: USER_ID,
    teamId: TEAM_ID,
    role: "MENTOR",
  });
  ensureMediaMocks();
  (mockPrisma as any).teamMedia.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
  (mockPrisma as any).teamMedia.create.mockResolvedValue({ id: "media-1" });
}

function createFileUpload(magicBytes: number[], filename: string, mimeType: string): FormData {
  const buffer = new Uint8Array(64);
  for (let i = 0; i < magicBytes.length; i++) {
    buffer[i] = magicBytes[i];
  }
  const blob = new Blob([buffer], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  const form = new FormData();
  form.append("type", "PHOTO");
  form.append("title", "Test Photo");
  form.append("file", file);
  return form;
}

describe("File upload magic byte validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthAndMembership();
  });

  it("accepts JPEG magic bytes", async () => {
    const form = createFileUpload([0xFF, 0xD8, 0xFF], "photo.jpg", "image/jpeg");
    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/media`, {
      method: "POST",
      headers: {
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: form,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("accepts PNG magic bytes", async () => {
    const form = createFileUpload([0x89, 0x50, 0x4E, 0x47], "photo.png", "image/png");
    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/media`, {
      method: "POST",
      headers: {
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: form,
    });
    expect(res.status).toBe(200);
  });

  it("accepts WebP magic bytes", async () => {
    const magic = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
    const form = createFileUpload(magic, "photo.webp", "image/webp");
    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/media`, {
      method: "POST",
      headers: {
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: form,
    });
    expect(res.status).toBe(200);
  });

  it("rejects HTML disguised as JPEG", async () => {
    const htmlBytes = Array.from(new TextEncoder().encode("<!DOCTYPE html>"));
    const form = createFileUpload(htmlBytes, "evil.jpg", "image/jpeg");
    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/media`, {
      method: "POST",
      headers: {
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: form,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid file type");
  });

  it("rejects random bytes", async () => {
    const form = createFileUpload([0x00, 0x01, 0x02, 0x03], "mystery.jpg", "image/jpeg");
    const app = await createApp();
    const res = await app.request(`/api/user-teams/${TEAM_ID}/media`, {
      method: "POST",
      headers: {
        Cookie: "authjs.session-token=valid-token",
        "User-Id": USER_ID,
      },
      body: form,
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid file type");
  });
});
