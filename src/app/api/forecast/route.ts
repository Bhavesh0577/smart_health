import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTablesForNode, simulationStates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requestForecast } from "@/lib/ml-client";
import { z } from "zod";

const forecastQuerySchema = z.object({
  phcId: z.string(),
  medicineId: z.string(),
  node: z.string().default("node_in_karnataka"),
  horizon: z.coerce.number().default(14),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = forecastQuerySchema.parse({
      phcId: searchParams.get("phcId"),
      medicineId: searchParams.get("medicineId"),
      node: searchParams.get("node") || "node_in_karnataka",
      horizon: searchParams.get("horizon") || 14,
    });

    const db = getDb();
    const tables = getTablesForNode(parsed.node);

    // Get simulation state (emergency active?)
    const simState = await db.select().from(simulationStates).where(eq(simulationStates.id, "active_state")).limit(1);
    const isEmergency = simState[0]?.isEmergencyActive || false;

    // Fetch latest stock row
    const stockRows = await db
      .select()
      .from(tables.stockLevels)
      .where(eq(tables.stockLevels.phcId, parsed.phcId))
      .orderBy(desc(tables.stockLevels.time))
      .limit(30);

    const medStock = stockRows.find((s: any) => s.medicineId === parsed.medicineId) || stockRows[0];
    const currentStock = medStock ? medStock.qty : 350;

    // Compute historical consumption trend
    const historicalSeries = stockRows
      .filter((s: any) => s.medicineId === parsed.medicineId)
      .map((s: any) => Math.max(5, Math.round(s.qty * 0.05 + 10)))
      .slice(0, 14);

    const result = await requestForecast({
      phc_id: parsed.phcId,
      medicine_id: parsed.medicineId,
      current_stock: currentStock,
      historical_consumption: historicalSeries.length ? historicalSeries : [25, 28, 30, 26, 29, 32, 35],
      forecast_horizon_days: parsed.horizon,
      is_emergency: isEmergency,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Forecast API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
