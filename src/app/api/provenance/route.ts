import { NextRequest, NextResponse } from "next/server";
import { getProvenanceReport } from "@/lib/services/provenance-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";

    const report = await getProvenanceReport(node);
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("Provenance API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
