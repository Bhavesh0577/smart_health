import { getDb } from "@/lib/db";
import { getNodeTables, simulationStates } from "@/lib/db/schema";
import { eq, like, desc } from "drizzle-orm";

export async function injectEmergencyOutbreakCluster(node = "node_in_karnataka") {
  const db = getDb();
  const tables = getNodeTables(node);
  const now = new Date();

  // 1. Update simulation state table
  await db
    .insert(simulationStates)
    .values({
      id: "active_state",
      isEmergencyActive: true,
      roadClosureActive: true,
      staffAbsentPercent: 20,
      monsoonIntensity: 2.8,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: simulationStates.id,
      set: {
        isEmergencyActive: true,
        roadClosureActive: true,
        staffAbsentPercent: 20,
        monsoonIntensity: 2.8,
        updatedAt: now,
      },
    });

  // 2. Identify the Kalaburagi cluster PHCs
  const phcs = await db.select().from(tables.phcs);
  const clusterPhcs = phcs.filter((p: any) =>
    p.district === "Kalaburagi" || p.name.includes("Aland") || p.name.includes("Sedam") || p.name.includes("Chincholi")
  ).slice(0, 4);

  const fallbackCluster = clusterPhcs.length > 0 ? clusterPhcs : phcs.slice(0, 4);

  // 3. Insert outbreak footfall surge and depleted stock levels
  for (const phc of fallbackCluster) {
    // Footfall surge: Acute fever & diarrhea spike
    await db.insert(tables.patientFootfall).values([
      {
        time: now,
        phcId: phc.id,
        opdCount: 145,
        symptomCategory: "fever",
        dataOrigin: "simulated",
        sourceDataset: "emergency_outbreak_simulator",
      },
      {
        time: now,
        phcId: phc.id,
        opdCount: 95,
        symptomCategory: "diarrhea",
        dataOrigin: "simulated",
        sourceDataset: "emergency_outbreak_simulator",
      },
      {
        time: now,
        phcId: phc.id,
        opdCount: 40,
        symptomCategory: "respiratory",
        dataOrigin: "simulated",
        sourceDataset: "emergency_outbreak_simulator",
      },
    ]);

    // Bed saturation: 95-100% capacity
    await db.insert(tables.bedStatus).values({
      time: now,
      phcId: phc.id,
      totalBeds: phc.bedCapacity || 12,
      occupiedBeds: phc.bedCapacity || 12,
      criticalCareBeds: 2,
      availableOxygenBeds: 0,
      dataOrigin: "simulated",
      sourceDataset: "emergency_outbreak_simulator",
    });

    // Depleted stock levels for critical anti-epidemic medicines
    const medicines = await db.select().from(tables.medicines);
    for (const med of medicines) {
      const isCriticalMed = ["MED_PARA", "MED_ORS", "MED_AZI", "MED_AL"].includes(med.id);
      const remainingQty = isCriticalMed ? Math.floor(Math.random() * 20) + 5 : 80;
      const daysCover = isCriticalMed ? 0.6 : 3.5;

      await db.insert(tables.stockLevels).values({
        time: now,
        phcId: phc.id,
        medicineId: med.id,
        qty: remainingQty,
        reorderThreshold: med.reorderThreshold,
        expiryDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        daysOfCover: daysCover,
        source: "emergency_rapid_audit",
        dataOrigin: "simulated",
        sourceDataset: "emergency_outbreak_simulator",
      });
    }

    // Lower facility resilience score in database
    await db
      .update(tables.phcs)
      .set({ resilienceScore: 28.5 })
      .where(eq(tables.phcs.id, phc.id));
  }

  // 4. Generate high-severity emergency alerts
  const emergencyAlerts = [
    {
      id: `alt_emg_kalaburagi_cluster_${Date.now()}_1`,
      phcId: fallbackCluster[0]?.id || "in_karnataka_kalaburagi_1",
      district: fallbackCluster[0]?.district || "Kalaburagi",
      severity: "critical" as const,
      alertType: "epidemic_spike" as const,
      title: "OUTBREAK CLUSTER: Acute Vector-Borne Fever Epidemic",
      message: "CUSUM threshold exceeded by 420% across Kalaburagi PHC cluster (Aland, Sedam, Chincholi). Immediate district containment protocols active.",
      status: "active" as const,
    },
    {
      id: `alt_emg_kalaburagi_cluster_${Date.now()}_2`,
      phcId: fallbackCluster[0]?.id || "in_karnataka_kalaburagi_1",
      district: fallbackCluster[0]?.district || "Kalaburagi",
      severity: "critical" as const,
      alertType: "stockout_risk" as const,
      title: "CRITICAL STOCKOUT: Paracetamol & ORS Buffer Depleted (<12h cover)",
      message: "Essential analgesic and rehydration stock below emergency reserve. Automated cross-district re-routing triggered from Belagavi depot.",
      status: "active" as const,
    },
    {
      id: `alt_emg_kalaburagi_cluster_${Date.now()}_3`,
      phcId: fallbackCluster[1]?.id || fallbackCluster[0]?.id,
      district: fallbackCluster[1]?.district || "Kalaburagi",
      severity: "critical" as const,
      alertType: "bed_saturation" as const,
      title: "BED SATURATION: Inpatient Occupancy at 100%",
      message: "All general and oxygenated beds occupied in cluster epicenter. Urgent need for roving triage tent and nurse reassignment.",
      status: "active" as const,
    },
    {
      id: `alt_emg_kalaburagi_cluster_${Date.now()}_4`,
      phcId: fallbackCluster[2]?.id || fallbackCluster[0]?.id,
      district: fallbackCluster[2]?.district || "Kalaburagi",
      severity: "warning" as const,
      alertType: "staff_shortage" as const,
      title: "STAFF STRESS: 20% Absenteeism with 3.5x Patient Surge",
      message: "Cluster staff attendance strained by illness. State medical reserve deployment requested.",
      status: "active" as const,
    },
  ];

  for (const alt of emergencyAlerts) {
    await db.insert(tables.alerts).values({
      id: alt.id,
      time: now,
      phcId: alt.phcId,
      district: alt.district,
      severity: alt.severity,
      alertType: alt.alertType,
      title: alt.title,
      message: alt.message,
      status: alt.status,
      dataOrigin: "derived",
      sourceDataset: "cusum_detector",
    });
  }

  // 5. Generate Emergency Redistribution Plan (Belagavi -> Kalaburagi)
  const donorPhc = phcs.find((p: any) => p.district === "Belagavi" || p.name.includes("Gokak")) || phcs[10];
  const emergencyMoves = [
    {
      fromPhcId: donorPhc?.id || "in_karnataka_belagavi_1",
      fromPhcName: donorPhc?.name || "PHC Gokak (Belagavi Depot)",
      toPhcId: fallbackCluster[0]?.id || "in_karnataka_kalaburagi_1",
      toPhcName: fallbackCluster[0]?.name || "PHC Aland",
      medicineId: "MED_PARA",
      medicineName: "Paracetamol 500mg",
      quantity: 2500,
      unit: "Tablets",
      distanceKm: 285.4,
      etaMinutes: 280,
      expiryDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      urgencyScore: 99,
      reason: "Emergency outbreak containment transfer: high-priority cross-district replenishment from Belagavi buffer stock.",
    },
    {
      fromPhcId: donorPhc?.id || "in_karnataka_belagavi_1",
      fromPhcName: donorPhc?.name || "PHC Gokak (Belagavi Depot)",
      toPhcId: fallbackCluster[1]?.id || fallbackCluster[0]?.id,
      toPhcName: fallbackCluster[1]?.name || "PHC Sedam",
      medicineId: "MED_ORS",
      medicineName: "Oral Rehydration Salts (ORS)",
      quantity: 1800,
      unit: "Sachets",
      distanceKm: 298.0,
      etaMinutes: 310,
      expiryDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      urgencyScore: 96,
      reason: "Acute diarrheal surge relief: moves near-expiry surplus ORS to rapidly prevent dehydration mortality.",
    },
    {
      fromPhcId: donorPhc?.id || "in_karnataka_belagavi_1",
      fromPhcName: donorPhc?.name || "PHC Gokak (Belagavi Depot)",
      toPhcId: fallbackCluster[0]?.id || "in_karnataka_kalaburagi_1",
      toPhcName: fallbackCluster[0]?.name || "PHC Aland",
      medicineId: "MED_AL",
      medicineName: "Artemether-Lumefantrine 80/480mg",
      quantity: 600,
      unit: "Tablets",
      distanceKm: 285.4,
      etaMinutes: 280,
      expiryDate: new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      urgencyScore: 94,
      reason: "Vector transmission cluster containment: fast-tracked antimalarial delivery under emergency courier routing.",
    },
  ];

  await db.insert(tables.redistributionPlans).values({
    id: `plan_emg_${Date.now()}`,
    createdAt: now,
    status: "recommended",
    movesJson: emergencyMoves,
    totalCostEstimate: 4250.0,
    explanation: "EMERGENCY PROTOCOL ACTIVATED: High-speed cross-district transfer dispatched from Belagavi central depot to contain the Kalaburagi febrile epidemic surge.",
    triggeredBy: "emergency_cluster_pipeline",
    dataOrigin: "derived",
    sourceDataset: "or_tools_optimizer",
  });

  // 6. Insert Emergency Copilot Briefing
  await db.insert(tables.briefings).values({
    id: `brief_emg_${Date.now()}`,
    date: now.toISOString().split("T")[0],
    district: "Kalaburagi",
    contentMarkdown: `### 🚨 EMERGENCY SITUATION REPORT: Kalaburagi Outbreak Cluster\n\n**Severity Level: CRITICAL (Red Tier)**\n\n**Epidemiological Summary:**\n- **Epidemic Spike:** 4 PHCs in Kalaburagi (Aland, Sedam, Chincholi, Afzalpur) report a synchronized 420% surge in acute febrile illness and dehydration.\n- **Inventory Status:** Paracetamol and ORS inventory exhausted to under 12 hours of cover.\n- **Bed Headroom:** 100% bed saturation; zero critical care beds available.\n\n**AI Redistribution Countermeasure:**\n- Dispatched Emergency Plan moving **2,500 Paracetamol tablets**, **1,800 ORS sachets**, and **600 Antimalarials** from Belagavi.\n- Western transport corridor prioritized to circumvent active monsoon road bottlenecks.\n\n**Required Executive Actions:**\n1. Approve emergency transport clearances immediately.\n2. Reassign 4 roving medical officers from Mysore to northern sector.\n3. Deploy field mobile chlorination & vector spray teams.`,
    generatedBy: "gemini-copilot-emergency",
    dataOrigin: "derived",
    sourceDataset: "gemini_copilot",
    keyActionsJson: [
      "Approve Emergency Plan immediately",
      "Dispatch Roving Medical Units to Aland PHC",
      "Deploy Vector Control Teams to Kalaburagi Cluster",
    ],
  });

  return {
    success: true,
    clusterPhcs: fallbackCluster.map((p: any) => p.name),
    affectedDistrict: "Kalaburagi",
    movesCount: emergencyMoves.length,
    alertsCount: emergencyAlerts.length,
  };
}

export async function resetEmergencyOutbreakCluster(node = "node_in_karnataka") {
  const db = getDb();
  const tables = getNodeTables(node);

  // 1. Reset simulation states table
  await db
    .insert(simulationStates)
    .values({
      id: "active_state",
      isEmergencyActive: false,
      roadClosureActive: false,
      staffAbsentPercent: 0,
      monsoonIntensity: 1.0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: simulationStates.id,
      set: {
        isEmergencyActive: false,
        roadClosureActive: false,
        staffAbsentPercent: 0,
        monsoonIntensity: 1.0,
        updatedAt: new Date(),
      },
    });

  // 2. Mark emergency alerts as resolved
  const allAlerts = await db.select().from(tables.alerts);
  for (const alt of allAlerts) {
    if (alt.id.startsWith("alt_emg_") || alt.title.includes("OUTBREAK") || alt.title.includes("CRITICAL STOCKOUT")) {
      await db
        .update(tables.alerts)
        .set({ status: "resolved" })
        .where(eq(tables.alerts.id, alt.id));
    }
  }

  // 3. Restore PHC resilience scores to healthy baseline
  const phcs = await db.select().from(tables.phcs);
  for (const p of phcs) {
    if (p.resilienceScore < 50) {
      await db
        .update(tables.phcs)
        .set({ resilienceScore: 78.5 })
        .where(eq(tables.phcs.id, p.id));
    }
  }

  return { success: true };
}
