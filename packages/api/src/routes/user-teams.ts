import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";
import { getFTCApi } from "../lib/ftc-api";

const userTeams = new Hono();

/**
 * Helper to generate random invite code
 */
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * GET /api/user-teams
 * Get all teams the current user is a member of
 */
userTeams.get("/", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: true,
      },
    });

    return c.json({
      success: true,
      data: memberships.map((m) => ({
        teamId: m.teamId,
        role: m.role,
        joinedAt: m.joinedAt,
        team: m.team,
      })),
    });
  } catch (error) {
    console.error("Error fetching user teams:", error);
    return c.json({ success: false, error: "Failed to fetch teams" }, 500);
  }
});

/**
 * POST /api/user-teams
 * Create a new team (claim an FTC team number)
 */
userTeams.post("/", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { teamNumber, name } = body;

    if (!teamNumber || typeof teamNumber !== "number") {
      return c.json({ success: false, error: "Team number is required" }, 400);
    }

    // Check if team already exists
    const existingTeam = await prisma.team.findUnique({
      where: { teamNumber },
    });

    if (existingTeam) {
      return c.json(
        { success: false, error: "Team number already claimed" },
        409
      );
    }

    // Optionally verify team exists in FTC API
    let teamName = name;
    if (!teamName) {
      try {
        const api = getFTCApi();
        const { teams } = await api.getTeam(teamNumber);
        if (teams.length > 0) {
          teamName = teams[0].nameShort || teams[0].nameFull;
        }
      } catch {
        // If API fails, use generic name
        teamName = `Team ${teamNumber}`;
      }
    }

    // Create team and add user as first member
    const team = await prisma.team.create({
      data: {
        teamNumber,
        name: teamName,
        members: {
          create: {
            userId,
            role: "MENTOR",
          },
        },
      },
      include: {
        members: true,
      },
    });

    return c.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error("Error creating team:", error);
    return c.json({ success: false, error: "Failed to create team" }, 500);
  }
});

/**
 * GET /api/user-teams/:teamId
 * Get a specific team's details
 */
userTeams.get("/:teamId", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Check if user is a member
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!membership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        invites: {
          where: {
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    if (!team) {
      return c.json({ success: false, error: "Team not found" }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...team,
        userRole: membership.role,
      },
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return c.json({ success: false, error: "Failed to fetch team" }, 500);
  }
});

/**
 * PATCH /api/user-teams/:teamId
 * Update team settings (MENTOR/LEADER only)
 */
userTeams.patch("/:teamId", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Check if user is a team member with admin privileges
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!membership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    // Only MENTOR or LEADER can update team settings
    if (membership.role !== "MENTOR" && membership.role !== "LEADER") {
      return c.json(
        { success: false, error: "Insufficient permissions" },
        403
      );
    }

    const body = await c.req.json();
    const { name, sharingLevel } = body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (sharingLevel && ["PRIVATE", "EVENT", "PUBLIC"].includes(sharingLevel)) {
      updateData.sharingLevel = sharingLevel;
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
    });

    return c.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error("Error updating team:", error);
    return c.json({ success: false, error: "Failed to update team" }, 500);
  }
});

/**
 * POST /api/user-teams/:teamId/invites
 * Create an invite code (MENTOR/LEADER only)
 */
userTeams.post("/:teamId/invites", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Check if user is a team member with admin privileges
    const membership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!membership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    // Only MENTOR or LEADER can create invites
    if (membership.role !== "MENTOR" && membership.role !== "LEADER") {
      return c.json(
        { success: false, error: "Insufficient permissions" },
        403
      );
    }

    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await prisma.teamInvite.findUnique({ where: { code } });
      if (!existing) break;
      code = generateInviteCode();
      attempts++;
    }

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        code,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return c.json({
      success: true,
      data: invite,
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return c.json({ success: false, error: "Failed to create invite" }, 500);
  }
});

/**
 * POST /api/user-teams/join
 * Join a team using an invite code
 */
userTeams.post("/join", async (c) => {
  const userId = c.req.header("X-User-Id");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { code } = body;

    if (!code) {
      return c.json({ success: false, error: "Invite code required" }, 400);
    }

    // Find valid invite
    const invite = await prisma.teamInvite.findUnique({
      where: { code: code.toUpperCase() },
      include: { team: true },
    });

    if (!invite) {
      return c.json({ success: false, error: "Invalid invite code" }, 404);
    }

    if (invite.expiresAt < new Date()) {
      return c.json({ success: false, error: "Invite code expired" }, 410);
    }

    // Check if already a member
    const existingMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: invite.teamId },
      },
    });

    if (existingMembership) {
      return c.json(
        { success: false, error: "Already a member of this team" },
        409
      );
    }

    // Add as student (default role)
    await prisma.teamMember.create({
      data: {
        userId,
        teamId: invite.teamId,
        role: "STUDENT",
      },
    });

    return c.json({
      success: true,
      data: {
        team: invite.team,
        role: "STUDENT",
      },
    });
  } catch (error) {
    console.error("Error joining team:", error);
    return c.json({ success: false, error: "Failed to join team" }, 500);
  }
});

/**
 * DELETE /api/user-teams/:teamId/members/:memberId
 * Remove a member from team (MENTOR/LEADER only, or self)
 */
userTeams.delete("/:teamId/members/:memberId", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");
  const memberId = c.req.param("memberId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Get user's membership
    const userMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!userMembership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    const targetMembership = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMembership || targetMembership.teamId !== teamId) {
      return c.json({ success: false, error: "Member not found" }, 404);
    }

    // Users can remove themselves, or MENTOR/LEADER can remove others
    const isSelf = targetMembership.userId === userId;
    const isAdmin = userMembership.role === "MENTOR" || userMembership.role === "LEADER";

    if (!isSelf && !isAdmin) {
      return c.json(
        { success: false, error: "Insufficient permissions" },
        403
      );
    }

    // Don't allow removing the last admin
    if (targetMembership.role === "MENTOR" || targetMembership.role === "LEADER") {
      const adminCount = await prisma.teamMember.count({
        where: {
          teamId,
          role: { in: ["MENTOR", "LEADER"] },
        },
      });

      if (adminCount === 1) {
        return c.json(
          { success: false, error: "Cannot remove the last admin" },
          400
        );
      }
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return c.json({ success: false, error: "Failed to remove member" }, 500);
  }
});

/**
 * PATCH /api/user-teams/:teamId/members/:memberId
 * Update member role (MENTOR/LEADER only, or updating own role)
 */
userTeams.patch("/:teamId/members/:memberId", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");
  const memberId = c.req.param("memberId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    // Check if requesting user is a team member
    const userMembership = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId },
      },
    });

    if (!userMembership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    // Get the target member
    const targetMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.teamId !== teamId) {
      return c.json({ success: false, error: "Member not found" }, 404);
    }

    const body = await c.req.json();
    const { role } = body;

    if (!role || !["MENTOR", "LEADER", "STUDENT", "FRIEND"].includes(role)) {
      return c.json({ success: false, error: "Invalid role" }, 400);
    }

    // Check permissions: Must be admin (MENTOR/LEADER) or updating own role
    const isSelf = targetMember.userId === userId;
    const isAdmin = userMembership.role === "MENTOR" || userMembership.role === "LEADER";

    if (!isSelf && !isAdmin) {
      return c.json(
        { success: false, error: "Insufficient permissions" },
        403
      );
    }

    // Don't allow demoting the last admin
    if (
      (targetMember.role === "MENTOR" || targetMember.role === "LEADER") &&
      (role === "STUDENT" || role === "FRIEND")
    ) {
      const adminCount = await prisma.teamMember.count({
        where: {
          teamId,
          role: { in: ["MENTOR", "LEADER"] },
        },
      });

      if (adminCount === 1) {
        return c.json(
          { success: false, error: "Cannot demote the last admin" },
          400
        );
      }
    }

    const member = await prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
    });

    return c.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return c.json({ success: false, error: "Failed to update member" }, 500);
  }
});

export default userTeams;
