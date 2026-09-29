import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTablesForNode } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { solveRedistribution, fetchOsrmRoadEta, TransferMoveItem } from "@/lib/ml-client";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";

    const db = getDb();
    const tables = getTablesForNode(node);

    const plans = await db
      .select()
      .from(tables.redistributionPlans)
      .orderBy(desc(tables.redistributionPlans.createdAt));

    const parsedPlans = plans.map((p: any) => ({
      id: p.id,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      status: p.status,
      totalCostEstimate: p.totalCostEstimate,
      explanation: p.explanation,
      triggeredBy: p.triggeredBy,
      moves: (p.movesJson as any[]) || [],
    }));

    return NextResponse.json({ success: true, data: parsedPlans });
  } catch (error) {
    console.error("Redistribution GET error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["generate", "update_status"]),
  node: z.string().default("node_in_karnataka"),
  medicineId: z.string().optional().default("MED_ORS"),
  planId: z.string().optional(),
  status: z.enum(["recommended", "approved", "in_transit", "completed", "rejected"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, node, medicineId, planId, status } = actionSchema.parse(body);

    const db = getDb();
    const tables = getTablesForNode(node);

    // 1. Update status workflow
    if (action === "update_status" && planId && status) {
      await db
        .update(tables.redistributionPlans)
        .set({ status })
        .where(eq(tables.redistributionPlans.id, planId));

      return NextResponse.json({
        success: true,
        message: `Plan ${planId} transitioned to ${status}.`,
        planId,
        status,
      });
    }

    // 2. Generate new Min-Cost Flow Plan
    if (action === "generate") {
      const phcs = await db.select().from(tables.phcs);
      const medicines = await db.select().from(tables.medicines);
      const activeMed = medicines.find((m: any) => m.id === medicineId) || medicines[0];

      // Fetch latest stock levels for this medicine
      const allStock = await db
        .select()
        .from(tables.stockLevels)
        .where(eq(tables.stockLevels.medicineId, activeMed.id))
        .orderBy(desc(tables.stockLevels.time))
        .limit(phcs.length * 2);

      const latestStockMap = new Map<string, any>();
      for (const s of allStock) {
        if (!latestStockMap.has(s.phcId)) {
          latestStockMap.set(s.phcId, s);
        }
      }

      const nowMs = Date.now();
      const phcInventories = phcs.map((p: any) => {
        const s = latestStockMap.get(p.id) || {
          qty: 400,
          reorderThreshold: activeMed.reorderThreshold,
          daysOfCover: 20.0,
          expiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
        };

        const daysToExpiry = Math.round((new Date(s.expiryDate).getTime() - nowMs) / (24 * 3600 * 1000));
        const nearExpQty = daysToExpiry <= 45 ? Math.round(s.qty * 0.4) : 0;

        return {
          phc_id: p.id,
          name: p.name,
          district: p.district,
          lat: p.lat,
          lng: p.lng,
          current_stock: s.qty,
          reorder_threshold: s.reorderThreshold,
          days_of_cover: s.daysOfCover,
          daily_consumption: Math.max(5, Math.round(s.qty / Math.max(1, s.daysOfCover))),
          near_expiry_qty: nearExpQty,
        };
      });

      const solution = await solveRedistribution({
        node_id: node,
        medicine_id: activeMed.id,
        medicine_name: activeMed.name,
        phc_inventories: phcInventories,
      });

      // Enhance moves with OSRM road calculations where possible
      const enhancedMoves: TransferMoveItem[] = [];
      for (const m of solution.moves) {
        const road = await fetchOsrmRoadEta(m.from_lng, m.from_lat, m.to_lng, m.to_lat);
        enhancedMoves.push({
          ...m,
          distance_km: road.distanceKm,
          eta_minutes: road.etaMinutes,
        });
      }

      const newPlanId = `plan_${node}_${Date.now()}`;
      await db.insert(tables.redistributionPlans).values({
        id: newPlanId,
        createdAt: new Date(),
        status: "recommended",
        movesJson: enhancedMoves,
        totalCostEstimate: Math.round(solution.total_distance_km * 18.5),
        explanation: solution.plain_language_summary,
        triggeredBy: "optimizer",
      });

      return NextResponse.json({
        success: true,
        plan: {
          id: newPlanId,
          createdAt: new Date().toISOString(),
          status: "recommended",
          totalCostEstimate: Math.round(solution.total_distance_km * 18.5),
          explanation: solution.plain_language_summary,
          triggeredBy: "optimizer",
          moves: enhancedMoves,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Redistribution POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
