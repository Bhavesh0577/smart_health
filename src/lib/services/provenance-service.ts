import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

export interface TableProvenance {
  tableName: string;
  displayName: string;
  category: "Master Infrastructure" | "Environmental Covariates" | "Operational Telemetry" | "Derived Analytics";
  totalRows: number;
  realCount: number;
  derivedCount: number;
  simulatedCount: number;
  realPct: number;
  derivedPct: number;
  simulatedPct: number;
  primarySource: string;
  sourceDataset: string;
  license: string;
  methodology: string;
  limitations: string;
}

export interface ProvenanceReport {
  node: string;
  generatedAt: string;
  summary: {
    totalRows: number;
    realRows: number;
    derivedRows: number;
    simulatedRows: number;
    realPct: number;
    derivedPct: number;
    simulatedPct: number;
    sourcesCount: number;
    adapterCount: number;
  };
  tables: TableProvenance[];
  adapters: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    targetOrigin: "real" | "derived" | "simulated";
    description: string;
    endpointOrPath: string;
  }>;
}

const TABLE_METADATA: Record<string, {
  displayName: string;
  category: TableProvenance["category"];
  primarySource: string;
  license: string;
  methodology: string;
  limitations: string;
}> = {
  phcs: {
    displayName: "Primary Health Centres Master",
    category: "Master Infrastructure",
    primarySource: "data.gov.in & OpenStreetMap Overpass API",
    license: "ODbL / National Data Sharing and Accessibility Policy (NDSAP)",
    methodology: "Official 24x7 PHCs and CHCs deduplicated by name, taluk, and haversine centroid matching across Karnataka focus districts. Reconciled against Lok Sabha Unstarred Question 1924.",
    limitations: "Focus districts (Bengaluru Urban, Belagavi, Kalaburagi, Mysuru, Dakshina Kannada) fully reconciled; secondary health posts may have minor coordinate geocoding jitter (~50m).",
  },
  medicines: {
    displayName: "Essential Medicines Catalog (NLEM)",
    category: "Master Infrastructure",
    primarySource: "National List of Essential Medicines (NLEM 2022, MoHFW)",
    license: "Government Open Data (Public Domain / Official Publication)",
    methodology: "Authoritative extraction of NLEM 2022 PDF, filtered down to Level of Care = Primary (PHC/SC formulary) with official schedule page indexation.",
    limitations: "Standard national formulary; state-specific Karnataka KSMSCL tender brands and local packaging variations are mapped to generic INN names.",
  },
  weather_daily: {
    displayName: "Historical Weather & Live Meteorological Forecast",
    category: "Environmental Covariates",
    primarySource: "Open-Meteo ERA5 Reanalysis Archive & GFS / ECMWF Seamless Model",
    license: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    methodology: "3+ years of daily precipitation sum, max/min 2m air temperatures fetched for district centroids, coupled with a rolling 16-day live numerical weather prediction.",
    limitations: "District centroid resolution; hyper-local microclimates (e.g. Western Ghats slope variations in Belagavi or Dakshina Kannada) are represented at district aggregate scale.",
  },
  stock_levels: {
    displayName: "Medicine Inventory & Days of Cover",
    category: "Operational Telemetry",
    primarySource: "Calibrated Simulator (Fallback) / CSV Upload / Webhook Ingestion",
    license: "Synthetic Baseline / Real when fed via Ingestion Adapter",
    methodology: "Daily inventory levels dynamically modulated by Census 2011 catchment population footfall, real Open-Meteo rainfall, and IDSP disease priors. Upgradable to real via CsvUploadAdapter.",
    limitations: "Real PHC-level daily stock data is classified/non-public in e-Aushadhi without institutional credentials. Simulator provides an honest, realistic demonstration feed.",
  },
  bed_status: {
    displayName: "Bed Availability & Oxygen Occupancy",
    category: "Operational Telemetry",
    primarySource: "Calibrated Simulator / Ingestion Adapters",
    license: "Synthetic Baseline / Real when fed via Ingestion Adapter",
    methodology: "Calibrated on official IPHS bed capacities (6-10 beds for 24x7 PHCs, 30 beds for CHCs) with patient turnover derived from epidemic surge conditions.",
    limitations: "Simulated until real-time hospital management information system (HMIS) telemetry adapter is activated.",
  },
  staff_attendance: {
    displayName: "Clinical Personnel & Duty Roster",
    category: "Operational Telemetry",
    primarySource: "Calibrated Simulator / Biometric Attendance Adapter",
    license: "Synthetic Baseline / Real when fed via Ingestion Adapter",
    methodology: "Calibrated on standard IPHS staffing norms (Medical Officers, Staff Nurses, Pharmacists) with stochastic leaves and monsoon transit disruption factors.",
    limitations: "Real individual clinician biometric attendance is privacy-protected; aggregated staffing percentages are simulated.",
  },
  patient_footfall: {
    displayName: "OPD Attendance & Symptom Surveillance",
    category: "Operational Telemetry",
    primarySource: "Calibrated Simulator / HMIS Ingestion Adapter",
    license: "Synthetic Baseline / Real when fed via Ingestion Adapter",
    methodology: "OPD volumes scaled to Census 2011 derived catchment populations, with symptom distributions (fever, diarrhea, ARI) calibrated against IDSP Karnataka weekly priors.",
    limitations: "Real patient-level records cannot be published due to DISHA/data privacy laws. Only macro-level symptom counts are simulated.",
  },
  redistribution_plans: {
    displayName: "Multi-Echelon Redistribution Orders",
    category: "Derived Analytics",
    primarySource: "Google OR-Tools Mixed-Integer Linear Programming (MILP)",
    license: "Algorithmic Derivative / Apache 2.0",
    methodology: "Derived transfer orders computed using real road distance matrices and simulated stock imbalances to eliminate stockouts while minimizing vehicle transit kilometers.",
    limitations: "Requires fleet validation and real-world road passability checks during extreme monsoon flooding events.",
  },
  alerts: {
    displayName: "Early Warning & Stockout Alerts",
    category: "Derived Analytics",
    primarySource: "Rule-Based & CUSUM Outbreak Risk Detection",
    license: "Algorithmic Derivative",
    methodology: "Triggered whenever days of cover < 7 days, or when real rainfall triggers hydrometeorological disease lag warnings.",
    limitations: "Thresholds calibrated for high-sensitivity surveillance.",
  },
  briefings: {
    displayName: "Executive Copilot Briefings",
    category: "Derived Analytics",
    primarySource: "Gemini 1.5 Pro / LLM Synthesis Engine",
    license: "Algorithmic Derivative",
    methodology: "Synthesized natural language situational reports derived from current facility telemetry, weather forecasts, and redistribution plan logs.",
    limitations: "Advisory only; all clinical transfers require sign-off by District Health Officer.",
  },
};

export async function getProvenanceReport(node: string = "node_in_karnataka"): Promise<ProvenanceReport> {
  const db = await getDb();
  const schema = node.replace(/[^a-zA-Z0-9_]/g, "");

  const tablesToCheck = [
    "phcs",
    "medicines",
    "weather_daily",
    "stock_levels",
    "bed_status",
    "staff_attendance",
    "patient_footfall",
    "redistribution_plans",
    "alerts",
    "briefings",
  ];

  const results: TableProvenance[] = [];

  for (const tableName of tablesToCheck) {
    try {
      const queryStr = `
        SELECT 
          COUNT(*)::int AS total,
          COUNT(CASE WHEN data_origin = 'real' THEN 1 END)::int AS real_count,
          COUNT(CASE WHEN data_origin = 'derived' THEN 1 END)::int AS derived_count,
          COUNT(CASE WHEN data_origin = 'simulated' THEN 1 END)::int AS simulated_count,
          MAX(source_dataset) as source_dataset
        FROM ${schema}.${tableName};
      `;
      const res = await (db as any).$client.query(queryStr);
      const row = res.rows[0] || { total: 0, real_count: 0, derived_count: 0, simulated_count: 0, source_dataset: "" };

      const total = row.total || 0;
      const realCount = row.real_count || 0;
      const derivedCount = row.derived_count || 0;
      const simulatedCount = row.simulated_count || 0;

      const meta = TABLE_METADATA[tableName] || {
        displayName: tableName,
        category: "Operational Telemetry",
        primarySource: "Unknown",
        license: "Proprietary / Unknown",
        methodology: "Standard table ingestion",
        limitations: "None documented",
      };

      results.push({
        tableName,
        displayName: meta.displayName,
        category: meta.category,
        totalRows: total,
        realCount,
        derivedCount,
        simulatedCount,
        realPct: total > 0 ? Math.round((realCount / total) * 1000) / 10 : 0,
        derivedPct: total > 0 ? Math.round((derivedCount / total) * 1000) / 10 : 0,
        simulatedPct: total > 0 ? Math.round((simulatedCount / total) * 1000) / 10 : 0,
        primarySource: meta.primarySource,
        sourceDataset: row.source_dataset || "standard",
        license: meta.license,
        methodology: meta.methodology,
        limitations: meta.limitations,
      });
    } catch (err) {
      console.warn(`Could not compute provenance for ${schema}.${tableName}:`, err);
    }
  }

  const totalRows = results.reduce((acc, t) => acc + t.totalRows, 0);
  const realRows = results.reduce((acc, t) => acc + t.realCount, 0);
  const derivedRows = results.reduce((acc, t) => acc + t.derivedCount, 0);
  const simulatedRows = results.reduce((acc, t) => acc + t.simulatedCount, 0);

  return {
    node,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRows,
      realRows,
      derivedRows,
      simulatedRows,
      realPct: totalRows > 0 ? Math.round((realRows / totalRows) * 1000) / 10 : 0,
      derivedPct: totalRows > 0 ? Math.round((derivedRows / totalRows) * 1000) / 10 : 0,
      simulatedPct: totalRows > 0 ? Math.round((simulatedRows / totalRows) * 1000) / 10 : 0,
      sourcesCount: 5, // Open-Meteo, NLEM 2022, data.gov.in / OSM, Census 2011, IDSP
      adapterCount: 4, // CSV Upload, Signed Webhook, HMIS Adapter, Calibrated Simulator
    },
    tables: results,
    adapters: [
      {
        id: "csv_upload",
        name: "CSV Bulk Telemetry Ingestion",
        type: "Batch File Upload",
        status: "Active",
        targetOrigin: "real",
        description: "Uploads facility inventory, beds, staffing, or OPD footfall CSVs with strict schema validation. Tagged data_origin=real.",
        endpointOrPath: "/api/ingestion/upload",
      },
      {
        id: "webhook",
        name: "HMAC Signed Telemetry Stream",
        type: "REST Webhook",
        status: "Active",
        targetOrigin: "real",
        description: "Cryptographically verified push endpoint for IoT dispensary cold-chain monitors and hospital telemetry. Tagged data_origin=real.",
        endpointOrPath: "/api/ingestion/webhook",
      },
      {
        id: "hmis_adapter",
        name: "NHM HMIS Standard Adapter",
        type: "Monthly Batch ETL Stub",
        status: "Ready",
        targetOrigin: "real",
        description: "Standardized field mapper for National Health Mission HMIS monthly facility indicator exports.",
        endpointOrPath: "src/lib/adapters/hmis-adapter.ts",
      },
      {
        id: "simulator",
        name: "Calibrated Epidemic & Logistics Simulator",
        type: "Monte Carlo Engine",
        status: "Active (Fallback)",
        targetOrigin: "simulated",
        description: "Calibrated simulation engine driving realistic baseline footfall and stock consumption based on real weather and population.",
        endpointOrPath: "src/lib/adapters/simulator-adapter.ts",
      },
    ],
  };
}
