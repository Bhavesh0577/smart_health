import { NextRequest, NextResponse } from "next/server";
import { getFederationHistory, runFederationRound } from "@/lib/services/federation-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await getFederationHistory();
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("Federation GET error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

const runRoundSchema = z.object({
  epsilon: z.coerce.number().min(0.01).max(100.0).default(1.0),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { epsilon } = runRoundSchema.parse(body);

    const result = await runFederationRound(epsilon);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Federation POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
