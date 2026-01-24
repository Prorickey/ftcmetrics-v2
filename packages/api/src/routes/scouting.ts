import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";

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
        ...scores,
      },
    });

    return c.json({
      success: true,
      data: entry,
    });
  } catch (error) {
    console.error("Error creating scouting entry:", error);
    return c.json(
      { success: false, error: "Failed to create scouting entry" },
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

    const note = await prisma.scoutingNote.create({
      data: {
        authorId: userId,
        notingTeamId,
        aboutTeamId: aboutTeam.id,
        eventCode,
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
