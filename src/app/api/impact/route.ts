import { NextRequest, NextResponse } from "next/server";
import { computeImpactBacktest } from "@/lib/services/impact-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";

    const result = await computeImpactBacktest(node);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Impact backtest error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
