import { config } from "dotenv";
import path from "path";

// Load .env from workspace root (works from packages/web or packages/api)
const envPath = path.resolve(process.cwd(), "../../.env");
config({ path: envPath });

// Fallback: try from monorepo root if cwd is already there
if (!process.env.DATABASE_URL) {
  config({ path: path.resolve(process.cwd(), ".env") });
}

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Create connection pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Prevent multiple instances during development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types
export * from "@prisma/client";
