import { Hono } from "hono";
import { getFTCApi } from "../lib/ftc-api";

const teams = new Hono();

/**
 * GET /api/teams/:teamNumber
 * Get a specific FTC team from the API
 */
teams.get("/:teamNumber", async (c) => {
  const teamNumber = parseInt(c.req.param("teamNumber"), 10);

  if (isNaN(teamNumber)) {
    return c.json(
      {
        success: false,
        error: "Invalid team number",
      },
      400
    );
  }

  try {
    const api = getFTCApi();
    const { teams: teamList } = await api.getTeam(teamNumber);

    if (teamList.length === 0) {
      return c.json(
        {
          success: false,
          error: "Team not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      data: teamList[0],
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return c.json(
      {
        success: false,
        error: "Failed to fetch team",
      },
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
    return c.json(
      {
        success: false,
        error: "Invalid team number",
      },
      400
    );
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
    return c.json(
      {
        success: false,
        error: "Failed to fetch team events",
      },
      500
    );
  }
});

export default teams;
