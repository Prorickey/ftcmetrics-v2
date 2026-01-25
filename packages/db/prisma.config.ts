import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "path";

// Load .env from workspace root
config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  earlyAccess: true,
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    adapter: async () => {
      const { Pool } = await import("pg");
      const { PrismaPg } = await import("@prisma/adapter-pg");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
});
