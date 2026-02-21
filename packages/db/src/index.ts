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
import { encryptTokenFields, decryptTokenFields } from "./encryption";

// Create connection pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Prevent multiple instances during development
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  const base = new PrismaClient({ adapter });

  // Use Prisma client extensions to encrypt/decrypt OAuth token fields
  return base.$extends({
    query: {
      account: {
        async create({ args, query }) {
          if (args.data) {
            args.data = encryptTokenFields(args.data);
          }
          const result = await query(args);
          return decryptTokenFields(result);
        },
        async update({ args, query }) {
          if (args.data) {
            args.data = encryptTokenFields(args.data as Record<string, unknown>);
          }
          const result = await query(args);
          return decryptTokenFields(result);
        },
        async upsert({ args, query }) {
          if (args.create) {
            args.create = encryptTokenFields(args.create);
          }
          if (args.update) {
            args.update = encryptTokenFields(args.update as Record<string, unknown>);
          }
          const result = await query(args);
          return decryptTokenFields(result);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          return result ? decryptTokenFields(result) : result;
        },
        async findFirst({ args, query }) {
          const result = await query(args);
          return result ? decryptTokenFields(result) : result;
        },
        async findMany({ args, query }) {
          const results = await query(args);
          return results.map((r: Record<string, unknown>) => decryptTokenFields(r));
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types
export * from "@prisma/client";
export { encrypt, decrypt } from "./encryption";
