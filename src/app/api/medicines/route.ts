import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTablesForNode } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";

    const db = getDb();
    const tables = getTablesForNode(node);

    const medicines = await db.select().from(tables.medicines);

    return NextResponse.json({
      success: true,
      data: medicines.map((m: any) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        unitCost: m.unitCost,
        reorderThreshold: m.reorderThreshold,
        shelfLifeDays: m.shelfLifeDays,
        levelOfCare: m.levelOfCare,
        sourcePage: m.sourcePage,
        dataOrigin: m.dataOrigin || "real",
        sourceDataset: m.sourceDataset || "nlem_2022",
      })),
    });
  } catch (error) {
    console.error("Medicines API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
