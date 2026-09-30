import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { env } from "../env";
import path from "path";
import fs from "fs";

// Persistent global singleton across Next.js development hot-module reloads
const globalForDb = globalThis as unknown as {
  dbInstance?: any;
  pgliteClient?: PGlite;
  isPglite?: boolean;
};

export function getPgliteDb() {
  if (globalForDb.dbInstance && globalForDb.isPglite) {
    return globalForDb.dbInstance;
  }

  const dataDir = path.join(process.cwd(), ".pglite_data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!globalForDb.pgliteClient) {
    // Remove stale lock file if left by previous unclean termination
    const pidFile = path.join(dataDir, "postmaster.pid");
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch {
        // ignore
      }
    }
    globalForDb.pgliteClient = new PGlite(dataDir);
  }

  globalForDb.dbInstance = drizzlePglite(globalForDb.pgliteClient, { schema });
  globalForDb.isPglite = true;
  return globalForDb.dbInstance;
}

export function getDb() {
  if (globalForDb.dbInstance) {
    return globalForDb.dbInstance;
  }

  // If USE_PGLITE is requested (default for zero-cloud reproducible setup)
  if (process.env.USE_PGLITE === "true" || env.USE_PGLITE === "true") {
    return getPgliteDb();
  }

  // Otherwise try PostgreSQL / TimescaleDB via env.DATABASE_URL
  try {
    const connectionString = env.DATABASE_URL;
    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 2,
    });
    globalForDb.dbInstance = drizzlePg(client, { schema });
    return globalForDb.dbInstance;
  } catch (err) {
    console.warn("Falling back to local persistent PGlite engine:", err);
    return getPgliteDb();
  }
}

export const db = getDb();
export { schema };
export * from "./schema";
