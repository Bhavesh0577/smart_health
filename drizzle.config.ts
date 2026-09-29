import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgrespassword@localhost:5432/smart_health",
  },
  schemaFilter: ["public", "node_in_karnataka", "node_br_bahia", "node_za_kzn"],
});
