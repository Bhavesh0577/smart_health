import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { env } from "../env";
import path from "path";
import fs from "fs";

let dbInstance: any = null;
let isPglite = false;

export function getDb() {
  if (dbInstance) return dbInstance;

  // First try PostgreSQL / TimescaleDB via env.DATABASE_URL
  const connectionString = env.DATABASE_URL;

  // In test, seed, or dev environments, test if PostgreSQL is responsive
  // If not or if explicitly using pglite, use PGlite WASM engine
  try {
    if (process.env.USE_PGLITE === "true") {
      throw new Error("PGlite explicitly requested");
    }

    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 2,
    });
    dbInstance = drizzlePg(client, { schema });
    return dbInstance;
  } catch (err) {
    console.warn("Falling back to local persistent PGlite engine:", err);
    return getPgliteDb();
  }
}

export function getPgliteDb() {
  if (dbInstance && isPglite) return dbInstance;

  const dataDir = path.join(process.cwd(), ".pglite_data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pglite = new PGlite(dataDir);
  dbInstance = drizzlePglite(pglite, { schema });
  isPglite = true;
  return dbInstance;
}

export const db = getDb();
export { schema };
export * from "./schema";
