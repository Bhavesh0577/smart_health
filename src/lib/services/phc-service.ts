import { getDb } from "@/lib/db";
import { getTablesForNode } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { computeResilienceScore } from "@/lib/services/resilience-service";

export interface PhcSummary {
  id: string;
  name: string;
  district: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  type: string;
  bedCapacity: number;
  targetPopulation: number;
  resilienceScore: number;
  occupiedBeds: number;
  bedOccupancyPercent: number;
  availableOxygenBeds: number;
  staffAttendancePercent: number;
  doctorsPresent: number;
  minDaysOfCover: number;
  riskLevel: "critical" | "warning" | "healthy";
  activeAlertsCount: number;
  lastSync: string;
}

export interface PhcDetail extends PhcSummary {
  stockInventory: Array<{
    id: number;
    medicineId: string;
    medicineCode: string;
    medicineName: string;
    category: string;
    unit: string;
    qty: number;
    reorderThreshold: number;
    daysOfCover: number;
    expiryDate: string;
    isNearExpiry: boolean;
    source: string;
  }>;
  bedHistory: Array<{
    date: string;
    totalBeds: number;
    occupiedBeds: number;
    criticalCareBeds: number;
    availableOxygenBeds: number;
  }>;
  staffHistory: Array<{
    date: string;
    doctorsPresent: number;
    nursesPresent: number;
    pharmacistsPresent: number;
    staffOnDuty: number;
    requiredStaff: number;
  }>;
  footfallHistory: Array<{
    date: string;
    fever: number;
    diarrhea: number;
    respiratory: number;
    general: number;
    total: number;
  }>;
  activeAlerts: Array<{
    id: string;
    time: string;
    severity: string;
    alertType: string;
    title: string;
    message: string;
  }>;
}

export async function getAllPhcs(nodeId = "node_in_karnataka", filterDistrict?: string): Promise<PhcSummary[]> {
  const db = getDb();
  const tables = getTablesForNode(nodeId);

  const phcs = await db.select().from(tables.phcs);
  const filtered = filterDistrict && filterDistrict !== "All Districts"
    ? phcs.filter((p: any) => p.district === filterDistrict)
    : phcs;

  // Latest stock for each
  const stocks = await db
    .select()
    .from(tables.stockLevels)
    .orderBy(desc(tables.stockLevels.time))
    .limit(filtered.length * 7 * 2);

  const minCoverMap = new Map<string, number>();
  for (const s of stocks) {
    const prev = minCoverMap.get(s.phcId) ?? 999;
    if (s.daysOfCover < prev) {
      minCoverMap.set(s.phcId, s.daysOfCover);
    }
  }

  // Latest beds
  const beds = await db
    .select()
    .from(tables.bedStatus)
    .orderBy(desc(tables.bedStatus.time))
    .limit(filtered.length * 2);

  const bedMap = new Map<string, any>();
  for (const b of beds) {
    if (!bedMap.has(b.phcId)) bedMap.set(b.phcId, b);
  }

  // Latest staff
  const staff = await db
    .select()
    .from(tables.staffAttendance)
    .orderBy(desc(tables.staffAttendance.time))
    .limit(filtered.length * 2);

  const staffMap = new Map<string, any>();
  for (const s of staff) {
    if (!staffMap.has(s.phcId)) staffMap.set(s.phcId, s);
  }

  // Active alerts
  const alerts = await db
    .select()
    .from(tables.alerts)
    .where(eq(tables.alerts.status, "active"));

  const alertCountMap = new Map<string, number>();
  for (const a of alerts) {
    alertCountMap.set(a.phcId, (alertCountMap.get(a.phcId) || 0) + 1);
  }

  return filtered.map((p: any) => {
    const minDays = minCoverMap.get(p.id) ?? 25.0;
    const b = bedMap.get(p.id) || { occupiedBeds: Math.round(p.bedCapacity * 0.7), availableOxygenBeds: 2 };
    const s = staffMap.get(p.id) || { doctorsPresent: 2, staffOnDuty: 6, requiredStaff: 7 };
    const bedOccPercent = Math.round((b.occupiedBeds / p.bedCapacity) * 100);
    const staffAttPercent = Math.round((s.staffOnDuty / (s.requiredStaff || 7)) * 100);

    let riskLevel: PhcSummary["riskLevel"] = "healthy";
    if (minDays <= 3.0 || (alertCountMap.get(p.id) || 0) > 1) {
      riskLevel = "critical";
    } else if (minDays <= 7.0 || bedOccPercent > 85) {
      riskLevel = "warning";
    }

    const dynamicResilience = computeResilienceScore(
      minDays,
      bedOccPercent / 100,
      staffAttPercent / 100,
      0
    ).compositeScore;

    return {
      id: p.id,
      name: p.name,
      district: p.district,
      state: p.state,
      country: p.country,
      lat: p.lat,
      lng: p.lng,
      type: p.type,
      bedCapacity: p.bedCapacity,
      targetPopulation: p.targetPopulation,
      resilienceScore: dynamicResilience,
      occupiedBeds: b.occupiedBeds,
      bedOccupancyPercent: bedOccPercent,
      availableOxygenBeds: b.availableOxygenBeds,
      staffAttendancePercent: staffAttPercent,
      doctorsPresent: s.doctorsPresent,
      minDaysOfCover: minDays,
      riskLevel,
      activeAlertsCount: alertCountMap.get(p.id) || 0,
      lastSync: "Just now (Live)",
    };
  });
}

export async function getPhcDetail(nodeId = "node_in_karnataka", phcId: string): Promise<PhcDetail | null> {
  const db = getDb();
  const tables = getTablesForNode(nodeId);

  const phcRes = await db.select().from(tables.phcs).where(eq(tables.phcs.id, phcId)).limit(1);
  if (!phcRes.length) return null;
  const p = phcRes[0];

  // Medicines lookup
  const medicines = await db.select().from(tables.medicines);
  const medMap = new Map(medicines.map((m: any) => [m.id, m]));

  // Stock inventory snapshot
  const stockRows = await db
    .select()
    .from(tables.stockLevels)
    .where(eq(tables.stockLevels.phcId, phcId))
    .orderBy(desc(tables.stockLevels.time))
    .limit(20);

  const latestStockMap = new Map<string, any>();
  for (const s of stockRows) {
    if (!latestStockMap.has(s.medicineId)) {
      latestStockMap.set(s.medicineId, s);
    }
  }

  const nowMs = Date.now();
  let minDaysOfCover = 999;

  const stockInventory = Array.from(latestStockMap.values()).map((s: any) => {
    const med = (medMap.get(s.medicineId) as any) || { code: "MED", name: "Medicine", category: "General", unit: "Units" };
    if (s.daysOfCover < minDaysOfCover) {
      minDaysOfCover = s.daysOfCover;
    }
    const expiryTime = new Date(s.expiryDate).getTime();
    const daysUntilExpiry = Math.round((expiryTime - nowMs) / (24 * 60 * 60 * 1000));
    const isNearExpiry = daysUntilExpiry <= 45;

    return {
      id: s.id,
      medicineId: s.medicineId,
      medicineCode: med.code,
      medicineName: med.name,
      category: med.category,
      unit: med.unit,
      qty: s.qty,
      reorderThreshold: s.reorderThreshold,
      daysOfCover: s.daysOfCover,
      expiryDate: new Date(s.expiryDate).toISOString().substring(0, 10),
      isNearExpiry,
      source: s.source,
    };
  });

  if (minDaysOfCover === 999) minDaysOfCover = 25.0;

  // Bed history (last 30 days)
  const bedRows = await db
    .select()
    .from(tables.bedStatus)
    .where(eq(tables.bedStatus.phcId, phcId))
    .orderBy(desc(tables.bedStatus.time))
    .limit(30);

  const bedHistory = bedRows.map((b: any) => ({
    date: new Date(b.time).toISOString().substring(0, 10),
    totalBeds: b.totalBeds,
    occupiedBeds: b.occupiedBeds,
    criticalCareBeds: b.criticalCareBeds,
    availableOxygenBeds: b.availableOxygenBeds,
  })).reverse();

  const latestBed = bedRows[0] || { occupiedBeds: Math.round(p.bedCapacity * 0.7), availableOxygenBeds: 2 };
  const bedOccPercent = Math.round((latestBed.occupiedBeds / p.bedCapacity) * 100);

  // Staff history (last 30 days)
  const staffRows = await db
    .select()
    .from(tables.staffAttendance)
    .where(eq(tables.staffAttendance.phcId, phcId))
    .orderBy(desc(tables.staffAttendance.time))
    .limit(30);

  const staffHistory = staffRows.map((s: any) => ({
    date: new Date(s.time).toISOString().substring(0, 10),
    doctorsPresent: s.doctorsPresent,
    nursesPresent: s.nursesPresent,
    pharmacistsPresent: s.pharmacistsPresent,
    staffOnDuty: s.staffOnDuty,
    requiredStaff: s.requiredStaff,
  })).reverse();

  const latestStaff = staffRows[0] || { doctorsPresent: 2, staffOnDuty: 6, requiredStaff: 7 };
  const staffAttPercent = Math.round((latestStaff.staffOnDuty / (latestStaff.requiredStaff || 7)) * 100);

  // Footfall history (last 30 days aggregated)
  const footfallRows = await db
    .select()
    .from(tables.patientFootfall)
    .where(eq(tables.patientFootfall.phcId, phcId))
    .orderBy(desc(tables.patientFootfall.time))
    .limit(180);

  const footfallDayMap = new Map<string, { fever: number; diarrhea: number; respiratory: number; general: number }>();
  for (const f of footfallRows) {
    const dStr = new Date(f.time).toISOString().substring(0, 10);
    if (!footfallDayMap.has(dStr)) {
      footfallDayMap.set(dStr, { fever: 0, diarrhea: 0, respiratory: 0, general: 0 });
    }
    const day = footfallDayMap.get(dStr)!;
    if (f.symptomCategory === "fever") day.fever += f.opdCount;
    else if (f.symptomCategory === "diarrhea") day.diarrhea += f.opdCount;
    else if (f.symptomCategory === "respiratory") day.respiratory += f.opdCount;
    else day.general += f.opdCount;
  }

  const footfallHistory = Array.from(footfallDayMap.entries()).map(([date, counts]) => ({
    date,
    fever: counts.fever,
    diarrhea: counts.diarrhea,
    respiratory: counts.respiratory,
    general: counts.general,
    total: counts.fever + counts.diarrhea + counts.respiratory + counts.general,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // Active alerts
  const alertRows = await db
    .select()
    .from(tables.alerts)
    .where(eq(tables.alerts.phcId, phcId));

  const activeAlerts = alertRows
    .filter((a: any) => a.status === "active")
    .map((a: any) => ({
      id: a.id,
      time: new Date(a.time).toLocaleDateString(),
      severity: a.severity,
      alertType: a.alertType,
      title: a.title,
      message: a.message,
    }));

  let riskLevel: PhcSummary["riskLevel"] = "healthy";
  if (minDaysOfCover <= 3.0 || activeAlerts.some((a: any) => a.severity === "critical")) {
    riskLevel = "critical";
  } else if (minDaysOfCover <= 7.0 || bedOccPercent > 85) {
    riskLevel = "warning";
  }

  const dynamicResilience = computeResilienceScore(
    minDaysOfCover,
    bedOccPercent / 100,
    staffAttPercent / 100,
    0
  ).compositeScore;

  return {
    id: p.id,
    name: p.name,
    district: p.district,
    state: p.state,
    country: p.country,
    lat: p.lat,
    lng: p.lng,
    type: p.type,
    bedCapacity: p.bedCapacity,
    targetPopulation: p.targetPopulation,
    resilienceScore: dynamicResilience,
    occupiedBeds: latestBed.occupiedBeds,
    bedOccupancyPercent: bedOccPercent,
    availableOxygenBeds: latestBed.availableOxygenBeds,
    staffAttendancePercent: staffAttPercent,
    doctorsPresent: latestStaff.doctorsPresent,
    minDaysOfCover,
    riskLevel,
    activeAlertsCount: activeAlerts.length,
    lastSync: "Real-time sync",
    stockInventory,
    bedHistory,
    staffHistory,
    footfallHistory,
    activeAlerts,
  };
}
