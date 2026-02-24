import { Hono } from "hono";
import { prisma } from "@ftcmetrics/db";

const app = new Hono();

// PATCH / - Update current user's profile
app.patch("/me", async (c) => {
  const userId = (c as any).get("userId");
  if (!userId) return c.json({ success: false, error: "Authentication required" }, 401);

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON" }, 400);
  }

  const { name, image } = body;
  const updates: Record<string, string> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return c.json({ success: false, error: "Name must be a non-empty string (max 100 characters)" }, 400);
    }
    updates.name = name.trim();
  }

  if (image !== undefined) {
    if (image !== null) {
      if (typeof image !== "string" || image.length > 2000) {
        return c.json({ success: false, error: "Image must be a valid URL (max 2000 characters)" }, 400);
      }
      try {
        const url = new URL(image);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return c.json({ success: false, error: "Image URL must use http or https" }, 400);
        }
      } catch {
        return c.json({ success: false, error: "Image must be a valid URL" }, 400);
      }
      updates.image = image;
    } else {
      (updates as any).image = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ success: false, error: "No valid fields to update" }, 400);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, name: true, image: true, email: true },
    });
    return c.json({ success: true, data: user });
  } catch (err) {
    console.error("[Users] Update failed:", err);
    return c.json({ success: false, error: "Failed to update profile" }, 500);
  }
});

// DELETE /me - Delete current user's account
app.delete("/me", async (c) => {
  const userId = (c as any).get("userId");
  if (!userId) return c.json({ success: false, error: "Authentication required" }, 401);

  try {
    await prisma.user.delete({ where: { id: userId } });
    return c.json({ success: true });
  } catch (err) {
    console.error("[Users] Delete failed:", err);
    return c.json({ success: false, error: "Failed to delete account" }, 500);
  }
});

export default app;
