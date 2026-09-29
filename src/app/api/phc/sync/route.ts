import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getNodeTables } from "@/lib/db/schema";
import { z } from "zod";

const syncPayloadSchema = z.object({
  node: z.string().optional().default("node_in_karnataka"),
  entries: z.array(
    z.object({
      id: z.string(),
      phcId: z.string(),
      type: z.enum(["stock", "beds", "staff", "footfall"]),
      timestamp: z.string(),
      payload: z.record(z.string(), z.any()),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { node, entries } = syncPayloadSchema.parse(body);

    const db = getDb();
    const tables = getNodeTables(node);
    const syncedIds: string[] = [];

    for (const entry of entries) {
      const entryTime = new Date(entry.timestamp);

      switch (entry.type) {
        case "stock": {
          const p = entry.payload;
          const expiryDate = p.expiryDate ? new Date(p.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          const daysOfCover = Number(((p.qty || 100) / 35).toFixed(1));

          await db.insert(tables.stockLevels).values({
            time: entryTime,
            phcId: entry.phcId,
            medicineId: p.medicineId || "MED_PARA",
            qty: Number(p.qty) || 0,
            reorderThreshold: 1000,
            expiryDate,
            daysOfCover,
            source: "offline_pwa_sync",
          });
          syncedIds.push(entry.id);
          break;
        }

        case "beds": {
          const p = entry.payload;
          await db.insert(tables.bedStatus).values({
            time: entryTime,
            phcId: entry.phcId,
            totalBeds: Number(p.totalBeds) || 10,
            occupiedBeds: Number(p.occupiedBeds) || 0,
            criticalCareBeds: Number(p.criticalCareBeds) || 2,
            availableOxygenBeds: Number(p.availableOxygenBeds) || 4,
          });
          syncedIds.push(entry.id);
          break;
        }

        case "staff": {
          const p = entry.payload;
          const docs = Number(p.doctorsPresent) || 1;
          const nurses = Number(p.nursesPresent) || 2;
          const pharm = Number(p.pharmacistsPresent) || 1;
          const totalDuty = docs + nurses + pharm;
          const reqTotal = Number(p.requiredStaff) || 7;

          await db.insert(tables.staffAttendance).values({
            time: entryTime,
            phcId: entry.phcId,
            doctorsPresent: docs,
            nursesPresent: nurses,
            pharmacistsPresent: pharm,
            staffOnDuty: totalDuty,
            requiredStaff: reqTotal,
          });
          syncedIds.push(entry.id);
          break;
        }

        case "footfall": {
          const p = entry.payload;
          await db.insert(tables.patientFootfall).values({
            time: entryTime,
            phcId: entry.phcId,
            opdCount: Number(p.opdCount) || 1,
            symptomCategory: p.symptomCategory || "general",
          });
          syncedIds.push(entry.id);
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      syncedIds,
      count: syncedIds.length,
    });
  } catch (error) {
    console.error("PHC offline sync error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
