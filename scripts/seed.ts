import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "path";
import fs from "fs";
import { config } from "dotenv";

config();

// Deterministic Mulberry32 PRNG
function createPrng(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createPrng(42);

// Random helpers
function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return min + rng() * (max - min);
}

function choice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

const MEDICINES = [
  { id: "MED_PARA", code: "PARA-500", name: "Paracetamol 500mg", category: "Analgesic/Antipyretic", unit: "Tablets", unitCost: 0.8, reorderThreshold: 1500, shelfLifeDays: 730 },
  { id: "MED_AMOX", code: "AMOX-500", name: "Amoxicillin 500mg", category: "Antibiotic", unit: "Capsules", unitCost: 2.5, reorderThreshold: 800, shelfLifeDays: 540 },
  { id: "MED_AZI", code: "AZI-500", name: "Azithromycin 500mg", category: "Macrolide Antibiotic", unit: "Tablets", unitCost: 6.0, reorderThreshold: 400, shelfLifeDays: 730 },
  { id: "MED_ORS", code: "ORS-21G", name: "Oral Rehydration Salts (ORS)", category: "Electrolyte Replacement", unit: "Sachets", unitCost: 4.5, reorderThreshold: 1200, shelfLifeDays: 1095 },
  { id: "MED_IFA", code: "IFA-100", name: "Iron & Folic Acid", category: "Maternal Health/Micronutrient", unit: "Tablets", unitCost: 0.5, reorderThreshold: 2000, shelfLifeDays: 730 },
  { id: "MED_AL", code: "ACT-AL", name: "Artemether-Lumefantrine 80/480mg", category: "Antimalarial", unit: "Tablets", unitCost: 18.0, reorderThreshold: 350, shelfLifeDays: 730 },
  { id: "MED_INS", code: "INS-REG", name: "Insulin Regular 100 IU/mL", category: "Endocrine/Diabetes", unit: "Vials", unitCost: 145.0, reorderThreshold: 60, shelfLifeDays: 365 },
];

const KARNATAKA_DISTRICTS: Record<string, { lat: number; lng: number; names: string[] }> = {
  "Bengaluru Urban": {
    lat: 12.9716,
    lng: 77.5946,
    names: [
      "PHC Nelamangala", "PHC Anekal", "PHC Yelahanka", "PHC Kengeri", "PHC KR Puram",
      "PHC Hebbal", "PHC Whitefield", "PHC Sarjapur", "PHC Hoskote", "PHC Devanahalli",
      "PHC Magadi Road", "PHC Jigani", "PHC Peenya", "PHC Varthur"
    ]
  },
  "Belagavi": {
    lat: 15.8497,
    lng: 74.4977,
    names: [
      "PHC Chikkodi", "PHC Gokak", "PHC Athani", "PHC Bailhongal", "PHC Hukkeri",
      "PHC Ramdurg", "PHC Saundatti", "PHC Khanapur", "PHC Raybag", "PHC Nippani",
      "PHC Kittur", "PHC Kudachi", "PHC Kagwad", "PHC Nesargi"
    ]
  },
  "Kalaburagi": {
    lat: 17.3297,
    lng: 76.8343,
    names: [
      "PHC Aland", "PHC Sedam", "PHC Chincholi", "PHC Afzalpur", "PHC Chittapur",
      "PHC Jevargi", "PHC Shahabad", "PHC Kamalapur", "PHC Kalgi", "PHC Yadrami",
      "PHC Farhatabad", "PHC Mahagaon", "PHC Srinivas Saradagi", "PHC Kusnoor"
    ]
  },
  "Mysuru": {
    lat: 12.2958,
    lng: 76.6394,
    names: [
      "PHC Nanjangud", "PHC Hunsur", "PHC Piriyapatna", "PHC KR Nagar", "PHC HD Kote",
      "PHC T Narasipura", "PHC Bilikere", "PHC Bannur", "PHC Saligrama", "PHC Sargur",
      "PHC Bettadapura", "PHC Jayapura", "PHC Varuna", "PHC Kadakola"
    ]
  },
  "Dakshina Kannada": {
    lat: 12.8703,
    lng: 74.8806,
    names: [
      "PHC Ullal", "PHC Bantwal", "PHC Belthangady", "PHC Puttur", "PHC Sullia",
      "PHC Moodbidri", "PHC Kadaba", "PHC Guruvayanakere", "PHC Surathkal", "PHC Bajpe",
      "PHC Vittal", "PHC Uppinangady", "PHC Panambur", "PHC Mulki"
    ]
  }
};

const BAHIA_DISTRICTS: Record<string, { lat: number; lng: number; names: string[] }> = {
  "Salvador": {
    lat: -12.9777,
    lng: -38.5016,
    names: ["UBS Pelourinho", "UBS Barra", "UBS Itapuã", "UBS Liberdade", "UBS Cabula"]
  },
  "Feira de Santana": {
    lat: -12.2664,
    lng: -38.9663,
    names: ["UBS Tomba", "UBS Mangabeira", "UBS Cidade Nova", "UBS Sim", "UBS Campo Limpo"]
  },
  "Vitória da Conquista": {
    lat: -14.8661,
    lng: -40.8394,
    names: ["UBS Candeias", "UBS Brasil", "UBS Alto Maron", "UBS Patagônia", "UBS Recreio"]
  },
  "Ilhéus": {
    lat: -14.7889,
    lng: -39.0494,
    names: ["UBS Malhado", "UBS Conquista", "UBS Nelson Costa", "UBS Olivença", "UBS Centro"]
  }
};

const KZN_DISTRICTS: Record<string, { lat: number; lng: number; names: string[] }> = {
  "eThekwini": {
    lat: -29.8587,
    lng: 31.0218,
    names: ["Clinic KwaMashu", "Clinic Umlazi", "Clinic Phoenix", "Clinic Chatsworth", "Clinic Inanda"]
  },
  "uMgungundlovu": {
    lat: -29.6006,
    lng: 30.3794,
    names: ["Clinic Edendale", "Clinic Northdale", "Clinic Imbali", "Clinic Howick", "Clinic Mpophomeni"]
  },
  "King Cetshwayo": {
    lat: -28.7532,
    lng: 31.8935,
    names: ["Clinic Richards Bay", "Clinic Empangeni", "Clinic Ngwelezane", "Clinic Esikhawini", "Clinic eNseleni"]
  },
  "uThukela": {
    lat: -28.5583,
    lng: 29.7828,
    names: ["Clinic Ladysmith", "Clinic Estcourt", "Clinic Okhahlamba", "Clinic Wembezi", "Clinic Colenso"]
  }
};

interface SqlExecutor {
  query(sql: string, params?: any[]): Promise<any>;
}

async function getSqlExecutor(): Promise<{ exec: SqlExecutor; close: () => Promise<void>; type: string }> {
  const isReset = process.argv.includes("--reset");
  const usePglite = process.env.USE_PGLITE === "true";

  if (!usePglite && process.env.DATABASE_URL) {
    try {
      const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 2, max: 1 });
      await sql`SELECT 1`;
      console.log("Connected to PostgreSQL/TimescaleDB at", process.env.DATABASE_URL);
      return {
        exec: {
          query: async (queryText: string, params: any[] = []) => {
            return sql.unsafe(queryText, params);
          },
        },
        close: async () => {
          await sql.end();
        },
        type: "postgres",
      };
    } catch {
      console.warn("PostgreSQL connection failed, using local embedded PGlite WASM engine.");
    }
  }

  const dataDir = path.join(process.cwd(), ".pglite_data");
  if (isReset && fs.existsSync(dataDir)) {
    console.log("Resetting PGlite data directory...");
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  return {
    exec: {
      query: async (queryText: string, params: any[] = []) => {
        if (!params || params.length === 0) {
          return pglite.exec(queryText);
        }
        return pglite.query(queryText, params);
      },
    },
    close: async () => {
      await pglite.close();
    },
    type: "pglite",
  };
}

async function createSchemaAndTables(exec: SqlExecutor, schemaName: string) {
  await exec.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);

  await exec.query(`
    CREATE TABLE IF NOT EXISTS ${schemaName}.phcs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      type TEXT NOT NULL DEFAULT '24x7_PHC',
      bed_capacity INTEGER NOT NULL DEFAULT 10,
      target_population INTEGER NOT NULL DEFAULT 30000,
      resilience_score REAL NOT NULL DEFAULT 75.0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.medicines (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      unit_cost REAL NOT NULL,
      reorder_threshold INTEGER NOT NULL,
      shelf_life_days INTEGER NOT NULL DEFAULT 730,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.stock_levels (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      medicine_id TEXT NOT NULL REFERENCES ${schemaName}.medicines(id),
      qty INTEGER NOT NULL,
      reorder_threshold INTEGER NOT NULL,
      expiry_date TIMESTAMPTZ NOT NULL,
      days_of_cover REAL NOT NULL DEFAULT 30,
      source TEXT NOT NULL DEFAULT 'system_sync'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.bed_status (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      total_beds INTEGER NOT NULL,
      occupied_beds INTEGER NOT NULL,
      critical_care_beds INTEGER NOT NULL DEFAULT 2,
      available_oxygen_beds INTEGER NOT NULL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.staff_attendance (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      doctors_present INTEGER NOT NULL,
      nurses_present INTEGER NOT NULL,
      pharmacists_present INTEGER NOT NULL,
      staff_on_duty INTEGER NOT NULL,
      required_staff INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.patient_footfall (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      opd_count INTEGER NOT NULL,
      symptom_category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.redistribution_plans (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'recommended',
      moves_json JSONB NOT NULL,
      total_cost_estimate REAL NOT NULL,
      explanation TEXT NOT NULL,
      triggered_by TEXT NOT NULL DEFAULT 'optimizer'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.alerts (
      id TEXT PRIMARY KEY,
      time TIMESTAMPTZ DEFAULT NOW(),
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      district TEXT NOT NULL,
      severity TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      resolved_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.briefings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      district TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'gemini-copilot',
      key_actions_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function createSharedTables(exec: SqlExecutor) {
  await exec.query(`
    CREATE TABLE IF NOT EXISTS public.federation_rounds (
      id TEXT PRIMARY KEY,
      round_number INTEGER NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      participating_nodes JSONB NOT NULL,
      global_loss REAL NOT NULL,
      global_mape REAL NOT NULL,
      noise_epsilon REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'completed',
      weights_summary_json JSONB
    );

    CREATE TABLE IF NOT EXISTS public.simulation_states (
      id TEXT PRIMARY KEY,
      is_emergency_active BOOLEAN NOT NULL DEFAULT false,
      road_closure_active BOOLEAN NOT NULL DEFAULT false,
      staff_absent_percent INTEGER NOT NULL DEFAULT 0,
      monsoon_intensity REAL NOT NULL DEFAULT 1.0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function seed() {
  console.log("Starting PHC Resilience Grid Deterministic Seed (90 Days History)...");
  const { exec, close, type } = await getSqlExecutor();

  try {
    await createSharedTables(exec);

    // Initialize simulation state
    await exec.query(`
      INSERT INTO public.simulation_states (id, is_emergency_active, road_closure_active, staff_absent_percent, monsoon_intensity, updated_at)
      VALUES ('active_state', false, false, 0, 1.0, NOW())
      ON CONFLICT (id) DO UPDATE SET is_emergency_active = false, road_closure_active = false, staff_absent_percent = 0, monsoon_intensity = 1.0;
    `);

    // Seed Federation Rounds (Rounds 1-5 baseline)
    await exec.query(`DELETE FROM public.federation_rounds;`);
    const federationData = [
      { id: "fed_rnd_1", round: 1, loss: 0.421, mape: 24.8, eps: 1.0 },
      { id: "fed_rnd_2", round: 2, loss: 0.315, mape: 18.2, eps: 1.0 },
      { id: "fed_rnd_3", round: 3, loss: 0.244, mape: 14.5, eps: 1.0 },
      { id: "fed_rnd_4", round: 4, loss: 0.198, mape: 11.9, eps: 1.0 },
      { id: "fed_rnd_5", round: 5, loss: 0.165, mape: 9.7, eps: 1.0 },
    ];
    for (const r of federationData) {
      await exec.query(
        `INSERT INTO public.federation_rounds (id, round_number, timestamp, participating_nodes, global_loss, global_mape, noise_epsilon, status, weights_summary_json)
         VALUES ($1, $2, NOW() - INTERVAL '1 day' * $3, $4, $5, $6, $7, 'completed', $8);`,
        [
          r.id,
          r.round,
          5 - r.round,
          JSON.stringify(["node_in_karnataka", "node_br_bahia", "node_za_kzn"]),
          r.loss,
          r.mape,
          r.eps,
          JSON.stringify({ weights_norm: 0.85 - r.round * 0.1, delta_divergence: 0.05 / r.round })
        ]
      );
    }

    // Nodes setup
    const nodes = [
      { schema: "node_in_karnataka", country: "India", state: "Karnataka", districts: KARNATAKA_DISTRICTS },
      { schema: "node_br_bahia", country: "Brazil", state: "Bahia", districts: BAHIA_DISTRICTS },
      { schema: "node_za_kzn", country: "South Africa", state: "KwaZulu-Natal", districts: KZN_DISTRICTS },
    ];

    const now = new Date("2026-09-29T12:00:00Z");
    const numDays = 90;

    for (const node of nodes) {
      console.log(`Seeding schema: ${node.schema} (${node.country})...`);
      await createSchemaAndTables(exec, node.schema);

      // Clean existing node data
      await exec.query(`DELETE FROM ${node.schema}.alerts;`);
      await exec.query(`DELETE FROM ${node.schema}.briefings;`);
      await exec.query(`DELETE FROM ${node.schema}.redistribution_plans;`);
      await exec.query(`DELETE FROM ${node.schema}.stock_levels;`);
      await exec.query(`DELETE FROM ${node.schema}.bed_status;`);
      await exec.query(`DELETE FROM ${node.schema}.staff_attendance;`);
      await exec.query(`DELETE FROM ${node.schema}.patient_footfall;`);
      await exec.query(`DELETE FROM ${node.schema}.phcs;`);
      await exec.query(`DELETE FROM ${node.schema}.medicines;`);

      // 1. Insert Medicines
      for (const med of MEDICINES) {
        await exec.query(
          `INSERT INTO ${node.schema}.medicines (id, code, name, category, unit, unit_cost, reorder_threshold, shelf_life_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [med.id, med.code, med.name, med.category, med.unit, med.unitCost, med.reorderThreshold, med.shelfLifeDays]
        );
      }

      // 2. Insert PHCs
      const phcList: Array<{ id: string; name: string; district: string; lat: number; lng: number; bedCapacity: number; targetPop: number }> = [];

      for (const [district, info] of Object.entries(node.districts)) {
        for (let idx = 0; idx < info.names.length; idx++) {
          const phcName = info.names[idx];
          const phcId = `${node.schema.substring(5)}_${district.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${idx + 1}`;
          const lat = info.lat + (rng() - 0.5) * 0.15;
          const lng = info.lng + (rng() - 0.5) * 0.15;
          const bedCapacity = randomInt(8, 24);
          const targetPop = randomInt(25000, 45000);
          const resilienceScore = randomFloat(65.0, 92.0);

          await exec.query(
            `INSERT INTO ${node.schema}.phcs (id, name, district, state, country, lat, lng, type, bed_capacity, target_population, resilience_score, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, '24x7_PHC', $8, $9, $10, true);`,
            [phcId, phcName, district, node.state, node.country, lat, lng, bedCapacity, targetPop, resilienceScore]
          );

          phcList.push({ id: phcId, name: phcName, district, lat, lng, bedCapacity, targetPop });
        }
      }

      console.log(`  Inserted ${phcList.length} PHCs in ${node.schema}`);

      // 3. Generate 90 Days of Longitudinal Data
      // 3 PHCs in Karnataka designed to trend to near-stockout in the last 7 days:
      // - PHC Ullal (Dakshina Kannada) -> ORS & Antimalarial near zero
      // - PHC Aland (Kalaburagi) -> Paracetamol & Azithromycin near zero
      // - PHC Nelamangala (Bengaluru Urban) -> Insulin near zero
      const targetStockoutPhcs = new Set(["PHC Ullal", "PHC Aland", "PHC Nelamangala"]);

      for (const phc of phcList) {
        const isStockoutTarget = targetStockoutPhcs.has(phc.name);
        const isCoastalOrKalaburagi = phc.district === "Dakshina Kannada" || phc.district === "Kalaburagi";

        // Current stock inventory tracker per medicine
        const currentStock: Record<string, number> = {};
        for (const med of MEDICINES) {
          currentStock[med.id] = randomInt(med.reorderThreshold * 2, med.reorderThreshold * 4);
        }

        // Generate daily history from 90 days ago up to today
        for (let dayOffset = numDays - 1; dayOffset >= 0; dayOffset--) {
          const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
          const month = date.getMonth(); // 5 = June, 6 = July, 7 = Aug, 8 = Sept
          const isMonsoon = month >= 5 && month <= 8;
          const isLastWeek = dayOffset <= 7;
          const isFestival = dayOffset >= 10 && dayOffset <= 14;

          // Multiplier factors
          let monsoonMultiplier = 1.0;
          if (isMonsoon && isCoastalOrKalaburagi) {
            monsoonMultiplier = 2.4;
          } else if (isMonsoon) {
            monsoonMultiplier = 1.6;
          }

          const festivalMultiplier = isFestival ? 1.3 : 1.0;

          // 1. Patient Footfall by Symptom Category
          const categories = ["fever", "respiratory", "diarrhea", "maternal", "trauma", "general"] as const;
          let totalDailyOpd = 0;

          for (const cat of categories) {
            let baseCount = randomInt(8, 20);
            if (cat === "fever" || cat === "diarrhea") {
              baseCount = Math.round(baseCount * monsoonMultiplier * festivalMultiplier);
            }
            if (isStockoutTarget && isLastWeek && (cat === "fever" || cat === "diarrhea")) {
              baseCount = Math.round(baseCount * 1.8);
            }
            totalDailyOpd += baseCount;

            await exec.query(
              `INSERT INTO ${node.schema}.patient_footfall (time, phc_id, opd_count, symptom_category)
               VALUES ($1, $2, $3, $4);`,
              [date.toISOString(), phc.id, baseCount, cat]
            );
          }

          // 2. Bed Status
          const occupiedBeds = Math.min(
            phc.bedCapacity,
            Math.max(2, Math.round(phc.bedCapacity * (0.55 + 0.3 * (totalDailyOpd / 120))))
          );
          await exec.query(
            `INSERT INTO ${node.schema}.bed_status (time, phc_id, total_beds, occupied_beds, critical_care_beds, available_oxygen_beds)
             VALUES ($1, $2, $3, $4, $5, $6);`,
            [date.toISOString(), phc.id, phc.bedCapacity, occupiedBeds, 2, Math.max(0, 4 - Math.round(occupiedBeds * 0.25))]
          );

          // 3. Staff Attendance
          const reqDoctors = 2;
          const reqNurses = 4;
          const reqPharm = 1;
          const doctorsPres = Math.max(1, reqDoctors - (rng() < 0.15 ? 1 : 0));
          const nursesPres = Math.max(2, reqNurses - (rng() < 0.2 ? 1 : 0));
          const pharmPres = reqPharm - (rng() < 0.1 ? 1 : 0);
          await exec.query(
            `INSERT INTO ${node.schema}.staff_attendance (time, phc_id, doctors_present, nurses_present, pharmacists_present, staff_on_duty, required_staff)
             VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [date.toISOString(), phc.id, doctorsPres, nursesPres, pharmPres, doctorsPres + nursesPres + pharmPres, reqDoctors + reqNurses + reqPharm]
          );

          // 4. Medicine Consumption & Stock Tracking
          // Regular shipments arrive every 20 days if not targeted to stock out
          const isRestockDay = dayOffset > 7 && dayOffset % 20 === 0;

          for (const med of MEDICINES) {
            let dailyUsage = randomInt(15, 40);
            if (med.id === "MED_ORS") dailyUsage = Math.round(randomInt(30, 80) * (isMonsoon ? 2.5 : 1.0));
            if (med.id === "MED_AL") dailyUsage = Math.round(randomInt(10, 30) * (isMonsoon ? 2.8 : 1.0));
            if (med.id === "MED_PARA") dailyUsage = Math.round(randomInt(40, 100) * monsoonMultiplier);

            currentStock[med.id] = Math.max(0, currentStock[med.id] - dailyUsage);

            if (isRestockDay && !(isStockoutTarget && isLastWeek)) {
              currentStock[med.id] += med.reorderThreshold * 2;
            }

            // Force targeted stockout in the last 7 days
            if (isStockoutTarget && isLastWeek) {
              if (phc.name === "PHC Ullal" && (med.id === "MED_ORS" || med.id === "MED_AL")) {
                currentStock[med.id] = Math.max(5, Math.round(currentStock[med.id] * 0.3));
              }
              if (phc.name === "PHC Aland" && (med.id === "MED_PARA" || med.id === "MED_AZI")) {
                currentStock[med.id] = Math.max(10, Math.round(currentStock[med.id] * 0.25));
              }
              if (phc.name === "PHC Nelamangala" && med.id === "MED_INS") {
                currentStock[med.id] = Math.max(2, Math.round(currentStock[med.id] * 0.2));
              }
            }

            // Expiry dates: some stock has near expiry (20-40 days from now)
            const expiryDaysAhead = (dayOffset % 15 === 0 && rng() < 0.25) ? randomInt(20, 45) : randomInt(180, 500);
            const expiryDate = new Date(date.getTime() + expiryDaysAhead * 24 * 60 * 60 * 1000);
            const avgDailyRate = Math.max(1, dailyUsage);
            const daysOfCover = Number((currentStock[med.id] / avgDailyRate).toFixed(1));

            // Record stock levels every 3 days or for today/last 7 days daily
            if (dayOffset <= 7 || dayOffset % 3 === 0) {
              await exec.query(
                `INSERT INTO ${node.schema}.stock_levels (time, phc_id, medicine_id, qty, reorder_threshold, expiry_date, days_of_cover, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'system_sync');`,
                [date.toISOString(), phc.id, med.id, currentStock[med.id], med.reorderThreshold, expiryDate.toISOString(), daysOfCover]
              );
            }
          }
        }
      }

      // 4. Insert Seed Alerts (e.g. for the 3 near-stockout PHCs and monsoon warnings)
      const alertSeeds = [
        {
          id: `alt_${node.schema}_1`,
          phcName: "PHC Ullal",
          district: "Dakshina Kannada",
          severity: "critical",
          type: "stockout_risk",
          title: "Critical ORS & Antimalarial Depletion",
          message: "Stock cover is under 2.5 days following severe coastal monsoon diarrhea surge. Immediate cross-district replenishment needed.",
        },
        {
          id: `alt_${node.schema}_2`,
          phcName: "PHC Aland",
          district: "Kalaburagi",
          severity: "critical",
          type: "stockout_risk",
          title: "Paracetamol & Azithromycin Stockout Imminent",
          message: "Aland PHC has 1.8 days of cover remaining. Outpatient fever consultations up 210% over the last 72 hours.",
        },
        {
          id: `alt_${node.schema}_3`,
          phcName: "PHC Nelamangala",
          district: "Bengaluru Urban",
          severity: "warning",
          type: "stockout_risk",
          title: "Insulin Regular Depletion Trajectory",
          message: "Insulin Regular inventory stands at 6 vials. Projected zero stock date: 48 hours.",
        },
        {
          id: `alt_${node.schema}_4`,
          phcName: "PHC Bantwal",
          district: "Dakshina Kannada",
          severity: "warning",
          type: "epidemic_spike",
          title: "Early Warning: Vector-borne Fever Spike",
          message: "CUSUM anomaly detector triggered for acute fever syndrome (+185% vs baseline).",
        }
      ];

      for (const a of alertSeeds) {
        const matchingPhc = phcList.find((p) => p.name === a.phcName) || phcList[0];
        await exec.query(
          `INSERT INTO ${node.schema}.alerts (id, time, phc_id, district, severity, alert_type, title, message, status)
           VALUES ($1, NOW() - INTERVAL '3 hours', $2, $3, $4, $5, $6, $7, 'active');`,
          [a.id, matchingPhc.id, matchingPhc.district, a.severity, a.type, a.title, a.message]
        );
      }

      // 5. Insert Sample Seed Redistribution Plan
      const sourcePhc = phcList.find(p => p.name === "PHC Sullia") || phcList[1];
      const targetPhc = phcList.find(p => p.name === "PHC Ullal") || phcList[0];
      const sampleMoves = [
        {
          fromPhcId: sourcePhc.id,
          fromPhcName: sourcePhc.name,
          toPhcId: targetPhc.id,
          toPhcName: targetPhc.name,
          medicineId: "MED_ORS",
          medicineName: "Oral Rehydration Salts (ORS)",
          quantity: 800,
          unit: "Sachets",
          distanceKm: 78.4,
          etaMinutes: 110,
          expiryDate: "2026-11-15",
          urgencyScore: 92,
          reason: "Prioritizes moving 800 sachets of near-expiry (45 days) ORS from surplus stock in Sullia to prevent stockout in high-footfall Ullal."
        },
        {
          fromPhcId: phcList[2]?.id || sourcePhc.id,
          fromPhcName: phcList[2]?.name || sourcePhc.name,
          toPhcId: targetPhc.id,
          toPhcName: targetPhc.name,
          medicineId: "MED_AL",
          medicineName: "Artemether-Lumefantrine 80/480mg",
          quantity: 250,
          unit: "Tablets",
          distanceKm: 42.1,
          etaMinutes: 65,
          expiryDate: "2027-02-20",
          urgencyScore: 88,
          reason: "Urgent buffer transfer to resolve acute antimalarial deficit during monsoon transmission spike."
        }
      ];

      await exec.query(
        `INSERT INTO ${node.schema}.redistribution_plans (id, created_at, status, moves_json, total_cost_estimate, explanation, triggered_by)
         VALUES ($1, NOW() - INTERVAL '2 hours', 'recommended', $2, $3, $4, 'optimizer');`,
        [
          `plan_${node.schema}_init`,
          JSON.stringify(sampleMoves),
          1450.0,
          "Automated OR-Tools Min-Cost Flow optimization resolving Dakshina Kannada monsoon stockout alerts while prioritizing near-expiry stock."
        ]
      );

      // 6. Insert Daily Briefing
      await exec.query(
        `INSERT INTO ${node.schema}.briefings (id, date, district, content_markdown, generated_by, key_actions_json)
         VALUES ($1, '2026-09-29', 'Dakshina Kannada', $2, 'gemini-copilot', $3);`,
        [
          `brief_${node.schema}_20260929`,
          `### Daily Health Resilience Briefing: Dakshina Kannada\n\n**Executive Summary:**\n- **Monsoon Surge Alert:** Footfall in coastal PHCs (Ullal, Bantwal, Surathkal) is 185% above the 30-day baseline, dominated by acute diarrheal disease and monsoon fever.\n- **Critical Stock-out Risk:** PHC Ullal has less than 2.5 days of ORS and Artemether-Lumefantrine.\n- **Recommended Redistribution:** Dispatched Plan \`plan_${node.schema}_init\` moving 800 sachets of near-expiry ORS from PHC Sullia to Ullal.\n- **Bed Occupancy:** Coastal zone occupancy stands at 82%, with 14 oxygen beds available in reserve.`,
          JSON.stringify(["Approve Plan plan_" + node.schema + "_init", "Re-assign 2 roving nurses to PHC Ullal", "Inspect cold chain at Bantwal"])
        ]
      );
    }

    console.log("Successfully seeded all 3 federated nodes (node_in_karnataka, node_br_bahia, node_za_kzn) with 90-day histories!");
    await close();
  } catch (error) {
    console.error("Error during database seeding:", error);
    await close();
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  seed().then(() => {
    console.log("Seed script completed successfully.");
    process.exit(0);
  });
}
