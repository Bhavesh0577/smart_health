import { NextRequest, NextResponse } from "next/server";
import { getPhcDetail } from "@/lib/services/phc-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";

    const detail = await getPhcDetail(node, id);
    if (!detail) {
      return NextResponse.json(
        { success: false, error: "PHC not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    console.error("PHC detail API error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
