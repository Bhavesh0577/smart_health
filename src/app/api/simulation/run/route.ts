import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getNodeTables } from "@/lib/db/schema";
import { computeResilienceScore } from "@/lib/services/resilience-service";
import { z } from "zod";

const simulationRunSchema = z.object({
  node: z.string().optional().default("node_in_karnataka"),
  monsoonIntensity: z.number().min(1.0).max(3.0).default(1.0),
  staffAbsentPercent: z.number().min(0).max(50).default(0),
  roadClosureActive: z.boolean().default(false),
  district: z.string().optional().default("All Districts"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const params = simulationRunSchema.parse(body);

    const db = getDb();
    const tables = getNodeTables(params.node);

    // Fetch PHCs
    const phcs = await db.select().from(tables.phcs);
    const filteredPhcs =
      params.district && params.district !== "All Districts"
        ? phcs.filter((p: any) => p.district === params.district)
        : phcs;

    // Fetch latest stock levels
    const stockRows = await db
      .select({
        phcId: tables.stockLevels.phcId,
        daysOfCover: tables.stockLevels.daysOfCover,
        qty: tables.stockLevels.qty,
      })
      .from(tables.stockLevels)
      .limit(600);

    const phcMinCover = new Map<string, number>();
    for (const r of stockRows) {
      const prev = phcMinCover.get(r.phcId) ?? 999;
      if (r.daysOfCover < prev) {
        phcMinCover.set(r.phcId, r.daysOfCover);
      }
    }

    // Fetch latest bed status
    const bedRows = await db
      .select({
        phcId: tables.bedStatus.phcId,
        totalBeds: tables.bedStatus.totalBeds,
        occupiedBeds: tables.bedStatus.occupiedBeds,
      })
      .from(tables.bedStatus)
      .limit(200);

    const phcBedOccupancy = new Map<string, number>();
    for (const b of bedRows) {
      if (!phcBedOccupancy.has(b.phcId) && b.totalBeds > 0) {
        phcBedOccupancy.set(b.phcId, b.occupiedBeds / b.totalBeds);
      }
    }

    // Fetch latest staff attendance
    const staffRows = await db
      .select({
        phcId: tables.staffAttendance.phcId,
        staffOnDuty: tables.staffAttendance.staffOnDuty,
        requiredStaff: tables.staffAttendance.requiredStaff,
      })
      .from(tables.staffAttendance)
      .limit(200);

    const phcStaffRatio = new Map<string, number>();
    for (const s of staffRows) {
      if (!phcStaffRatio.has(s.phcId) && s.requiredStaff > 0) {
        phcStaffRatio.set(s.phcId, s.staffOnDuty / s.requiredStaff);
      }
    }

    // Compute Baseline vs Simulated for each PHC
    let baselineTotalScore = 0;
    let simTotalScore = 0;
    let baselineAtRiskCount = 0;
    let simAtRiskCount = 0;
    let baselineBedOccSum = 0;
    let simBedOccSum = 0;
    let baselineStaffSum = 0;
    let simStaffSum = 0;

    const districtDeltas = new Map<
      string,
      {
        totalPhcs: number;
        baselineScoreSum: number;
        simScoreSum: number;
        baselineAtRisk: number;
        simAtRisk: number;
      }
    >();

    const totalPhcs = filteredPhcs.length || 1;

    for (const p of filteredPhcs) {
      const baseDays = phcMinCover.get(p.id) ?? 18.0;
      const baseOcc = phcBedOccupancy.get(p.id) ?? 0.65;
      const baseStaff = phcStaffRatio.get(p.id) ?? 0.88;

      // Baseline resilience
      const baseRes = computeResilienceScore(baseDays, baseOcc, baseStaff, 0);
      baselineTotalScore += baseRes.compositeScore;
      if (baseDays <= 7.0) baselineAtRiskCount++;
      baselineBedOccSum += baseOcc;
      baselineStaffSum += baseStaff;

      // Simulated values
      // Monsoon surge factor
      const monsoonDemandMultiplier = 1.0 + (params.monsoonIntensity - 1.0) * 0.95;
      const isMonsoonVulnerableDistrict =
        p.district === "Dakshina Kannada" || p.district === "Kalaburagi";
      const districtMonsoonMultiplier = isMonsoonVulnerableDistrict
        ? monsoonDemandMultiplier * 1.3
        : monsoonDemandMultiplier;

      const simDays = Math.max(0.2, baseDays / districtMonsoonMultiplier);
      const simOcc = Math.min(1.0, baseOcc + (params.monsoonIntensity - 1.0) * 0.22);
      const simStaff = Math.max(0.2, baseStaff * (1 - params.staffAbsentPercent / 100));

      // Route penalty: if road closure is active or district is flooded
      let routePenalty = 0;
      if (params.roadClosureActive) {
        routePenalty += isMonsoonVulnerableDistrict ? 55 : 30;
      }
      if (params.monsoonIntensity > 2.0) {
        routePenalty += 20;
      }

      const simRes = computeResilienceScore(simDays, simOcc, simStaff, routePenalty);
      simTotalScore += simRes.compositeScore;
      if (simDays <= 7.0) simAtRiskCount++;
      simBedOccSum += simOcc;
      simStaffSum += simStaff;

      // District aggregation
      if (!districtDeltas.has(p.district)) {
        districtDeltas.set(p.district, {
          totalPhcs: 0,
          baselineScoreSum: 0,
          simScoreSum: 0,
          baselineAtRisk: 0,
          simAtRisk: 0,
        });
      }
      const dist = districtDeltas.get(p.district)!;
      dist.totalPhcs++;
      dist.baselineScoreSum += baseRes.compositeScore;
      dist.simScoreSum += simRes.compositeScore;
      if (baseDays <= 7.0) dist.baselineAtRisk++;
      if (simDays <= 7.0) dist.simAtRisk++;
    }

    const baselineScore = Math.round((baselineTotalScore / totalPhcs) * 10) / 10;
    const simulatedScore = Math.round((simTotalScore / totalPhcs) * 10) / 10;

    const districtTable = Array.from(districtDeltas.entries()).map(([name, d]) => {
      const baseAvg = Math.round((d.baselineScoreSum / d.totalPhcs) * 10) / 10;
      const simAvg = Math.round((d.simScoreSum / d.totalPhcs) * 10) / 10;
      return {
        district: name,
        totalPhcs: d.totalPhcs,
        baselineScore: baseAvg,
        simulatedScore: simAvg,
        scoreDelta: Math.round((simAvg - baseAvg) * 10) / 10,
        baselineAtRisk: d.baselineAtRisk,
        simulatedAtRisk: d.simAtRisk,
        atRiskDelta: d.simAtRisk - d.baselineAtRisk,
        primaryThreat:
          params.roadClosureActive && (name === "Dakshina Kannada" || name === "Kalaburagi")
            ? "Ghat Pass Inundation & Severed Highway"
            : params.monsoonIntensity > 1.8
            ? "Epidemic Footfall Surge (Fever & Diarrhea)"
            : params.staffAbsentPercent >= 20
            ? "Healthcare Worker Absenteeism"
            : "Nominal Climate Stress",
      };
    });

    // Simulated emergency redistribution response
    const additionalDeficitUnits = Math.round(
      (simAtRiskCount - baselineAtRiskCount) * 2400 +
        (params.monsoonIntensity - 1.0) * 4500
    );

    const simulatedRedistributionMoves = [
      {
        from: "Belagavi Central Depot",
        to: "Kalaburagi Acute Care Sector",
        medicine: "Oral Rehydration Salts (ORS)",
        quantity: Math.round(2800 * (params.monsoonIntensity / 1.5)),
        distanceKm: 285.0,
        etaMinutes: params.roadClosureActive ? 420 : 280,
        detourApplied: params.roadClosureActive,
        reason: params.roadClosureActive
          ? "Rerouted via NH-48 bypass due to primary NH-50 bridge submergence (+140 min detour)."
          : "Surge buffer transfer to avert acute diarrheal morbidity.",
      },
      {
        from: "Mysuru Regional Store",
        to: "Dakshina Kannada Coastal Cluster",
        medicine: "Artemether-Lumefantrine 80/480mg",
        quantity: Math.round(1200 * (params.monsoonIntensity / 1.5)),
        distanceKm: 254.0,
        etaMinutes: params.roadClosureActive ? 390 : 260,
        detourApplied: params.roadClosureActive,
        reason: params.roadClosureActive
          ? "Shiradi Ghat road closure detected. Dispatched via Madikeri-Sampaje corridor."
          : "Vector-borne fever outbreak buffer replenishment.",
      },
      {
        from: "Bengaluru Logistics Hub",
        to: "Aland & Sedam PHCs",
        medicine: "Paracetamol 500mg",
        quantity: Math.round(3500 * (params.monsoonIntensity / 1.5)),
        distanceKm: 610.0,
        etaMinutes: params.roadClosureActive ? 640 : 510,
        detourApplied: params.roadClosureActive,
        reason: "Direct strategic inter-district stock transfer under simulated emergency protocol.",
      },
    ];

    return NextResponse.json({
      success: true,
      params,
      comparison: {
        baselineScore,
        simulatedScore,
        scoreDelta: Math.round((simulatedScore - baselineScore) * 10) / 10,
        baselineAtRiskCount,
        simulatedAtRiskCount: simAtRiskCount,
        atRiskDelta: simAtRiskCount - baselineAtRiskCount,
        baselineBedOccupancy: Math.round((baselineBedOccSum / totalPhcs) * 100),
        simulatedBedOccupancy: Math.round((simBedOccSum / totalPhcs) * 100),
        baselineStaffAttendance: Math.round((baselineStaffSum / totalPhcs) * 100),
        simulatedStaffAttendance: Math.round((simStaffSum / totalPhcs) * 100),
        logisticsDelayFactor: params.roadClosureActive ? 1.55 : 1.0,
        additionalDeficitUnits: Math.max(0, additionalDeficitUnits),
      },
      districtTable,
      simulatedRedistributionMoves,
    });
  } catch (error) {
    console.error("Simulation run error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
