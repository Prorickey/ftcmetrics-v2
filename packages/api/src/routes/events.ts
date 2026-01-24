import { Hono } from "hono";
import { getFTCApi } from "../lib/ftc-api";

const events = new Hono();

/**
 * GET /api/events
 * Get all events for the current season
 */
events.get("/", async (c) => {
  try {
    const api = getFTCApi();
    const { events } = await api.getEvents();

    return c.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch events",
      },
      500
    );
  }
});

/**
 * GET /api/events/:eventCode
 * Get a specific event by code
 */
events.get("/:eventCode", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const api = getFTCApi();
    const { events: eventList } = await api.getEvent(eventCode);

    if (eventList.length === 0) {
      return c.json(
        {
          success: false,
          error: "Event not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: eventList[0],
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch event",
      },
      500
    );
  }
});

/**
 * GET /api/events/:eventCode/teams
 * Get teams at an event
 */
events.get("/:eventCode/teams", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const api = getFTCApi();
    const { teams } = await api.getEventTeams(eventCode);

    return c.json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error("Error fetching event teams:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch event teams",
      },
      500
    );
  }
});

/**
 * GET /api/events/:eventCode/schedule
 * Get match schedule for an event
 */
events.get("/:eventCode/schedule", async (c) => {
  const eventCode = c.req.param("eventCode");
  const level = c.req.query("level") === "playoff" ? "playoff" : "qual";

  try {
    const api = getFTCApi();
    const { schedule } = await api.getSchedule(eventCode, level);

    return c.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch schedule",
      },
      500
    );
  }
});

/**
 * GET /api/events/:eventCode/matches
 * Get match results for an event
 */
events.get("/:eventCode/matches", async (c) => {
  const eventCode = c.req.param("eventCode");
  const level = c.req.query("level") === "playoff" ? "playoff" : "qual";

  try {
    const api = getFTCApi();
    const { matches } = await api.getMatches(eventCode, level);

    return c.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch matches",
      },
      500
    );
  }
});

/**
 * GET /api/events/:eventCode/scores
 * Get detailed match scores for an event
 */
events.get("/:eventCode/scores", async (c) => {
  const eventCode = c.req.param("eventCode");
  const level = c.req.query("level") === "playoff" ? "playoff" : "qual";

  try {
    const api = getFTCApi();
    const { matchScores } = await api.getScores(eventCode, level);

    return c.json({
      success: true,
      data: matchScores,
    });
  } catch (error) {
    console.error("Error fetching scores:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch scores",
      },
      500
    );
  }
});

/**
 * GET /api/events/:eventCode/rankings
 * Get team rankings at an event
 */
events.get("/:eventCode/rankings", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const api = getFTCApi();
    const rankings = await api.getRankings(eventCode);

    return c.json({
      success: true,
      data: rankings.Rankings,
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch rankings",
      },
      500
    );
  }
});

export default events;
