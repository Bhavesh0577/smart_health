import { NextRequest, NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/services/dashboard-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";
    const district = searchParams.get("district") || undefined;

    const stats = await getDashboardStats(node, district);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("Dashboard stats API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
