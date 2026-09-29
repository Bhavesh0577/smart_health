import { NextRequest, NextResponse } from "next/server";
import { getAllPhcs } from "@/lib/services/phc-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";
    const district = searchParams.get("district") || undefined;

    const phcs = await getAllPhcs(node, district);
    return NextResponse.json({ success: true, data: phcs });
  } catch (error) {
    console.error("PHCs list API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
