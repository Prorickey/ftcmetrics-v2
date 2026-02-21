import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the actual schema from scouting.ts to test validation in isolation
const scoutingEntrySchema = z.object({
  scoutedTeamNumber: z.number().int().positive(),
  eventCode: z.string().regex(/^[A-Za-z0-9]+$/),
  matchNumber: z.number().int().positive(),
  alliance: z.enum(["RED", "BLUE"]),
  scoutingTeamId: z.string().min(1),
  autoClassifiedCount: z.number().int().min(0).default(0),
  autoOverflowCount: z.number().int().min(0).default(0),
  autoPatternCount: z.number().int().min(0).default(0),
  teleopClassifiedCount: z.number().int().min(0).default(0),
  teleopOverflowCount: z.number().int().min(0).default(0),
  teleopDepotCount: z.number().int().min(0).default(0),
  teleopPatternCount: z.number().int().min(0).default(0),
  teleopMotifCount: z.number().int().min(0).default(0),
  endgameBaseStatus: z.enum(["NONE", "PARTIAL", "FULL"]).default("NONE"),
  autoLeave: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  allianceNotes: z.string().max(1000).optional(),
});

const VALID_TEAM_ID = "clx2abc123def456ghi789";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    scoutedTeamNumber: 8569,
    eventCode: "USTXCMP",
    matchNumber: 1,
    alliance: "RED",
    scoutingTeamId: VALID_TEAM_ID,
    autoClassifiedCount: 2,
    autoOverflowCount: 1,
    autoPatternCount: 0,
    teleopClassifiedCount: 3,
    teleopOverflowCount: 0,
    teleopDepotCount: 1,
    teleopPatternCount: 1,
    teleopMotifCount: 0,
    endgameBaseStatus: "FULL",
    autoLeave: true,
    notes: "Good match",
    ...overrides,
  };
}

describe("Scouting entry schema validation", () => {
  it("accepts a valid full payload", () => {
    const result = scoutingEntrySchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("accepts a valid minimal payload with defaults", () => {
    const minimal = {
      scoutedTeamNumber: 8569,
      eventCode: "USTXCMP",
      matchNumber: 1,
      alliance: "RED",
      scoutingTeamId: VALID_TEAM_ID,
    };
    const result = scoutingEntrySchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoClassifiedCount).toBe(0);
      expect(result.data.autoLeave).toBe(false);
      expect(result.data.endgameBaseStatus).toBe("NONE");
    }
  });

  it("rejects negative counts", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ autoClassifiedCount: -1 })
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid alliance value", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ alliance: "GREEN" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = scoutingEntrySchema.safeParse({
      autoClassifiedCount: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects string in numeric field", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ matchNumber: "one" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects eventCode with special characters", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ eventCode: "US-TX_CMP!" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects eventCode with path traversal", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ eventCode: "../../etc" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects notes exceeding 1000 chars", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ notes: "x".repeat(1001) })
    );
    expect(result.success).toBe(false);
  });

  it("accepts notes at exactly 1000 chars", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ notes: "x".repeat(1000) })
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty string for scoutingTeamId", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ scoutingTeamId: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects non-integer team number", () => {
    const result = scoutingEntrySchema.safeParse(
      validPayload({ scoutedTeamNumber: 85.5 })
    );
    expect(result.success).toBe(false);
  });
});
