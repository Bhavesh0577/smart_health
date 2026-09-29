import { pgSchema, pgTable, text, timestamp, integer, real, boolean, jsonb, serial } from "drizzle-orm/pg-core";

export const NODE_SCHEMAS = {
  IN_KARNATAKA: "node_in_karnataka",
  BR_BAHIA: "node_br_bahia",
  ZA_KZN: "node_za_kzn",
} as const;

export type NodeSchemaKey = keyof typeof NODE_SCHEMAS;
export type NodeSchemaName = typeof NODE_SCHEMAS[NodeSchemaKey];

export const nodeInKarnataka = pgSchema("node_in_karnataka");
export const nodeBrBahia = pgSchema("node_br_bahia");
export const nodeZaKzn = pgSchema("node_za_kzn");

export function createNodeTables(schema: ReturnType<typeof pgSchema>) {
  const phcs = schema.table("phcs", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    district: text("district").notNull(),
    state: text("state").notNull(),
    country: text("country").notNull(),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    type: text("type").notNull().default("24x7_PHC"), // 24x7_PHC, Primary_Health_Centre, CHC
    bedCapacity: integer("bed_capacity").notNull().default(10),
    targetPopulation: integer("target_population").notNull().default(30000),
    resilienceScore: real("resilience_score").notNull().default(75.0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  const medicines = schema.table("medicines", {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    unit: text("unit").notNull(), // tablets, vials, sachet
    unitCost: real("unit_cost").notNull(),
    reorderThreshold: integer("reorder_threshold").notNull(),
    shelfLifeDays: integer("shelf_life_days").notNull().default(730),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  const stockLevels = schema.table("stock_levels", {
    id: serial("id").primaryKey(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    phcId: text("phc_id").notNull().references(() => phcs.id),
    medicineId: text("medicine_id").notNull().references(() => medicines.id),
    qty: integer("qty").notNull(),
    reorderThreshold: integer("reorder_threshold").notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    daysOfCover: real("days_of_cover").notNull().default(30),
    source: text("source").notNull().default("system_sync"), // system_sync, manual_entry, emergency_dispatch
  });

  const bedStatus = schema.table("bed_status", {
    id: serial("id").primaryKey(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    phcId: text("phc_id").notNull().references(() => phcs.id),
    totalBeds: integer("total_beds").notNull(),
    occupiedBeds: integer("occupied_beds").notNull(),
    criticalCareBeds: integer("critical_care_beds").notNull().default(2),
    availableOxygenBeds: integer("available_oxygen_beds").notNull().default(4),
  });

  const staffAttendance = schema.table("staff_attendance", {
    id: serial("id").primaryKey(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    phcId: text("phc_id").notNull().references(() => phcs.id),
    doctorsPresent: integer("doctors_present").notNull(),
    nursesPresent: integer("nurses_present").notNull(),
    pharmacistsPresent: integer("pharmacists_present").notNull(),
    staffOnDuty: integer("staff_on_duty").notNull(),
    requiredStaff: integer("required_staff").notNull(),
  });

  const patientFootfall = schema.table("patient_footfall", {
    id: serial("id").primaryKey(),
    time: timestamp("time", { withTimezone: true }).notNull(),
    phcId: text("phc_id").notNull().references(() => phcs.id),
    opdCount: integer("opd_count").notNull(),
    symptomCategory: text("symptom_category").notNull(), // fever, respiratory, diarrhea, maternal, trauma, general
  });

  const redistributionPlans = schema.table("redistribution_plans", {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    status: text("status").notNull().default("recommended"), // recommended, approved, in_transit, completed, rejected
    movesJson: jsonb("moves_json").notNull(),
    totalCostEstimate: real("total_cost_estimate").notNull(),
    explanation: text("explanation").notNull(),
    triggeredBy: text("triggered_by").notNull().default("optimizer"), // optimizer, emergency_mode, manual_request
  });

  const alerts = schema.table("alerts", {
    id: text("id").primaryKey(),
    time: timestamp("time", { withTimezone: true }).defaultNow().notNull(),
    phcId: text("phc_id").notNull().references(() => phcs.id),
    district: text("district").notNull(),
    severity: text("severity").notNull(), // critical, warning, info
    alertType: text("alert_type").notNull(), // stockout_risk, epidemic_spike, staff_shortage, bed_exhaustion
    title: text("title").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("active"), // active, resolved, dismissed
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  });

  const briefings = schema.table("briefings", {
    id: text("id").primaryKey(),
    date: text("date").notNull(), // YYYY-MM-DD
    district: text("district").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    generatedBy: text("generated_by").notNull().default("gemini-copilot"),
    keyActionsJson: jsonb("key_actions_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  });

  return {
    phcs,
    medicines,
    stockLevels,
    bedStatus,
    staffAttendance,
    patientFootfall,
    redistributionPlans,
    alerts,
    briefings,
  };
}

export const inKarnatakaTables = createNodeTables(nodeInKarnataka);
export const brBahiaTables = createNodeTables(nodeBrBahia);
export const zaKznTables = createNodeTables(nodeZaKzn);

// Public / shared aggregator schema for Federation rounds & audits
export const federationRounds = pgTable("federation_rounds", {
  id: text("id").primaryKey(),
  roundNumber: integer("round_number").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  participatingNodes: jsonb("participating_nodes").notNull(), // ["node_in_karnataka", "node_br_bahia", "node_za_kzn"]
  globalLoss: real("global_loss").notNull(),
  globalMape: real("global_mape").notNull(),
  noiseEpsilon: real("noise_epsilon").notNull().default(1.0),
  status: text("status").notNull().default("completed"),
  weightsSummaryJson: jsonb("weights_summary_json"),
});

export const simulationStates = pgTable("simulation_states", {
  id: text("id").primaryKey(),
  isEmergencyActive: boolean("is_emergency_active").notNull().default(false),
  roadClosureActive: boolean("road_closure_active").notNull().default(false),
  staffAbsentPercent: integer("staff_absent_percent").notNull().default(0),
  monsoonIntensity: real("monsoon_intensity").notNull().default(1.0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export function getTablesForNode(nodeKey: string) {
  if (nodeKey === "br_bahia" || nodeKey === "node_br_bahia") {
    return brBahiaTables;
  }
  if (nodeKey === "za_kzn" || nodeKey === "node_za_kzn") {
    return zaKznTables;
  }
  return inKarnatakaTables;
}
