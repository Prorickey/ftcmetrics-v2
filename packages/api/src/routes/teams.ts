import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";
import { getFTCApi } from "../lib/ftc-api";

const teams = new Hono();

const TEAM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const EVENT_SUMMARY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/teams/search?q=
 * Search cached FTC teams by number or name
 */
teams.get("/search", async (c) => {
  const q = (c.req.query("q") || "").trim();
  if (!q) {
    return c.json({ success: true, data: [] });
  }

  const isNumeric = /^\d+$/.test(q);

  try {
    let results;

    if (isNumeric) {
      const num = parseInt(q, 10);
      results = await prisma.ftcTeam.findMany({
        where: {
          OR: [
            { teamNumber: num },
            {
              teamNumber: {
                gte: num * 10,
                lt: (num + 1) * 10,
              },
            },
            {
              teamNumber: {
                gte: num * 100,
                lt: (num + 1) * 100,
              },
            },
          ],
        },
        select: {
          teamNumber: true,
          nameShort: true,
          nameFull: true,
          city: true,
          stateProv: true,
        },
        orderBy: { teamNumber: "asc" },
        take: 20,
      });
    } else {
      results = await prisma.ftcTeam.findMany({
        where: {
          OR: [
            { nameShort: { contains: q, mode: "insensitive" } },
            { nameFull: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          teamNumber: true,
          nameShort: true,
          nameFull: true,
          city: true,
          stateProv: true,
        },
        orderBy: { teamNumber: "asc" },
        take: 20,
      });
    }

    // If no cache results and query is a valid team number, try fetching from FTC API
    if (results.length === 0 && isNumeric) {
      const teamNumber = parseInt(q, 10);
      if (teamNumber > 0) {
        try {
          const api = getFTCApi();
          const { teams: teamList } = await api.getTeam(teamNumber);
          if (teamList.length > 0) {
            const t = teamList[0];
            await prisma.ftcTeam.upsert({
              where: { teamNumber: t.teamNumber },
              update: {
                nameShort: t.nameShort,
                nameFull: t.nameFull,
                city: t.city || null,
                stateProv: t.stateProv || null,
                country: t.country || null,
                rookieYear: t.rookieYear || null,
                fetchedAt: new Date(),
              },
              create: {
                teamNumber: t.teamNumber,
                nameShort: t.nameShort,
                nameFull: t.nameFull,
                city: t.city || null,
                stateProv: t.stateProv || null,
                country: t.country || null,
                rookieYear: t.rookieYear || null,
              },
            });
            results = [
              {
                teamNumber: t.teamNumber,
                nameShort: t.nameShort,
                nameFull: t.nameFull,
                city: t.city || null,
                stateProv: t.stateProv || null,
              },
            ];
          }
        } catch {
          // FTC API fetch failed, return empty results
        }
      }
    }

    return c.json({ success: true, data: results });
  } catch (error) {
    console.error("Error searching teams:", error);
    return c.json({ success: false, error: "Failed to search teams" }, 500);
  }
});

/**
 * GET /api/teams/:teamNumber
 * Get a specific FTC team — cached with 24h TTL
 */
teams.get("/:teamNumber", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  try {
    // Check cache
    const cached = await prisma.ftcTeam.findUnique({
      where: { teamNumber },
    });

    if (cached && Date.now() - cached.fetchedAt.getTime() < TEAM_CACHE_TTL) {
      return c.json({
        success: true,
        data: {
          teamNumber: cached.teamNumber,
          nameFull: cached.nameFull,
          nameShort: cached.nameShort,
          city: cached.city,
          stateProv: cached.stateProv,
          country: cached.country,
          rookieYear: cached.rookieYear,
        },
      });
    }

    // Cache miss or stale — fetch from FTC API
    const api = getFTCApi();
    const { teams: teamList } = await api.getTeam(teamNumber);

    if (teamList.length === 0) {
      return c.json({ success: false, error: "Team not found" }, 404);
    }

    const t = teamList[0];

    // Upsert into cache
    await prisma.ftcTeam.upsert({
      where: { teamNumber: t.teamNumber },
      update: {
        nameShort: t.nameShort,
        nameFull: t.nameFull,
        city: t.city || null,
        stateProv: t.stateProv || null,
        country: t.country || null,
        rookieYear: t.rookieYear || null,
        fetchedAt: new Date(),
      },
      create: {
        teamNumber: t.teamNumber,
        nameShort: t.nameShort,
        nameFull: t.nameFull,
        city: t.city || null,
        stateProv: t.stateProv || null,
        country: t.country || null,
        rookieYear: t.rookieYear || null,
      },
    });

    return c.json({
      success: true,
      data: t,
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return c.json({ success: false, error: "Failed to fetch team" }, 500);
  }
});

/**
 * GET /api/teams/:teamNumber/profile
 * Get a team's public profile (bio, robot info, media)
 * Visibility: PUBLIC teams → full profile; members → full profile; otherwise → null
 */
teams.get("/:teamNumber/profile", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  try {
    const team = await prisma.team.findUnique({
      where: { teamNumber },
      select: {
        id: true,
        sharingLevel: true,
        bio: true,
        robotName: true,
        robotDesc: true,
        drivetrainType: true,
        links: true,
        media: {
          select: {
            id: true,
            type: true,
            title: true,
            url: true,
            description: true,
            sortOrder: true,
            isUpload: true,
            fileSize: true,
            mimeType: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        members: {
          select: { userId: true },
        },
      },
    });

    if (!team) {
      return c.json({ success: true, data: null });
    }

    // Check visibility
    const requesterId = c.req.header("X-User-Id");
    const isMember = requesterId
      ? team.members.some((m) => m.userId === requesterId)
      : false;

    if (team.sharingLevel !== "PUBLIC" && !isMember) {
      return c.json({ success: true, data: null });
    }

    return c.json({
      success: true,
      data: {
        bio: team.bio,
        robotName: team.robotName,
        robotDesc: team.robotDesc,
        drivetrainType: team.drivetrainType,
        links: team.links,
        media: team.media,
      },
    });
  } catch (error) {
    console.error("Error fetching team profile:", error);
    return c.json(
      { success: false, error: "Failed to fetch team profile" },
      500
    );
  }
});

/**
 * GET /api/teams/:teamNumber/events
 * Get events a team is registered for
 */
teams.get("/:teamNumber/events", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  try {
    const api = getFTCApi();
    const { events } = await api.getTeamEvents(teamNumber);

    return c.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching team events:", error);
    return c.json({ success: false, error: "Failed to fetch team events" }, 500);
  }
});

/**
 * GET /api/teams/:teamNumber/event-summaries
 * Get event summaries with ranking data — cached with 1h TTL
 */
teams.get("/:teamNumber/event-summaries", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);

  if (isNaN(teamNumber)) {
    return c.json({ success: false, error: "Invalid team number" }, 400);
  }

  try {
    // Check if we have fresh cached data
    const cached = await prisma.ftcTeamEvent.findMany({
      where: { teamNumber },
      orderBy: { dateStart: "desc" },
    });

    const hasFreshCache =
      cached.length > 0 &&
      cached.every(
        (e) => Date.now() - e.fetchedAt.getTime() < EVENT_SUMMARY_CACHE_TTL
      );

    if (hasFreshCache) {
      return c.json({
        success: true,
        data: cached.map((e) => ({
          eventCode: e.eventCode,
          eventName: e.eventName,
          city: e.city,
          stateProv: e.stateProv,
          dateStart: e.dateStart.toISOString(),
          rank: e.rank,
          wins: e.wins,
          losses: e.losses,
          ties: e.ties,
          qualAverage: e.qualAverage,
        })),
      });
    }

    // Fetch from FTC API
    const api = getFTCApi();
    const { events } = await api.getTeamEvents(teamNumber);

    // Fetch rankings for each event in parallel
    const summaries = await Promise.all(
      events.map(async (event) => {
        let rank: number | null = null;
        let wins: number | null = null;
        let losses: number | null = null;
        let ties: number | null = null;
        let qualAverage: number | null = null;

        try {
          const rankings = await api.getRankings(event.code);
          const teamRanking = rankings.Rankings?.find(
            (r) => r.teamNumber === teamNumber
          );
          if (teamRanking) {
            rank = teamRanking.rank;
            wins = teamRanking.wins;
            losses = teamRanking.losses;
            ties = teamRanking.ties;
            qualAverage = teamRanking.qualAverage;
          }
        } catch {
          // Rankings not available (event hasn't started)
        }

        return {
          eventCode: event.code,
          eventName: event.name,
          city: event.city || null,
          stateProv: event.stateprov || null,
          dateStart: event.dateStart,
          rank,
          wins,
          losses,
          ties,
          qualAverage,
        };
      })
    );

    // Ensure team exists in cache before upserting events
    const teamExists = await prisma.ftcTeam.findUnique({
      where: { teamNumber },
    });
    if (!teamExists) {
      try {
        const { teams: teamList } = await api.getTeam(teamNumber);
        if (teamList.length > 0) {
          const t = teamList[0];
          await prisma.ftcTeam.upsert({
            where: { teamNumber: t.teamNumber },
            update: {
              nameShort: t.nameShort,
              nameFull: t.nameFull,
              city: t.city || null,
              stateProv: t.stateProv || null,
              country: t.country || null,
              rookieYear: t.rookieYear || null,
              fetchedAt: new Date(),
            },
            create: {
              teamNumber: t.teamNumber,
              nameShort: t.nameShort,
              nameFull: t.nameFull,
              city: t.city || null,
              stateProv: t.stateProv || null,
              country: t.country || null,
              rookieYear: t.rookieYear || null,
            },
          });
        }
      } catch {
        // If team lookup fails, skip caching events
      }
    }

    // Upsert event summaries into cache
    for (const s of summaries) {
      try {
        await prisma.ftcTeamEvent.upsert({
          where: {
            teamNumber_eventCode: {
              teamNumber,
              eventCode: s.eventCode,
            },
          },
          update: {
            eventName: s.eventName,
            city: s.city,
            stateProv: s.stateProv,
            dateStart: new Date(s.dateStart),
            rank: s.rank,
            wins: s.wins,
            losses: s.losses,
            ties: s.ties,
            qualAverage: s.qualAverage,
            fetchedAt: new Date(),
          },
          create: {
            teamNumber,
            eventCode: s.eventCode,
            eventName: s.eventName,
            city: s.city,
            stateProv: s.stateProv,
            dateStart: new Date(s.dateStart),
            rank: s.rank,
            wins: s.wins,
            losses: s.losses,
            ties: s.ties,
            qualAverage: s.qualAverage,
          },
        });
      } catch {
        // Skip individual event cache failures
      }
    }

    // Sort newest first
    summaries.sort(
      (a, b) =>
        new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime()
    );

    return c.json({
      success: true,
      data: summaries,
    });
  } catch (error) {
    console.error("Error fetching event summaries:", error);
    return c.json(
      { success: false, error: "Failed to fetch event summaries" },
      500
    );
  }
});

export default teams;
