import { getDb } from "@/lib/db";
import { getNodeTables } from "@/lib/db/schema";
import { simulationStates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export interface ResilienceComponents {
  stockDaysOfCover: number;
  stockScore: number;
  bedHeadroomPercent: number;
  bedScore: number;
  staffAttendancePercent: number;
  staffScore: number;
  routeAccessibilityPercent: number;
  routeScore: number;
  compositeScore: number;
  tier: "Optimal" | "Moderate" | "Vulnerable" | "Critical";
}

export interface SimulationParams {
  monsoonIntensity?: number; // 1.0 (normal) to 3.0 (extreme)
  staffAbsentPercent?: number; // 0 to 50
  roadClosureActive?: boolean; // landslides / flooded bridges
  affectedDistrict?: string;
}

/**
 * Mathematical formulation of the 0-100 Resilience Score
 * Weights: Stock Cover (35%), Bed Headroom (25%), Staff Attendance (25%), Route Accessibility (15%)
 */
export function computeResilienceScore(
  daysOfCover: number,
  occupancyRatio: number,
  attendanceRatio: number,
  routePenalty: number = 0
): ResilienceComponents {
  // 1. Stock Score (0-100, 35% weight)
  // Ideal is >= 25 days of cover; <= 3 days is critical failure
  let stockScore = 0;
  if (daysOfCover >= 25) {
    stockScore = 100;
  } else if (daysOfCover <= 2) {
    stockScore = Math.max(0, daysOfCover * 5);
  } else {
    stockScore = Math.round(10 + ((daysOfCover - 2) / 23) * 90);
  }

  // 2. Bed Headroom Score (0-100, 25% weight)
  // Headroom % = (1 - occupancy). Target headroom >= 35%. < 5% is critical.
  const headroomRatio = Math.max(0, 1 - occupancyRatio);
  let bedScore = 0;
  if (headroomRatio >= 0.35) {
    bedScore = 100;
  } else if (headroomRatio <= 0.05) {
    bedScore = Math.max(5, Math.round(headroomRatio * 200));
  } else {
    bedScore = Math.round(10 + ((headroomRatio - 0.05) / 0.3) * 90);
  }

  // 3. Staff Score (0-100, 25% weight)
  const staffScore = Math.min(100, Math.max(0, Math.round(attendanceRatio * 100)));

  // 4. Route Accessibility Score (0-100, 15% weight)
  const routeScore = Math.min(100, Math.max(10, Math.round(100 - routePenalty)));

  // Composite formulation
  const rawComposite =
    0.35 * stockScore +
    0.25 * bedScore +
    0.25 * staffScore +
    0.15 * routeScore;

  const compositeScore = Math.round(rawComposite * 10) / 10;

  let tier: ResilienceComponents["tier"] = "Optimal";
  if (compositeScore < 50) tier = "Critical";
  else if (compositeScore < 68) tier = "Vulnerable";
  else if (compositeScore < 82) tier = "Moderate";

  return {
    stockDaysOfCover: Math.round(daysOfCover * 10) / 10,
    stockScore,
    bedHeadroomPercent: Math.round(headroomRatio * 100),
    bedScore,
    staffAttendancePercent: Math.round(attendanceRatio * 100),
    staffScore,
    routeAccessibilityPercent: Math.round((routeScore / 100) * 100),
    routeScore,
    compositeScore,
    tier,
  };
}

/**
 * Fetch active simulation parameters from database
 */
export async function getActiveSimulationState(): Promise<SimulationParams> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(simulationStates)
      .where(eq(simulationStates.id, "active_state"))
      .limit(1);

    if (rows.length > 0) {
      return {
        monsoonIntensity: rows[0].monsoonIntensity,
        staffAbsentPercent: rows[0].staffAbsentPercent,
        roadClosureActive: rows[0].roadClosureActive,
      };
    }
  } catch (e) {
    console.warn("Could not query simulationStates:", e);
  }
  return {
    monsoonIntensity: 1.0,
    staffAbsentPercent: 0,
    roadClosureActive: false,
  };
}
