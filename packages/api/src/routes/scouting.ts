import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";
import { getFTCApi } from "../lib/ftc-api";
import type { FTCMatchScore } from "../lib/ftc-api";

const scouting = new Hono();

/**
 * Calculate scores from scouting data
 */
function calculateScores(data: {
  autoLeave: boolean;
  autoClassifiedCount: number;
  autoOverflowCount: number;
  autoPatternCount: number;
  teleopClassifiedCount: number;
  teleopOverflowCount: number;
  teleopDepotCount: number;
  teleopPatternCount: number;
  teleopMotifCount: number;
  endgameBaseStatus: "NONE" | "PARTIAL" | "FULL";
}) {
  // Auto scoring
  const autoScore =
    (data.autoLeave ? 3 : 0) +
    data.autoClassifiedCount * 3 +
    data.autoOverflowCount * 1 +
    data.autoPatternCount * 2;

  // Teleop scoring
  const teleopScore =
    data.teleopClassifiedCount * 3 +
    data.teleopOverflowCount * 1 +
    data.teleopDepotCount * 1 +
    data.teleopPatternCount * 2 +
    data.teleopMotifCount * 2;

  // Endgame scoring
  const endgameScore =
    data.endgameBaseStatus === "FULL"
      ? 10
      : data.endgameBaseStatus === "PARTIAL"
      ? 5
      : 0;

  return {
    autoScore,
    teleopScore,
    endgameScore,
    totalScore: autoScore + teleopScore + endgameScore,
  };
}

/**
 * Perform alliance deduction for a given scouting entry.
 * Fetches the FTC API match scores, identifies the partner team,
 * subtracts the scouted robot's scores from the alliance totals,
 * and creates a new ScoutingEntry for the partner.
 *
 * Returns the created partner entry, or null if deduction was not possible.
 */
async function performAllianceDeduction(entryId: string): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
}> {
  // 1. Get the existing scouting entry with its scouted team
  const entry = await prisma.scoutingEntry.findUnique({
    where: { id: entryId },
    include: { scoutedTeam: true },
  });

  if (!entry) {
    return { success: false, error: "Entry not found" };
  }

  const { eventCode, matchNumber, alliance, scoutedTeam } = entry;
  const scoutedTeamNumber = scoutedTeam.teamNumber;

  // 2. Fetch match scores from FTC API (try qual first, then playoff)
  let matchScores: FTCMatchScore[] = [];
  try {
    const qualResult = await getFTCApi().getScores(eventCode, "qual");
    matchScores = qualResult.matchScores || [];
  } catch {
    // qual scores not available, will try playoff below
  }

  // Find the matching score for this match number
  let matchScore = matchScores.find((ms) => ms.matchNumber === matchNumber);

  // If not found in quals, try playoffs
  if (!matchScore) {
    try {
      const playoffResult = await getFTCApi().getScores(eventCode, "playoff");
      const playoffScores = playoffResult.matchScores || [];
      matchScore = playoffScores.find((ms) => ms.matchNumber === matchNumber);
    } catch {
      // playoff scores not available either
    }
  }

  // 3. If FTC API didn't have scores, fall back to database Match records
  if (!matchScore) {
    const dbMatch = await prisma.match.findFirst({
      where: { eventCode, matchNumber },
    });

    if (dbMatch && dbMatch.redScore !== null && dbMatch.blueScore !== null) {
      const isRed = alliance === "RED";
      matchScore = {
        matchLevel: dbMatch.tournamentLevel,
        matchNumber: dbMatch.matchNumber,
        matchSeries: 1,
        alliances: [
          {
            alliance: "Red" as const,
            totalPoints: dbMatch.redScore,
            autoPoints: 0,
            dcPoints: 0,
            endgamePoints: 0,
            penaltyPointsCommitted: 0,
            prePenaltyTotal: dbMatch.redScore,
            team1: dbMatch.red1,
            team2: dbMatch.red2,
          },
          {
            alliance: "Blue" as const,
            totalPoints: dbMatch.blueScore,
            autoPoints: 0,
            dcPoints: 0,
            endgamePoints: 0,
            penaltyPointsCommitted: 0,
            prePenaltyTotal: dbMatch.blueScore,
            team1: dbMatch.blue1,
            team2: dbMatch.blue2,
          },
        ],
      };

      // Try to extract phase breakdown from scoreDetails if available
      if (dbMatch.scoreDetails) {
        try {
          const details = dbMatch.scoreDetails as Record<string, unknown>;
          const alliances = (details.alliances || details.matchScores) as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(alliances)) {
            for (const a of alliances) {
              const key = a.alliance === "Red" ? 0 : 1;
              if (typeof a.autoPoints === "number") matchScore.alliances[key].autoPoints = a.autoPoints;
              if (typeof a.dcPoints === "number") matchScore.alliances[key].dcPoints = a.dcPoints;
              if (typeof a.endgamePoints === "number") matchScore.alliances[key].endgamePoints = a.endgamePoints;
            }
          }
        } catch {
          // scoreDetails format unrecognized, use totals only
        }
      }
    }
  }

  if (!matchScore) {
    return { success: false, error: "Match scores not available from FTC API or database" };
  }

  // 4. Find the alliance data for this entry's alliance (RED or BLUE)
  const allianceKey = alliance === "RED" ? "Red" : "Blue";
  const allianceData = matchScore.alliances.find(
    (a) => a.alliance === allianceKey
  );

  if (!allianceData) {
    return { success: false, error: "Alliance data not found in match scores" };
  }

  // 5. Determine which team is the partner
  // team1/team2 may be missing from score data (DECODE API returns team: 0)
  let team1 = allianceData.team1;
  let team2 = allianceData.team2;

  // If team numbers are missing from scores, look them up from the match schedule
  if (!team1 || !team2) {
    try {
      const level = matchScore.matchLevel?.includes("QUAL") ? "qual" as const : "playoff" as const;
      const scheduleResult = await getFTCApi().getMatches(eventCode, level);
      const matchInfo = scheduleResult.matches?.find(
        (m) => m.matchNumber === matchNumber
      );
      if (matchInfo?.teams) {
        const station1 = alliance === "RED" ? "Red1" : "Blue1";
        const station2 = alliance === "RED" ? "Red2" : "Blue2";
        const t1 = matchInfo.teams.find((t) => t.station === station1);
        const t2 = matchInfo.teams.find((t) => t.station === station2);
        if (t1) team1 = t1.teamNumber;
        if (t2) team2 = t2.teamNumber;
      }
    } catch {
      // Schedule lookup failed, continue with what we have
    }
  }

  const partnerTeamNumber =
    team1 === scoutedTeamNumber ? team2 : team1;

  if (!partnerTeamNumber || partnerTeamNumber === scoutedTeamNumber) {
    return { success: false, error: "Could not identify partner team" };
  }

  // 6. Check if a scouting entry already exists for the partner in this match
  let partnerTeam = await prisma.team.findUnique({
    where: { teamNumber: partnerTeamNumber },
  });

  if (partnerTeam) {
    const existingPartnerEntry = await prisma.scoutingEntry.findFirst({
      where: {
        scoutedTeamId: partnerTeam.id,
        eventCode,
        matchNumber,
        scoutingTeamId: entry.scoutingTeamId,
      },
    });

    if (existingPartnerEntry) {
      return {
        success: false,
        error: "Scouting entry already exists for partner team in this match",
      };
    }
  }

  // 7. Calculate deducted scores
  // If phase breakdown available, deduct per-phase; otherwise deduct from total
  let partnerAutoScore: number;
  let partnerTeleopScore: number;
  let partnerEndgameScore: number;
  let partnerTotalScore: number;

  // DECODE API uses teleopPoints (pure teleop) + teleopBasePoints (endgame) instead of dcPoints + endgamePoints
  const allianceAutoPoints = allianceData.autoPoints ?? 0;
  const allianceTeleopPoints = allianceData.dcPoints ?? (allianceData as Record<string, unknown>).teleopPoints as number ?? 0;
  const allianceEndgamePoints = allianceData.endgamePoints ?? (allianceData as Record<string, unknown>).teleopBasePoints as number ?? 0;

  const hasPhaseBreakdown = allianceAutoPoints > 0 || allianceTeleopPoints > 0 || allianceEndgamePoints > 0;

  if (hasPhaseBreakdown) {
    partnerAutoScore = Math.max(0, allianceAutoPoints - entry.autoScore);
    partnerTeleopScore = Math.max(0, allianceTeleopPoints - entry.teleopScore);
    partnerEndgameScore = Math.max(0, allianceEndgamePoints - entry.endgameScore);
    partnerTotalScore = partnerAutoScore + partnerTeleopScore + partnerEndgameScore;
  } else {
    // Only total alliance score available — deduct from total
    partnerAutoScore = 0;
    partnerTeleopScore = 0;
    partnerEndgameScore = 0;
    partnerTotalScore = Math.max(0, allianceData.totalPoints - entry.totalScore);
  }

  // 8. Get or create the partner team
  if (!partnerTeam) {
    partnerTeam = await prisma.team.create({
      data: {
        teamNumber: partnerTeamNumber,
        name: `Team ${partnerTeamNumber}`,
      },
    });
  }

  // 9. Create the deducted scouting entry for the partner
  const partnerEntry = await prisma.scoutingEntry.create({
    data: {
      scouterId: entry.scouterId,
      scoutingTeamId: entry.scoutingTeamId,
      scoutedTeamId: partnerTeam.id,
      eventCode,
      matchNumber,
      alliance,
      // Individual counts set to 0 since we only know totals
      autoLeave: false,
      autoClassifiedCount: 0,
      autoOverflowCount: 0,
      autoPatternCount: 0,
      teleopClassifiedCount: 0,
      teleopOverflowCount: 0,
      teleopDepotCount: 0,
      teleopPatternCount: 0,
      teleopMotifCount: 0,
      endgameBaseStatus: "NONE",
      // Copy alliance notes from the original entry
      allianceNotes: entry.allianceNotes,
      // Deducted computed scores
      autoScore: partnerAutoScore,
      teleopScore: partnerTeleopScore,
      endgameScore: partnerEndgameScore,
      totalScore: partnerTotalScore,
    },
    include: {
      scoutedTeam: true,
      scoutingTeam: true,
      scouter: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return { success: true, data: partnerEntry };
}

/**
 * POST /api/scouting/entries
 * Submit a new scouting entry
 */
scouting.post("/entries", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const {
      scoutingTeamId,
      scoutedTeamNumber,
      eventCode,
      matchNumber,
      alliance,
      // Scoring data
      autoLeave = false,
      autoClassifiedCount = 0,
      autoOverflowCount = 0,
      autoPatternCount = 0,
      teleopClassifiedCount = 0,
      teleopOverflowCount = 0,
      teleopDepotCount = 0,
      teleopPatternCount = 0,
      teleopMotifCount = 0,
      endgameBaseStatus = "NONE",
      allianceNotes,
    } = body;

    // Validate required fields
    if (!scoutingTeamId || !scoutedTeamNumber || !eventCode || !matchNumber || !alliance) {
      return c.json(
        { success: false, error: "Missing required fields" },
        400
      );
    }

    // Verify user is a member of the scouting team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: scoutingTeamId },
      },
    });

    if (!membership) {
      return c.json(
        { success: false, error: "Not a member of scouting team" },
        403
      );
    }

    // FRIEND role members are view-only and cannot create scouting entries
    if (membership.role === "FRIEND") {
      return c.json(
        { success: false, error: "Friend members have view-only access" },
        403
      );
    }

    // Get or create the scouted team
    let scoutedTeam = await prisma.team.findUnique({
      where: { teamNumber: scoutedTeamNumber },
    });

    if (!scoutedTeam) {
      // Create a placeholder team
      scoutedTeam = await prisma.team.create({
        data: {
          teamNumber: scoutedTeamNumber,
          name: `Team ${scoutedTeamNumber}`,
        },
      });
    }

    // Ensure event exists
    let event = await prisma.event.findUnique({
      where: { eventCode },
    });

    if (!event) {
      // Create placeholder event
      event = await prisma.event.create({
        data: {
          eventCode,
          season: 2025,
          name: eventCode,
          startDate: new Date(),
          endDate: new Date(),
        },
      });
    }

    // Calculate scores
    const scores = calculateScores({
      autoLeave,
      autoClassifiedCount,
      autoOverflowCount,
      autoPatternCount,
      teleopClassifiedCount,
      teleopOverflowCount,
      teleopDepotCount,
      teleopPatternCount,
      teleopMotifCount,
      endgameBaseStatus,
    });

    // Create scouting entry
    const entry = await prisma.scoutingEntry.create({
      data: {
        scouterId: userId,
        scoutingTeamId,
        scoutedTeamId: scoutedTeam.id,
        eventCode,
        matchNumber,
        alliance,
        autoLeave,
        autoClassifiedCount,
        autoOverflowCount,
        autoPatternCount,
        teleopClassifiedCount,
        teleopOverflowCount,
        teleopDepotCount,
        teleopPatternCount,
        teleopMotifCount,
        endgameBaseStatus,
        allianceNotes: allianceNotes || null,
        ...scores,
      },
    });

    // Auto-deduct partner entry
    const autoDeduct = c.req.query("autoDeduct") !== "false";
    let deduction: { success: boolean; error?: string } = { success: false, error: "skipped" };
    if (autoDeduct) {
      try {
        deduction = await performAllianceDeduction(entry.id);
      } catch (err) {
        console.error("Auto-deduction failed:", err);
        deduction = { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    }

    return c.json({
      success: true,
      data: entry,
      deduction,
    });
  } catch (error) {
    console.error("Error creating scouting entry:", error);
    const message = error instanceof Error ? error.message : "Failed to create scouting entry";
    return c.json(
      { success: false, error: message },
      500
    );
  }
});

/**
 * GET /api/scouting/entries
 * Get scouting entries with filters
 */
scouting.get("/entries", async (c) => {
  const userId = c.req.header("X-User-Id");

  try {
    const eventCode = c.req.query("eventCode");
    const teamNumber = c.req.query("teamNumber");
    const scoutingTeamId = c.req.query("scoutingTeamId");

    const where: Record<string, unknown> = {};

    if (eventCode) {
      where.eventCode = eventCode;
    }

    if (teamNumber) {
      where.scoutedTeam = {
        teamNumber: parseInt(teamNumber, 10),
      };
    }

    if (scoutingTeamId) {
      where.scoutingTeamId = scoutingTeamId;
    }

    // If not filtering by own team, only show public/event data
    if (!scoutingTeamId && userId) {
      // Get user's teams
      const userTeams = await prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      });
      const userTeamIds = userTeams.map((t) => t.teamId);

      where.OR = [
        { scoutingTeamId: { in: userTeamIds } },
        { scoutingTeam: { sharingLevel: "PUBLIC" } },
        // For EVENT level, would need to check if user is at same event
      ];
    }

    const entries = await prisma.scoutingEntry.findMany({
      where,
      include: {
        scoutedTeam: true,
        scoutingTeam: true,
        scouter: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        { eventCode: "asc" },
        { matchNumber: "asc" },
      ],
    });

    return c.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error("Error fetching scouting entries:", error);
    return c.json(
      { success: false, error: "Failed to fetch entries" },
      500
    );
  }
});

/**
 * GET /api/scouting/entries/:id
 * Get a specific scouting entry
 */
scouting.get("/entries/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const entry = await prisma.scoutingEntry.findUnique({
      where: { id },
      include: {
        scoutedTeam: true,
        scoutingTeam: true,
        scouter: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    if (!entry) {
      return c.json({ success: false, error: "Entry not found" }, 404);
    }

    return c.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error("Error fetching scouting entry:", error);
    return c.json(
      { success: false, error: "Failed to fetch entry" },
      500
    );
  }
});

/**
 * PATCH /api/scouting/entries/:id
 * Update an existing scouting entry
 */
scouting.patch("/entries/:id", async (c) => {
  const userId = c.req.header("X-User-Id");
  const id = c.req.param("id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Fetch the existing entry
    const existing = await prisma.scoutingEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return c.json({ success: false, error: "Entry not found" }, 404);
    }

    // Verify user is a member of the scouting team that owns the entry
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: existing.scoutingTeamId },
      },
    });

    if (!membership) {
      return c.json(
        { success: false, error: "Not a member of scouting team" },
        403
      );
    }

    const body = await c.req.json();

    // Merge existing values with any provided updates
    const merged = {
      autoLeave: body.autoLeave ?? existing.autoLeave,
      autoClassifiedCount: body.autoClassifiedCount ?? existing.autoClassifiedCount,
      autoOverflowCount: body.autoOverflowCount ?? existing.autoOverflowCount,
      autoPatternCount: body.autoPatternCount ?? existing.autoPatternCount,
      teleopClassifiedCount: body.teleopClassifiedCount ?? existing.teleopClassifiedCount,
      teleopOverflowCount: body.teleopOverflowCount ?? existing.teleopOverflowCount,
      teleopDepotCount: body.teleopDepotCount ?? existing.teleopDepotCount,
      teleopPatternCount: body.teleopPatternCount ?? existing.teleopPatternCount,
      teleopMotifCount: body.teleopMotifCount ?? existing.teleopMotifCount,
      endgameBaseStatus: body.endgameBaseStatus ?? existing.endgameBaseStatus,
    };

    // Recalculate scores with merged data
    const scores = calculateScores(merged);

    // Build the update payload (scoring fields + optional match info)
    const updateData: Record<string, unknown> = {
      ...merged,
      ...scores,
    };

    if (body.matchNumber !== undefined) {
      updateData.matchNumber = body.matchNumber;
    }
    if (body.alliance !== undefined) {
      updateData.alliance = body.alliance;
    }
    if (body.allianceNotes !== undefined) {
      updateData.allianceNotes = body.allianceNotes || null;
    }

    const updated = await prisma.scoutingEntry.update({
      where: { id },
      data: updateData,
      include: {
        scoutedTeam: true,
        scoutingTeam: true,
        scouter: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    return c.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating scouting entry:", error);
    return c.json(
      { success: false, error: "Failed to update scouting entry" },
      500
    );
  }
});

/**
 * POST /api/scouting/entries/:id/deduct-partner
 * Auto-generate a scouting entry for the alliance partner by deducting
 * the scouted robot's scores from the FTC API alliance totals.
 */
scouting.post("/entries/:id/deduct-partner", async (c) => {
  const userId = c.req.header("X-User-Id");
  const id = c.req.param("id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Verify the entry exists and user has access
    const entry = await prisma.scoutingEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return c.json({ success: false, error: "Entry not found" }, 404);
    }

    // Verify user is a member of the scouting team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: entry.scoutingTeamId },
      },
    });

    if (!membership) {
      return c.json(
        { success: false, error: "Not a member of scouting team" },
        403
      );
    }

    const result = await performAllianceDeduction(id);

    if (!result.success) {
      return c.json(
        { success: false, error: result.error },
        400
      );
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error performing alliance deduction:", error);
    return c.json(
      { success: false, error: "Failed to perform alliance deduction" },
      500
    );
  }
});

/**
 * POST /api/scouting/retry-deductions
 * Retry alliance deductions for entries that don't have partner entries yet.
 * Called automatically when match data may have become available.
 */
scouting.post("/retry-deductions", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { eventCode, scoutingTeamId } = body;

    if (!eventCode || !scoutingTeamId) {
      return c.json(
        { success: false, error: "Missing eventCode or scoutingTeamId" },
        400
      );
    }

    // Verify user is a member of the scouting team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: scoutingTeamId },
      },
    });

    if (!membership) {
      return c.json(
        { success: false, error: "Not a member of scouting team" },
        403
      );
    }

    // Find all entries for this team at this event
    const entries = await prisma.scoutingEntry.findMany({
      where: { eventCode, scoutingTeamId },
      select: { id: true },
    });

    let deducted = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of entries) {
      const result = await performAllianceDeduction(entry.id);
      if (result.success) {
        deducted++;
      } else if (
        result.error === "Scouting entry already exists for partner team in this match"
      ) {
        skipped++;
      } else {
        failed++;
      }
    }

    return c.json({
      success: true,
      data: { deducted, skipped, failed, total: entries.length },
    });
  } catch (error) {
    console.error("Error retrying deductions:", error);
    return c.json(
      { success: false, error: "Failed to retry deductions" },
      500
    );
  }
});

/**
 * POST /api/scouting/notes
 * Add a qualitative note about a team
 */
scouting.post("/notes", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const {
      notingTeamId,
      aboutTeamNumber,
      eventCode,
      reliabilityRating,
      driverSkillRating,
      defenseRating,
      strategyNotes,
      mechanicalNotes,
      generalNotes,
    } = body;

    if (!notingTeamId || !aboutTeamNumber) {
      return c.json(
        { success: false, error: "Missing required fields" },
        400
      );
    }

    // Verify user is a member of the noting team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: notingTeamId },
      },
    });

    if (!membership) {
      return c.json(
        { success: false, error: "Not a member of noting team" },
        403
      );
    }

    // FRIEND role members are view-only and cannot create notes
    if (membership.role === "FRIEND") {
      return c.json(
        { success: false, error: "Friend members have view-only access" },
        403
      );
    }

    // Get or create the about team
    let aboutTeam = await prisma.team.findUnique({
      where: { teamNumber: aboutTeamNumber },
    });

    if (!aboutTeam) {
      aboutTeam = await prisma.team.create({
        data: {
          teamNumber: aboutTeamNumber,
          name: `Team ${aboutTeamNumber}`,
        },
      });
    }

    // Ensure event exists in local DB if eventCode is provided
    if (eventCode) {
      let event = await prisma.event.findUnique({
        where: { eventCode },
      });

      if (!event) {
        // Try to fetch real event data from FTC API
        try {
          const api = getFTCApi();
          const { events: eventList } = await api.getEvent(eventCode);
          if (eventList.length > 0) {
            const ftcEvent = eventList[0];
            event = await prisma.event.create({
              data: {
                eventCode,
                season: 2025,
                name: ftcEvent.name,
                startDate: new Date(ftcEvent.dateStart),
                endDate: new Date(ftcEvent.dateEnd),
                venue: ftcEvent.venue || null,
                city: ftcEvent.city || null,
                stateProv: ftcEvent.stateprov || null,
                country: ftcEvent.country || null,
                timezone: ftcEvent.timezone || null,
              },
            });
          }
        } catch {
          // FTC API unavailable, fall through to placeholder
        }

        // Create placeholder event if API fetch didn't work
        if (!event) {
          event = await prisma.event.create({
            data: {
              eventCode,
              season: 2025,
              name: eventCode,
              startDate: new Date(),
              endDate: new Date(),
            },
          });
        }
      }
    }

    const note = await prisma.scoutingNote.create({
      data: {
        authorId: userId,
        notingTeamId,
        aboutTeamId: aboutTeam.id,
        eventCode: eventCode || null,
        reliabilityRating,
        driverSkillRating,
        defenseRating,
        strategyNotes,
        mechanicalNotes,
        generalNotes,
      },
    });

    return c.json({
      success: true,
      data: note,
    });
  } catch (error) {
    console.error("Error creating scouting note:", error);
    return c.json(
      { success: false, error: "Failed to create note" },
      500
    );
  }
});

/**
 * GET /api/scouting/notes
 * Get scouting notes with filters
 */
scouting.get("/notes", async (c) => {
  try {
    const aboutTeamNumber = c.req.query("aboutTeamNumber");
    const eventCode = c.req.query("eventCode");
    const notingTeamId = c.req.query("notingTeamId");

    const where: Record<string, unknown> = {};

    if (aboutTeamNumber) {
      where.aboutTeam = {
        teamNumber: parseInt(aboutTeamNumber, 10),
      };
    }

    if (eventCode) {
      where.eventCode = eventCode;
    }

    if (notingTeamId) {
      where.notingTeamId = notingTeamId;
    }

    const notes = await prisma.scoutingNote.findMany({
      where,
      include: {
        aboutTeam: true,
        notingTeam: true,
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    console.error("Error fetching scouting notes:", error);
    return c.json(
      { success: false, error: "Failed to fetch notes" },
      500
    );
  }
});

/**
 * GET /api/scouting/team-summary/:teamNumber
 * Get aggregated scouting data for a team
 */
scouting.get("/team-summary/:teamNumber", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);
  const eventCode = c.req.query("eventCode");

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  try {
    const team = await prisma.team.findUnique({
      where: { teamNumber },
    });

    if (!team) {
      return c.json({ success: false, error: "Team not found" }, 404);
    }

    const where: Record<string, unknown> = {
      scoutedTeamId: team.id,
    };

    if (eventCode) {
      where.eventCode = eventCode;
    }

    const entries = await prisma.scoutingEntry.findMany({
      where,
    });

    if (entries.length === 0) {
      return c.json({
        success: true,
        data: {
          teamNumber,
          matchCount: 0,
          averages: null,
        },
      });
    }

    // Calculate averages
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const averages = {
      autoScore: avg(entries.map((e) => e.autoScore)),
      teleopScore: avg(entries.map((e) => e.teleopScore)),
      endgameScore: avg(entries.map((e) => e.endgameScore)),
      totalScore: avg(entries.map((e) => e.totalScore)),
      autoLeaveRate: avg(entries.map((e) => (e.autoLeave ? 1 : 0))),
      autoClassified: avg(entries.map((e) => e.autoClassifiedCount)),
      autoOverflow: avg(entries.map((e) => e.autoOverflowCount)),
      teleopClassified: avg(entries.map((e) => e.teleopClassifiedCount)),
      teleopOverflow: avg(entries.map((e) => e.teleopOverflowCount)),
      teleopDepot: avg(entries.map((e) => e.teleopDepotCount)),
    };

    return c.json({
      success: true,
      data: {
        teamNumber,
        matchCount: entries.length,
        averages,
        entries,
      },
    });
  } catch (error) {
    console.error("Error fetching team summary:", error);
    return c.json(
      { success: false, error: "Failed to fetch team summary" },
      500
    );
  }
});

/**
 * GET /api/scouting/team-stats/:teamId
 * Get scouting stats for a user's team (matches scouted, events, etc.)
 */
scouting.get("/team-stats/:teamId", async (c) => {
  const teamId = c.req.param("teamId");
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Verify user is a member of the team
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!membership) {
      return c.json(
        { success: false, error: "Not a member of this team" },
        403
      );
    }

    // Get scouting entries for this team
    const entries = await prisma.scoutingEntry.findMany({
      where: { scoutingTeamId: teamId },
      select: {
        eventCode: true,
        matchNumber: true,
        scoutedTeamId: true,
      },
    });

    // Count unique events
    const uniqueEvents = new Set(entries.map((e) => e.eventCode));
    // Count unique scouted teams
    const uniqueTeams = new Set(entries.map((e) => e.scoutedTeamId));

    // Get scouting notes count
    const notesCount = await prisma.scoutingNote.count({
      where: { notingTeamId: teamId },
    });

    return c.json({
      success: true,
      data: {
        matchesScouted: entries.length,
        eventsCount: uniqueEvents.size,
        teamsScoutedCount: uniqueTeams.size,
        notesCount,
      },
    });
  } catch (error) {
    console.error("Error fetching team stats:", error);
    return c.json(
      { success: false, error: "Failed to fetch team stats" },
      500
    );
  }
});

export default scouting;
