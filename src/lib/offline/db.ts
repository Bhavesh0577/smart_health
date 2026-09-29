import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface OfflineEntry {
  id: string;
  phcId: string;
  type: "stock" | "beds" | "staff" | "footfall";
  timestamp: string;
  payload: any;
  syncStatus: "pending" | "synced" | "failed";
  retryCount?: number;
}

interface PhcOfflineDb extends DBSchema {
  offlineQueue: {
    key: string;
    value: OfflineEntry;
    indexes: { "by-status": string };
  };
}

let dbPromise: Promise<IDBPDatabase<PhcOfflineDb>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<PhcOfflineDb>> | null {
  if (typeof window === "undefined") return null;

  if (!dbPromise) {
    dbPromise = openDB<PhcOfflineDb>("phc_resilience_pwa_db", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("offlineQueue")) {
          const store = db.createObjectStore("offlineQueue", { keyPath: "id" });
          store.createIndex("by-status", "syncStatus");
        }
      },
    });
  }

  return dbPromise;
}

export async function queueOfflineEntry(
  entry: Omit<OfflineEntry, "id" | "timestamp" | "syncStatus">
): Promise<OfflineEntry> {
  const db = await getOfflineDb();
  const fullEntry: OfflineEntry = {
    ...entry,
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    syncStatus: "pending",
    retryCount: 0,
  };

  if (db) {
    await db.put("offlineQueue", fullEntry);
  }

  return fullEntry;
}

export async function getPendingOfflineEntries(): Promise<OfflineEntry[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const all = await db.getAll("offlineQueue");
  return all.filter((e) => e.syncStatus === "pending");
}

export async function getAllOfflineEntries(): Promise<OfflineEntry[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  return db.getAll("offlineQueue");
}

export async function markEntriesSynced(ids: string[]): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;

  const tx = db.transaction("offlineQueue", "readwrite");
  for (const id of ids) {
    const item = await tx.store.get(id);
    if (item) {
      item.syncStatus = "synced";
      await tx.store.put(item);
    }
  }
  await tx.done;
}

export async function flushOfflineQueue(node = "node_in_karnataka"): Promise<{
  syncedCount: number;
  failedCount: number;
}> {
  const pending = await getPendingOfflineEntries();
  if (pending.length === 0) return { syncedCount: 0, failedCount: 0 };

  try {
    const res = await fetch("/api/phc/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: pending, node }),
    });

    const data = await res.json();
    if (data.success && Array.isArray(data.syncedIds)) {
      await markEntriesSynced(data.syncedIds);
      return { syncedCount: data.syncedIds.length, failedCount: pending.length - data.syncedIds.length };
    }
    return { syncedCount: 0, failedCount: pending.length };
  } catch (err) {
    console.error("Queue flush failed:", err);
    return { syncedCount: 0, failedCount: pending.length };
  }
}
