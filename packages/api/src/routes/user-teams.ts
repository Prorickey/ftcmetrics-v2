import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";
import { getFTCApi } from "../lib/ftc-api";
import { randomUUID, randomBytes } from "crypto";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

const ALLOWED_PHOTO_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const PHOTO_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const userTeams = new Hono();

/**
 * Helper to generate random invite code
 */
function generateInviteCode(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
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
    const body = (c as any).get("sanitizedBody");
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
        media: {
          orderBy: { sortOrder: "asc" },
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

    const body = (c as any).get("sanitizedBody");
    const { name, sharingLevel, bio, robotName, robotDesc, drivetrainType, links } = body;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (sharingLevel && ["PRIVATE", "EVENT", "PUBLIC"].includes(sharingLevel)) {
      updateData.sharingLevel = sharingLevel;
    }
    if (bio !== undefined) updateData.bio = bio || null;
    if (robotName !== undefined) updateData.robotName = robotName || null;
    if (robotDesc !== undefined) updateData.robotDesc = robotDesc || null;
    if (drivetrainType !== undefined) {
      if (drivetrainType && ["mecanum", "tank", "swerve", "other"].includes(drivetrainType)) {
        updateData.drivetrainType = drivetrainType;
      } else {
        updateData.drivetrainType = null;
      }
    }
    if (links !== undefined) {
      if (links === null) {
        updateData.links = null;
      } else if (Array.isArray(links)) {
        const valid = links.every(
          (l: unknown) =>
            typeof l === "object" &&
            l !== null &&
            typeof (l as Record<string, unknown>).title === "string" &&
            typeof (l as Record<string, unknown>).url === "string"
        );
        if (!valid) {
          return c.json({ success: false, error: "Links must be an array of {title, url} objects" }, 400);
        }
        updateData.links = links;
      }
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

    const body = (c as any).get("sanitizedBody") || {};
    const maxUses = typeof body.maxUses === "number" && body.maxUses > 0 ? body.maxUses : undefined;

    const invite = await prisma.teamInvite.create({
      data: {
        teamId,
        code,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ...(maxUses !== undefined ? { maxUses } : {}),
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
    const body = (c as any).get("sanitizedBody");
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

    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return c.json({ success: false, error: "Invite code has reached maximum uses" }, 400);
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

    // Increment invite usage count
    await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { uses: { increment: 1 } },
    });

    return c.json({
      success: true,
      data: {
        teamId: invite.teamId,
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

    const body = (c as any).get("sanitizedBody");
    const { role } = body;

    if (!role || !["MENTOR", "LEADER", "STUDENT", "FRIEND"].includes(role)) {
      return c.json({ success: false, error: "Invalid role" }, 400);
    }

    // Only admins (MENTOR/LEADER) can change roles
    const isAdmin = userMembership.role === "MENTOR" || userMembership.role === "LEADER";

    if (!isAdmin) {
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

/**
 * POST /api/user-teams/:teamId/media
 * Add a media item (MENTOR/LEADER only)
 * Supports multipart/form-data for file uploads (PHOTO/VIDEO) and JSON for URL-based media
 */
userTeams.post("/:teamId/media", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!membership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    if (membership.role !== "MENTOR" && membership.role !== "LEADER") {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    const contentType = c.req.header("Content-Type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    if (isMultipart) {
      // File upload flow
      const formData = await c.req.parseBody();
      const type = formData["type"] as string;
      const title = formData["title"] as string;
      const description = (formData["description"] as string) || null;
      const file = formData["file"] as File;

      if (!type || !["PHOTO", "VIDEO"].includes(type)) {
        return c.json({ success: false, error: "File uploads only allowed for PHOTO or VIDEO" }, 400);
      }
      if (!title) {
        return c.json({ success: false, error: "Title is required" }, 400);
      }
      if (!file || !(file instanceof File)) {
        return c.json({ success: false, error: "File is required" }, 400);
      }

      const fileSize = file.size;

      // Validate file size before reading bytes
      const maxSize = type === "PHOTO" ? PHOTO_MAX_SIZE : VIDEO_MAX_SIZE;
      if (fileSize > maxSize) {
        const maxMB = maxSize / (1024 * 1024);
        return c.json({ success: false, error: `File too large. Maximum ${maxMB}MB for ${type.toLowerCase()}s` }, 400);
      }

      // Validate magic bytes to detect actual file type
      const arrayBuffer = await file.arrayBuffer();
      const header = new Uint8Array(arrayBuffer.slice(0, 12));

      let detectedMime: string | null = null;
      if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        detectedMime = "image/jpeg";
      } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        detectedMime = "image/png";
      } else if (
        header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
        header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
      ) {
        detectedMime = "image/webp";
      }

      if (!detectedMime) {
        return c.json({ success: false, error: "Invalid file type" }, 400);
      }

      const mimeType = detectedMime;

      // Validate detected MIME type against allowed types
      if (type === "PHOTO" && !ALLOWED_PHOTO_MIMES.includes(mimeType)) {
        return c.json({ success: false, error: "Invalid photo type. Allowed: JPEG, PNG, WebP" }, 400);
      }
      if (type === "VIDEO" && !ALLOWED_VIDEO_MIMES.includes(mimeType)) {
        return c.json({ success: false, error: "Invalid video type. Allowed: MP4, WebM, QuickTime" }, 400);
      }

      // Save file to disk
      const ext = MIME_TO_EXT[mimeType] || "";
      const filename = `${randomUUID()}${ext}`;
      await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
      const filePath = path.join(UPLOADS_DIR, filename);
      const buffer = Buffer.from(arrayBuffer);
      await fs.promises.writeFile(filePath, buffer);

      const url = `/api/uploads/${filename}`;

      const maxSort = await prisma.teamMedia.aggregate({
        where: { teamId, type: type as "PHOTO" | "VIDEO" },
        _max: { sortOrder: true },
      });

      const media = await prisma.teamMedia.create({
        data: {
          teamId,
          type: type as "PHOTO" | "VIDEO",
          title,
          url,
          description,
          fileSize,
          mimeType,
          isUpload: true,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });

      return c.json({ success: true, data: media });
    } else {
      // JSON URL-based flow
      const body = (c as any).get("sanitizedBody");
      const { type, title, url, description } = body;

      if (type === "LINK") {
        return c.json({
          success: false,
          error: "LINK type is no longer accepted for new media. Use team profile links instead (PATCH /:teamId with links field).",
        }, 400);
      }

      if (!type || !["CAD", "VIDEO", "PHOTO"].includes(type)) {
        return c.json({ success: false, error: "Invalid media type" }, 400);
      }
      if (!title || !url) {
        return c.json({ success: false, error: "Title and URL are required" }, 400);
      }

      const maxSort = await prisma.teamMedia.aggregate({
        where: { teamId, type },
        _max: { sortOrder: true },
      });

      const media = await prisma.teamMedia.create({
        data: {
          teamId,
          type,
          title,
          url,
          description: description || null,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });

      return c.json({ success: true, data: media });
    }
  } catch (error) {
    console.error("Error creating media:", error);
    return c.json({ success: false, error: "Failed to create media" }, 500);
  }
});

/**
 * PATCH /api/user-teams/:teamId/media/:mediaId
 * Update a media item (MENTOR/LEADER only)
 */
userTeams.patch("/:teamId/media/:mediaId", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");
  const mediaId = c.req.param("mediaId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!membership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    if (membership.role !== "MENTOR" && membership.role !== "LEADER") {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    const existing = await prisma.teamMedia.findUnique({
      where: { id: mediaId },
    });

    if (!existing || existing.teamId !== teamId) {
      return c.json({ success: false, error: "Media not found" }, 404);
    }

    const body = (c as any).get("sanitizedBody");
    const { title, url, description, sortOrder } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (url !== undefined) updateData.url = url;
    if (description !== undefined) updateData.description = description || null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const media = await prisma.teamMedia.update({
      where: { id: mediaId },
      data: updateData,
    });

    return c.json({ success: true, data: media });
  } catch (error) {
    console.error("Error updating media:", error);
    return c.json({ success: false, error: "Failed to update media" }, 500);
  }
});

/**
 * DELETE /api/user-teams/:teamId/media/:mediaId
 * Delete a media item (MENTOR/LEADER only)
 */
userTeams.delete("/:teamId/media/:mediaId", async (c) => {
  const userId = c.req.header("X-User-Id");
  const teamId = c.req.param("teamId");
  const mediaId = c.req.param("mediaId");

  if (!userId) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!membership) {
      return c.json({ success: false, error: "Not a team member" }, 403);
    }

    if (membership.role !== "MENTOR" && membership.role !== "LEADER") {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }

    const existing = await prisma.teamMedia.findUnique({
      where: { id: mediaId },
    });

    if (!existing || existing.teamId !== teamId) {
      return c.json({ success: false, error: "Media not found" }, 404);
    }

    // Delete file from disk if it was an upload
    if (existing.isUpload) {
      const filename = existing.url.replace("/api/uploads/", "");
      if (filename && !filename.includes("..") && !filename.includes("/")) {
        const filePath = path.join(UPLOADS_DIR, filename);
        try {
          await fs.promises.unlink(filePath);
        } catch {
          // File may already be deleted; continue
        }
      }
    }

    await prisma.teamMedia.delete({
      where: { id: mediaId },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting media:", error);
    return c.json({ success: false, error: "Failed to delete media" }, 500);
  }
});

export default userTeams;
