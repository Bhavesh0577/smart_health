import { getDb } from "@/lib/db";
import { getTablesForNode, simulationStates } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { computeResilienceScore } from "@/lib/services/resilience-service";

export interface DashboardStats {
  nodeId: string;
  district: string;
  totalPhcs: number;
  criticalPhcsCount: number;
  warningPhcsCount: number;
  healthyPhcsCount: number;
  averageBedOccupancyPercent: number;
  totalBeds: number;
  occupiedBeds: number;
  availableOxygenBeds: number;
  staffAttendancePercent: number;
  doctorsPresent: number;
  doctorsRequired: number;
  activeAlertsCount: number;
  criticalAlertsCount: number;
  averageResilienceScore: number;
  districtBreakdown: Array<{
    district: string;
    totalPhcs: number;
    atRiskPhcs: number;
    avgBedOccupancy: number;
    avgStaffAttendance: number;
    avgDaysCover: number;
    resilienceScore: number;
  }>;
  recentTrends: Array<{
    date: string;
    feverFootfall: number;
    diarrheaFootfall: number;
    respiratoryFootfall: number;
    generalFootfall: number;
    orsConsumption: number;
    antimalarialConsumption: number;
  }>;
  criticalStockouts: Array<{
    phcId: string;
    phcName: string;
    district: string;
    medicineName: string;
    currentQty: number;
    daysOfCover: number;
    threshold: number;
  }>;
}

export async function getDashboardStats(nodeId = "node_in_karnataka", filterDistrict?: string): Promise<DashboardStats> {
  const db = getDb();
  const tables = getTablesForNode(nodeId);

  // 1. Fetch PHCs
  const phcs = await db.select().from(tables.phcs);
  const filteredPhcs = filterDistrict && filterDistrict !== "All Districts"
    ? phcs.filter((p: any) => p.district === filterDistrict)
    : phcs;

  const totalPhcs = filteredPhcs.length || 1;
  const phcIds = new Set(filteredPhcs.map((p: any) => p.id));

  // 2. Fetch latest stock levels for filtered PHCs
  // We grab the latest stock snapshot for each phc and medicine
  const allStock = await db
    .select()
    .from(tables.stockLevels)
    .orderBy(desc(tables.stockLevels.time))
    .limit(filteredPhcs.length * 7 * 2);

  // Map to get latest record per phcId + medicineId
  const latestStockMap = new Map<string, any>();
  for (const s of allStock) {
    if (!phcIds.has(s.phcId)) continue;
    const key = `${s.phcId}_${s.medicineId}`;
    if (!latestStockMap.has(key)) {
      latestStockMap.set(key, s);
    }
  }

  // Medicines lookup
  const medicines = await db.select().from(tables.medicines);
  const medMap = new Map(medicines.map((m: any) => [m.id, m]));

  // Assess PHC risk by days of cover
  const phcMinCover = new Map<string, number>();
  const criticalStockouts: DashboardStats["criticalStockouts"] = [];

  for (const [key, stock] of latestStockMap.entries()) {
    const prevMin = phcMinCover.get(stock.phcId) ?? 999;
    if (stock.daysOfCover < prevMin) {
      phcMinCover.set(stock.phcId, stock.daysOfCover);
    }

    if (stock.daysOfCover <= 3.5) {
      const phc = filteredPhcs.find((p: any) => p.id === stock.phcId);
      const med = medMap.get(stock.medicineId) as any;
      if (phc && med) {
        criticalStockouts.push({
          phcId: phc.id,
          phcName: phc.name,
          district: phc.district,
          medicineName: med.name,
          currentQty: stock.qty,
          daysOfCover: stock.daysOfCover,
          threshold: stock.reorderThreshold,
        });
      }
    }
  }

  let criticalPhcsCount = 0;
  let warningPhcsCount = 0;
  let healthyPhcsCount = 0;

  for (const phc of filteredPhcs) {
    const minDays = phcMinCover.get(phc.id) ?? 20;
    if (minDays <= 3.0) {
      criticalPhcsCount++;
    } else if (minDays <= 7.0) {
      warningPhcsCount++;
    } else {
      healthyPhcsCount++;
    }
  }

  // 3. Latest Bed Status
  const bedStatuses = await db
    .select()
    .from(tables.bedStatus)
    .orderBy(desc(tables.bedStatus.time))
    .limit(filteredPhcs.length * 2);

  const latestBedMap = new Map<string, any>();
  for (const b of bedStatuses) {
    if (!phcIds.has(b.phcId)) continue;
    if (!latestBedMap.has(b.phcId)) {
      latestBedMap.set(b.phcId, b);
    }
  }

  let totalBeds = 0;
  let occupiedBeds = 0;
  let availableOxygenBeds = 0;
  for (const b of latestBedMap.values()) {
    totalBeds += b.totalBeds;
    occupiedBeds += b.occupiedBeds;
    availableOxygenBeds += b.availableOxygenBeds;
  }
  const averageBedOccupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // 4. Latest Staff Attendance
  const staffAttendances = await db
    .select()
    .from(tables.staffAttendance)
    .orderBy(desc(tables.staffAttendance.time))
    .limit(filteredPhcs.length * 2);

  const latestStaffMap = new Map<string, any>();
  for (const s of staffAttendances) {
    if (!phcIds.has(s.phcId)) continue;
    if (!latestStaffMap.has(s.phcId)) {
      latestStaffMap.set(s.phcId, s);
    }
  }

  let doctorsPresent = 0;
  let doctorsRequired = 0;
  let totalOnDuty = 0;
  let totalStaffRequired = 0;
  for (const s of latestStaffMap.values()) {
    doctorsPresent += s.doctorsPresent;
    doctorsRequired += 2;
    totalOnDuty += s.staffOnDuty;
    totalStaffRequired += s.requiredStaff;
  }
  const staffAttendancePercent = totalStaffRequired > 0 ? Math.round((totalOnDuty / totalStaffRequired) * 100) : 0;

  // 5. Active Alerts
  const alerts = await db
    .select()
    .from(tables.alerts)
    .where(eq(tables.alerts.status, "active"));

  const filteredAlerts = filterDistrict && filterDistrict !== "All Districts"
    ? alerts.filter((a: any) => a.district === filterDistrict)
    : alerts;

  const activeAlertsCount = filteredAlerts.length;
  const criticalAlertsCount = filteredAlerts.filter((a: any) => a.severity === "critical").length;

  // 6. Compute Dynamic Resilience Scores per PHC
  for (const p of filteredPhcs) {
    const b = latestBedMap.get(p.id);
    const s = latestStaffMap.get(p.id);
    const days = phcMinCover.get(p.id) ?? 20;
    const occ = b && b.totalBeds > 0 ? b.occupiedBeds / b.totalBeds : 0.65;
    const att = s && s.requiredStaff > 0 ? s.staffOnDuty / s.requiredStaff : 0.85;
    p.resilienceScore = computeResilienceScore(days, occ, att, 0).compositeScore;
  }

  const totalScore = filteredPhcs.reduce((acc: number, p: any) => acc + (p.resilienceScore || 75), 0);
  const averageResilienceScore = Math.round((totalScore / totalPhcs) * 10) / 10;

  // 7. District Breakdown
  const districtMap = new Map<string, { phcs: any[]; bedsTotal: number; bedsOcc: number; staffOnDuty: number; staffReq: number; coverSum: number }>();
  for (const p of filteredPhcs) {
    if (!districtMap.has(p.district)) {
      districtMap.set(p.district, { phcs: [], bedsTotal: 0, bedsOcc: 0, staffOnDuty: 0, staffReq: 0, coverSum: 0 });
    }
    const d = districtMap.get(p.district)!;
    d.phcs.push(p);

    const b = latestBedMap.get(p.id);
    if (b) {
      d.bedsTotal += b.totalBeds;
      d.bedsOcc += b.occupiedBeds;
    }

    const s = latestStaffMap.get(p.id);
    if (s) {
      d.staffOnDuty += s.staffOnDuty;
      d.staffReq += s.requiredStaff;
    }

    d.coverSum += phcMinCover.get(p.id) ?? 20;
  }

  const districtBreakdown: DashboardStats["districtBreakdown"] = [];
  for (const [distName, data] of districtMap.entries()) {
    const distCount = data.phcs.length || 1;
    const atRisk = data.phcs.filter((p) => (phcMinCover.get(p.id) ?? 20) <= 7.0).length;
    const avgScore = data.phcs.reduce((acc, p) => acc + p.resilienceScore, 0) / distCount;

    districtBreakdown.push({
      district: distName,
      totalPhcs: distCount,
      atRiskPhcs: atRisk,
      avgBedOccupancy: data.bedsTotal > 0 ? Math.round((data.bedsOcc / data.bedsTotal) * 100) : 0,
      avgStaffAttendance: data.staffReq > 0 ? Math.round((data.staffOnDuty / data.staffReq) * 100) : 0,
      avgDaysCover: Math.round((data.coverSum / distCount) * 10) / 10,
      resilienceScore: Math.round(avgScore * 10) / 10,
    });
  }

  // 8. 14-day Longitudinal Trends (Footfall aggregated by day)
  const recentFootfalls = await db
    .select()
    .from(tables.patientFootfall)
    .orderBy(desc(tables.patientFootfall.time))
    .limit(filteredPhcs.length * 6 * 14);

  const dayAggMap = new Map<string, { fever: number; diarrhea: number; respiratory: number; general: number }>();
  for (const f of recentFootfalls) {
    if (!phcIds.has(f.phcId)) continue;
    const dayStr = new Date(f.time).toISOString().substring(0, 10);
    if (!dayAggMap.has(dayStr)) {
      dayAggMap.set(dayStr, { fever: 0, diarrhea: 0, respiratory: 0, general: 0 });
    }
    const agg = dayAggMap.get(dayStr)!;
    if (f.symptomCategory === "fever") agg.fever += f.opdCount;
    else if (f.symptomCategory === "diarrhea") agg.diarrhea += f.opdCount;
    else if (f.symptomCategory === "respiratory") agg.respiratory += f.opdCount;
    else agg.general += f.opdCount;
  }

  const recentTrends: DashboardStats["recentTrends"] = Array.from(dayAggMap.entries())
    .map(([date, counts]) => ({
      date,
      feverFootfall: counts.fever,
      diarrheaFootfall: counts.diarrhea,
      respiratoryFootfall: counts.respiratory,
      generalFootfall: counts.general,
      orsConsumption: Math.round(counts.diarrhea * 1.8),
      antimalarialConsumption: Math.round(counts.fever * 0.45),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  return {
    nodeId,
    district: filterDistrict || "All Districts",
    totalPhcs,
    criticalPhcsCount,
    warningPhcsCount,
    healthyPhcsCount,
    averageBedOccupancyPercent,
    totalBeds,
    occupiedBeds,
    availableOxygenBeds,
    staffAttendancePercent,
    doctorsPresent,
    doctorsRequired,
    activeAlertsCount,
    criticalAlertsCount,
    averageResilienceScore,
    districtBreakdown,
    recentTrends,
    criticalStockouts: criticalStockouts.slice(0, 10),
  };
}
