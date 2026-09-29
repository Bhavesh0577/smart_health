import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { simulationStates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const emergencySchema = z.object({
  action: z.enum(["trigger", "reset", "status"]),
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
    const { action } = emergencySchema.parse(body);
    const db = getDb();

    const isEmergency = action === "trigger";

    await db
      .insert(simulationStates)
      .values({
        id: "active_state",
        isEmergencyActive: isEmergency,
        roadClosureActive: isEmergency,
        staffAbsentPercent: isEmergency ? 20 : 0,
        monsoonIntensity: isEmergency ? 2.5 : 1.0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: simulationStates.id,
        set: {
          isEmergencyActive: isEmergency,
          roadClosureActive: isEmergency,
          staffAbsentPercent: isEmergency ? 20 : 0,
          monsoonIntensity: isEmergency ? 2.5 : 1.0,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      success: true,
      action,
      isEmergencyActive: isEmergency,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
