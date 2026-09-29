import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { simulationStates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { injectEmergencyOutbreakCluster, resetEmergencyOutbreakCluster } from "@/lib/services/emergency-service";

const emergencySchema = z.object({
  action: z.enum(["trigger", "reset", "status"]),
  node: z.string().optional().default("node_in_karnataka"),
});

export async function GET() {
  try {
    const db = getDb();
    const state = await db.select().from(simulationStates).where(eq(simulationStates.id, "active_state")).limit(1);
    return NextResponse.json({
      success: true,
      state: state[0] || { isEmergencyActive: false, roadClosureActive: false, staffAbsentPercent: 0, monsoonIntensity: 1.0 },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, node } = emergencySchema.parse(body);

    if (action === "trigger") {
      const result = await injectEmergencyOutbreakCluster(node);
      return NextResponse.json({
        success: true,
        action,
        isEmergencyActive: true,
        cluster: result,
      });
    } else if (action === "reset") {
      await resetEmergencyOutbreakCluster(node);
      return NextResponse.json({
        success: true,
        action,
        isEmergencyActive: false,
      });
    }

    return NextResponse.json({ success: true, action: "status" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}

