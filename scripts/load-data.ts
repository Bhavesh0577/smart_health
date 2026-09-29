import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "path";
import fs from "fs";
import { config } from "dotenv";

config();

// Deterministic Mulberry32 PRNG for calibrated simulation
function createPrng(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createPrng(42);

function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return min + rng() * (max - min);
}

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
      catchment_population INTEGER,
      resilience_score REAL NOT NULL DEFAULT 75.0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      data_origin TEXT NOT NULL DEFAULT 'real',
      source_dataset TEXT NOT NULL DEFAULT 'osm_overpass_healthcare',
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
      level_of_care TEXT DEFAULT 'Primary',
      source_page INTEGER DEFAULT 1,
      data_origin TEXT NOT NULL DEFAULT 'real',
      source_dataset TEXT NOT NULL DEFAULT 'nlem_2022',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.weather_daily (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      district TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      precipitation_sum_mm REAL NOT NULL DEFAULT 0,
      temperature_max_c REAL NOT NULL,
      temperature_min_c REAL NOT NULL,
      is_forecast BOOLEAN NOT NULL DEFAULT false,
      data_origin TEXT NOT NULL DEFAULT 'real',
      source_dataset TEXT NOT NULL DEFAULT 'open_meteo_archive'
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
      source TEXT NOT NULL DEFAULT 'system_sync',
      data_origin TEXT NOT NULL DEFAULT 'simulated',
      source_dataset TEXT DEFAULT 'calibrated_simulator'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.bed_status (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      total_beds INTEGER NOT NULL,
      occupied_beds INTEGER NOT NULL,
      critical_care_beds INTEGER NOT NULL DEFAULT 2,
      available_oxygen_beds INTEGER NOT NULL DEFAULT 4,
      data_origin TEXT NOT NULL DEFAULT 'simulated',
      source_dataset TEXT DEFAULT 'calibrated_simulator'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.staff_attendance (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      doctors_present INTEGER NOT NULL,
      nurses_present INTEGER NOT NULL,
      pharmacists_present INTEGER NOT NULL,
      staff_on_duty INTEGER NOT NULL,
      required_staff INTEGER NOT NULL,
      data_origin TEXT NOT NULL DEFAULT 'simulated',
      source_dataset TEXT DEFAULT 'calibrated_simulator'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.patient_footfall (
      id SERIAL PRIMARY KEY,
      time TIMESTAMPTZ NOT NULL,
      phc_id TEXT NOT NULL REFERENCES ${schemaName}.phcs(id),
      opd_count INTEGER NOT NULL,
      symptom_category TEXT NOT NULL,
      data_origin TEXT NOT NULL DEFAULT 'simulated',
      source_dataset TEXT DEFAULT 'calibrated_simulator'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.redistribution_plans (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'recommended',
      moves_json JSONB NOT NULL,
      total_cost_estimate REAL NOT NULL,
      explanation TEXT NOT NULL,
      triggered_by TEXT NOT NULL DEFAULT 'optimizer',
      data_origin TEXT NOT NULL DEFAULT 'derived',
      source_dataset TEXT DEFAULT 'or_tools_optimizer'
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
      resolved_at TIMESTAMPTZ,
      data_origin TEXT NOT NULL DEFAULT 'derived',
      source_dataset TEXT DEFAULT 'cusum_detector'
    );

    CREATE TABLE IF NOT EXISTS ${schemaName}.briefings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      district TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'gemini-copilot',
      key_actions_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      data_origin TEXT NOT NULL DEFAULT 'derived',
      source_dataset TEXT DEFAULT 'gemini_copilot'
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
      weights_summary_json JSONB,
      data_origin TEXT NOT NULL DEFAULT 'derived',
      source_dataset TEXT DEFAULT 'fedavg_aggregator'
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

export async function loadData() {
  console.log("=================================================================");
  console.log("  PHC Resilience Grid: Authoritative Master Data Ingestion");
  console.log("=================================================================");

  const { exec, close, type } = await getSqlExecutor();

  try {
    await createSharedTables(exec);

    // Initialize simulation state
    await exec.query(`
      INSERT INTO public.simulation_states (id, is_emergency_active, road_closure_active, staff_absent_percent, monsoon_intensity, updated_at)
      VALUES ('active_state', false, false, 0, 1.0, NOW())
      ON CONFLICT (id) DO UPDATE SET is_emergency_active = false, road_closure_active = false, staff_absent_percent = 0, monsoon_intensity = 1.0;
    `);

    // 1. Seed Shared Federation Rounds
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
        `INSERT INTO public.federation_rounds (id, round_number, timestamp, participating_nodes, global_loss, global_mape, noise_epsilon, status, weights_summary_json, data_origin, source_dataset)
         VALUES ($1, $2, NOW() - INTERVAL '1 day' * $3, $4, $5, $6, $7, 'completed', $8, 'derived', 'fedavg_aggregator');`,
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
    console.log(`✓ Ingested ${federationData.length} baseline Federation Rounds`);

    // Read raw data files
    const facilitiesDir = path.join(process.cwd(), "data", "raw", "facilities");
    const medicinesFile = path.join(process.cwd(), "data", "processed", "nlem_primary_care.json");
    const weatherFile = path.join(process.cwd(), "data", "raw", "weather", "karnataka_weather_daily.json");
    const censusFile = path.join(process.cwd(), "data", "raw", "population", "karnataka_census_2011.json");
    const seasonalityFile = path.join(process.cwd(), "data", "raw", "seasonality", "disease_seasonality_karnataka.json");

    const karFacilities = JSON.parse(fs.readFileSync(path.join(facilitiesDir, "karnataka_facilities.json"), "utf-8"));
    const bahiaFacilities = JSON.parse(fs.readFileSync(path.join(facilitiesDir, "bahia_facilities.json"), "utf-8"));
    const kznFacilities = JSON.parse(fs.readFileSync(path.join(facilitiesDir, "kzn_facilities.json"), "utf-8"));
    const medicinesList = JSON.parse(fs.readFileSync(medicinesFile, "utf-8"));
    const weatherData = JSON.parse(fs.readFileSync(weatherFile, "utf-8"));
    const censusData = JSON.parse(fs.readFileSync(censusFile, "utf-8"));
    const seasonalityData = JSON.parse(fs.readFileSync(seasonalityFile, "utf-8"));

    const nodes = [
      {
        schema: "node_in_karnataka",
        country: "India",
        state: "Karnataka",
        facilities: karFacilities,
        weatherDistricts: ["Bengaluru Urban", "Belagavi", "Kalaburagi", "Mysuru", "Dakshina Kannada"],
      },
      {
        schema: "node_br_bahia",
        country: "Brazil",
        state: "Bahia",
        facilities: bahiaFacilities,
        weatherDistricts: ["Salvador"],
      },
      {
        schema: "node_za_kzn",
        country: "South Africa",
        state: "KwaZulu-Natal",
        facilities: kznFacilities,
        weatherDistricts: ["eThekwini"],
      },
    ];

    const now = new Date("2026-09-29T12:00:00Z");
    const numDays = 90;

    for (const node of nodes) {
      console.log(`\nLoading Sovereign Node: ${node.schema} (${node.country})...`);
      await createSchemaAndTables(exec, node.schema);

      // Clean existing node data
      await exec.query(`DELETE FROM ${node.schema}.alerts;`);
      await exec.query(`DELETE FROM ${node.schema}.briefings;`);
      await exec.query(`DELETE FROM ${node.schema}.redistribution_plans;`);
      await exec.query(`DELETE FROM ${node.schema}.stock_levels;`);
      await exec.query(`DELETE FROM ${node.schema}.bed_status;`);
      await exec.query(`DELETE FROM ${node.schema}.staff_attendance;`);
      await exec.query(`DELETE FROM ${node.schema}.patient_footfall;`);
      await exec.query(`DELETE FROM ${node.schema}.weather_daily;`);
      await exec.query(`DELETE FROM ${node.schema}.phcs;`);
      await exec.query(`DELETE FROM ${node.schema}.medicines;`);

      // 1. Ingest Real NLEM Medicines
      for (const med of medicinesList) {
        await exec.query(
          `INSERT INTO ${node.schema}.medicines (id, code, name, category, unit, unit_cost, reorder_threshold, shelf_life_days, level_of_care, source_page, data_origin, source_dataset)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
          [
            med.id,
            med.code,
            med.name,
            med.category,
            med.unit,
            med.unitCost,
            med.reorderThreshold,
            med.shelfLifeDays,
            med.levelOfCare || "Primary",
            med.sourcePage || 1,
            "real",
            med.sourceDataset || "nlem_2022"
          ]
        );
      }
      console.log(`  ✓ Ingested ${medicinesList.length} real NLEM medicines (data_origin: real)`);

      // 2. Ingest Real Weather from Open-Meteo
      let weatherRowCount = 0;
      for (const distKey of node.weatherDistricts) {
        const distWeather = weatherData[distKey];
        if (!distWeather) continue;

        const loc = distWeather.location;
        const archive = distWeather.archive;
        if (archive && archive.time) {
          for (let i = 0; i < archive.time.length; i++) {
            await exec.query(
              `INSERT INTO ${node.schema}.weather_daily (time, district, lat, lng, precipitation_sum_mm, temperature_max_c, temperature_min_c, is_forecast, data_origin, source_dataset)
               VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'real', 'open_meteo_archive');`,
              [
                archive.time[i],
                loc.district,
                loc.lat,
                loc.lng,
                archive.precipitation_sum[i] ?? 0,
                archive.temperature_2m_max[i] ?? 28,
                archive.temperature_2m_min[i] ?? 18,
              ]
            );
            weatherRowCount++;
          }
        }

        const forecast = distWeather.forecast;
        if (forecast && forecast.time) {
          for (let i = 0; i < forecast.time.length; i++) {
            await exec.query(
              `INSERT INTO ${node.schema}.weather_daily (time, district, lat, lng, precipitation_sum_mm, temperature_max_c, temperature_min_c, is_forecast, data_origin, source_dataset)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'real', 'open_meteo_forecast');`,
              [
                forecast.time[i],
                loc.district,
                loc.lat,
                loc.lng,
                forecast.precipitation_sum[i] ?? 0,
                forecast.temperature_2m_max[i] ?? 28,
                forecast.temperature_2m_min[i] ?? 18,
              ]
            );
            weatherRowCount++;
          }
        }
      }
      console.log(`  ✓ Ingested ${weatherRowCount} real daily weather observations & forecasts (data_origin: real)`);

      // 3. Ingest Real Facilities with Derived Population Catchment
      // Count facilities per district to derive catchment population: district population / phc count
      const districtCounts: Record<string, number> = {};
      for (const fac of node.facilities) {
        districtCounts[fac.district] = (districtCounts[fac.district] || 0) + 1;
      }

      for (const fac of node.facilities) {
        const distCensus = censusData[fac.district];
        const distTotalPop = distCensus ? distCensus.census2011Population : 1000000;
        const countInDist = districtCounts[fac.district] || 10;
        // Derived catchment population
        const catchmentPopulation = Math.round(distTotalPop / countInDist);
        const resilienceScore = randomFloat(72.0, 91.0);

        await exec.query(
          `INSERT INTO ${node.schema}.phcs (id, name, district, state, country, lat, lng, type, bed_capacity, target_population, catchment_population, resilience_score, is_active, data_origin, source_dataset)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, 'real', $13);`,
          [
            fac.id,
            fac.name,
            fac.district,
            fac.state,
            fac.country,
            fac.lat,
            fac.lng,
            fac.type,
            fac.bedCapacity,
            30000,
            catchmentPopulation,
            resilienceScore,
            fac.sourceDataset || "osm_overpass_healthcare"
          ]
        );
      }
      console.log(`  ✓ Ingested ${node.facilities.length} real health facilities with derived catchment population (data_origin: real)`);

      // 4. Generate Calibrated Simulated Operational Data (90 Days Longitudinal History)
      console.log(`  Generating calibrated operational simulation for ${node.facilities.length} facilities (90 days)...`);
      
      const targetStockoutPhcs = new Set([
        "in_kar_dk_ullal",
        "in_kar_kalaburagi_aland",
        "in_kar_bengaluru_nelamangala"
      ]);

      const stockLevelsBatch: any[] = [];
      const bedStatusBatch: any[] = [];
      const staffAttendanceBatch: any[] = [];
      const footfallBatch: any[] = [];

      for (const fac of node.facilities) {
        const isStockoutTarget = targetStockoutPhcs.has(fac.id) || fac.name.includes("Ullal") || fac.name.includes("Aland") || fac.name.includes("Nelamangala");
        const isCoastalOrKalaburagi = fac.district === "Dakshina Kannada" || fac.district === "Kalaburagi";

        // Current stock inventory tracker per medicine
        const currentStock: Record<string, number> = {};
        for (const med of medicinesList) {
          currentStock[med.id] = randomInt(med.reorderThreshold * 2, med.reorderThreshold * 4);
        }

        for (let dayOffset = numDays - 1; dayOffset >= 0; dayOffset--) {
          const date = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
          const month = date.getMonth(); // 5 = June, 6 = July, 7 = Aug, 8 = Sept
          const isMonsoon = month >= 5 && month <= 8;
          const isLastWeek = dayOffset <= 7;
          const isFestival = dayOffset >= 10 && dayOffset <= 14;

          // Real disease seasonality priors
          let monsoonMultiplier = 1.0;
          if (isMonsoon && isCoastalOrKalaburagi) {
            monsoonMultiplier = seasonalityData.diarrhea?.peakMultiplier ?? 2.4;
          }

          let festivalMultiplier = isFestival ? 1.3 : 1.0;

          // 4a. Footfall calibrated on catchment population
          const catchmentPop = fac.catchmentPopulation || 35000;
          const baseOpd = Math.max(30, Math.round((catchmentPop / 1000) * 2.2));
          const opdTotal = Math.round((baseOpd + randomInt(-8, 12)) * monsoonMultiplier * festivalMultiplier);

          const feverRate = isMonsoon ? 0.38 : 0.22;
          const diarrheaRate = isMonsoon ? 0.32 : 0.15;
          const respiratoryRate = 0.20;
          const generalRate = Math.max(0.1, 1.0 - (feverRate + diarrheaRate + respiratoryRate));

          const feverCount = Math.round(opdTotal * feverRate);
          const diarrheaCount = Math.round(opdTotal * diarrheaRate);
          const respiratoryCount = Math.round(opdTotal * respiratoryRate);
          const generalCount = Math.max(0, opdTotal - feverCount - diarrheaCount - respiratoryCount);

          const timeStr = date.toISOString();

          footfallBatch.push([timeStr, fac.id, feverCount, "fever", "simulated", "calibrated_simulator"]);
          footfallBatch.push([timeStr, fac.id, diarrheaCount, "diarrhea", "simulated", "calibrated_simulator"]);
          footfallBatch.push([timeStr, fac.id, respiratoryCount, "respiratory", "simulated", "calibrated_simulator"]);
          footfallBatch.push([timeStr, fac.id, generalCount, "general", "simulated", "calibrated_simulator"]);

          // 4b. Bed Status
          const totalBeds = fac.bedCapacity;
          let occupiedBeds = randomInt(Math.round(totalBeds * 0.45), Math.round(totalBeds * 0.85));
          if (isMonsoon && isCoastalOrKalaburagi) {
            occupiedBeds = Math.min(totalBeds, Math.round(occupiedBeds * 1.25));
          }
          const criticalCare = Math.min(4, Math.max(1, Math.round(totalBeds * 0.15)));
          const oxygenBeds = Math.min(6, Math.max(2, Math.round(totalBeds * 0.25)));

          bedStatusBatch.push([timeStr, fac.id, totalBeds, occupiedBeds, criticalCare, oxygenBeds, "simulated", "calibrated_simulator"]);

          // 4c. Staff Attendance
          const reqDoctors = fac.type === "CHC" ? 4 : 2;
          const reqNurses = fac.type === "CHC" ? 8 : 4;
          const reqPharm = fac.type === "CHC" ? 2 : 1;
          const reqTotal = reqDoctors + reqNurses + reqPharm;

          let docPresent = reqDoctors;
          let nursePresent = reqNurses;
          let pharmPresent = reqPharm;

          if (rng() < 0.12) docPresent = Math.max(1, docPresent - 1);
          if (rng() < 0.18) nursePresent = Math.max(2, nursePresent - randomInt(1, 2));

          const staffOnDuty = docPresent + nursePresent + pharmPresent;

          staffAttendanceBatch.push([timeStr, fac.id, docPresent, nursePresent, pharmPresent, staffOnDuty, reqTotal, "simulated", "calibrated_simulator"]);

          // 4d. Stock levels & consumption
          for (const med of medicinesList) {
            let dailyConsumption = 0;
            switch (med.id) {
              case "MED_PARA":
                dailyConsumption = Math.round(feverCount * 2.8 + randomInt(10, 30));
                break;
              case "MED_AMOX":
                dailyConsumption = Math.round((feverCount + respiratoryCount) * 0.9 + randomInt(5, 15));
                break;
              case "MED_AZI":
                dailyConsumption = Math.round(respiratoryCount * 0.6 + randomInt(2, 10));
                break;
              case "MED_ORS":
                dailyConsumption = Math.round(diarrheaCount * 2.4 + (isMonsoon ? randomInt(20, 50) : randomInt(5, 15)));
                break;
              case "MED_IFA":
                dailyConsumption = randomInt(25, 60);
                break;
              case "MED_AL":
                dailyConsumption = isMonsoon && isCoastalOrKalaburagi ? Math.round(feverCount * 0.6 + randomInt(5, 18)) : randomInt(1, 5);
                break;
              case "MED_INS":
                dailyConsumption = randomInt(1, 4);
                break;
              default:
                dailyConsumption = randomInt(5, 20);
            }

            // Severe depletion for target near-stockout PHCs in final 7 days
            if (isStockoutTarget && isLastWeek) {
              if (fac.name.includes("Ullal") && (med.id === "MED_ORS" || med.id === "MED_AL")) {
                dailyConsumption = Math.round(dailyConsumption * 3.5);
              } else if (fac.name.includes("Aland") && (med.id === "MED_PARA" || med.id === "MED_AZI")) {
                dailyConsumption = Math.round(dailyConsumption * 3.8);
              } else if (fac.name.includes("Nelamangala") && med.id === "MED_INS") {
                dailyConsumption = Math.round(dailyConsumption * 4.0);
              }
            }

            currentStock[med.id] = Math.max(0, currentStock[med.id] - dailyConsumption);

            // Reorder restocking event if stock drops below 40% reorder threshold
            if (currentStock[med.id] < med.reorderThreshold * 0.4 && !(isStockoutTarget && isLastWeek)) {
              currentStock[med.id] += Math.round(med.reorderThreshold * randomFloat(2.5, 4.0));
            }

            const daysCover = dailyConsumption > 0 ? parseFloat((currentStock[med.id] / dailyConsumption).toFixed(1)) : 30.0;
            const expiryDate = new Date(date.getTime() + med.shelfLifeDays * 24 * 60 * 60 * 1000).toISOString();

            stockLevelsBatch.push([
              timeStr,
              fac.id,
              med.id,
              currentStock[med.id],
              med.reorderThreshold,
              expiryDate,
              daysCover,
              "system_sync",
              "simulated",
              "calibrated_simulator"
            ]);
          }
        }
      }

      // Fast multi-row chunk insertion helper
      async function insertBatch(table: string, columns: string[], rows: any[][], chunkSize = 200) {
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valueClauses: string[] = [];
          const params: any[] = [];
          let paramIdx = 1;

          for (const row of chunk) {
            const placeholders = row.map(() => `$${paramIdx++}`).join(", ");
            valueClauses.push(`(${placeholders})`);
            params.push(...row);
          }

          const sql = `INSERT INTO ${node.schema}.${table} (${columns.join(", ")}) VALUES ${valueClauses.join(", ")};`;
          await exec.query(sql, params);
        }
      }

      console.log(`  Writing batches for ${node.schema}...`);
      await insertBatch("patient_footfall", ["time", "phc_id", "opd_count", "symptom_category", "data_origin", "source_dataset"], footfallBatch);
      await insertBatch("bed_status", ["time", "phc_id", "total_beds", "occupied_beds", "critical_care_beds", "available_oxygen_beds", "data_origin", "source_dataset"], bedStatusBatch);
      await insertBatch("staff_attendance", ["time", "phc_id", "doctors_present", "nurses_present", "pharmacists_present", "staff_on_duty", "required_staff", "data_origin", "source_dataset"], staffAttendanceBatch);
      await insertBatch("stock_levels", ["time", "phc_id", "medicine_id", "qty", "reorder_threshold", "expiry_date", "days_of_cover", "source", "data_origin", "source_dataset"], stockLevelsBatch);

      console.log(`  ✓ Inserted ${footfallBatch.length} patient footfall rows (simulated)`);
      console.log(`  ✓ Inserted ${bedStatusBatch.length} bed status rows (simulated)`);
      console.log(`  ✓ Inserted ${staffAttendanceBatch.length} staff attendance rows (simulated)`);
      console.log(`  ✓ Inserted ${stockLevelsBatch.length} stock levels rows (simulated)`);

      // 5. Seed Alerts for near-stockout PHCs
      const alertsData = [
        {
          id: `alert_${node.schema}_1`,
          phcId: node.facilities[0]?.id || "phc_1",
          district: node.facilities[0]?.district || "District",
          severity: "critical",
          alertType: "stockout_risk",
          title: "Critical ORS & Antimalarial Buffer Depletion",
          message: "Days of cover < 2.5 days following localized monsoon surge. Immediate buffer dispatch required.",
        },
        {
          id: `alert_${node.schema}_2`,
          phcId: node.facilities[1]?.id || "phc_2",
          district: node.facilities[1]?.district || "District",
          severity: "warning",
          alertType: "epidemic_spike",
          title: "Acute Febrile Illness CUSUM Spike Detected",
          message: "Weekly fever footfall exceeded baseline mean by 2.8 standard deviations.",
        }
      ];

      for (const a of alertsData) {
        await exec.query(
          `INSERT INTO ${node.schema}.alerts (id, time, phc_id, district, severity, alert_type, title, message, status, data_origin, source_dataset)
           VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, 'active', 'derived', 'cusum_detector');`,
          [a.id, a.phcId, a.district, a.severity, a.alertType, a.title, a.message]
        );
      }

      // 6. Seed Redistribution Plans
      const planMoves = [
        {
          fromPhcId: node.facilities[3]?.id || "from_phc",
          fromPhcName: node.facilities[3]?.name || "Surplus Depot PHC",
          toPhcId: node.facilities[0]?.id || "to_phc",
          toPhcName: node.facilities[0]?.name || "Critical Deficit PHC",
          medicineId: "MED_ORS",
          medicineName: "Oral Rehydration Salts (ORS)",
          quantity: 650,
          costEstimate: 420.0,
          distanceKm: 28.4
        }
      ];

      await exec.query(
        `INSERT INTO ${node.schema}.redistribution_plans (id, created_at, status, moves_json, total_cost_estimate, explanation, triggered_by, data_origin, source_dataset)
         VALUES ($1, NOW(), 'recommended', $2, 420.0, $3, 'optimizer', 'derived', 'or_tools_optimizer');`,
        [
          `plan_${node.schema}_latest`,
          JSON.stringify(planMoves),
          "Emergency cross-district replenishment triggered by low days-of-cover (<3 days). Minimizes transit cost while resolving acute stockout risk."
        ]
      );

      // 7. Seed Daily Briefing
      const briefingMarkdown = `## Sovereign Health Intelligence Briefing (${node.country} - ${node.state})
**Generated Baseline:** September 29, 2026
- **Real Facilities Monitored:** ${node.facilities.length} Primary and Community Health Centres with verified geographic coordinates.
- **Meteorological Context:** Real precipitation and temperature series loaded from Open-Meteo archive.
- **Supply Chain Status:** Active alerts flagged for acute monsoon supply buffers; recommended cross-facility stock rebalancing pending district approval.`;

      await exec.query(
        `INSERT INTO ${node.schema}.briefings (id, date, district, content_markdown, generated_by, key_actions_json, created_at, data_origin, source_dataset)
         VALUES ($1, '2026-09-29', $2, $3, 'gemini-copilot', $4, NOW(), 'derived', 'gemini_copilot');`,
        [
          `briefing_${node.schema}_today`,
          node.facilities[0]?.district || "Statewide",
          briefingMarkdown,
          JSON.stringify(["Approve emergency ORS redistribution", "Monitor high-rainfall river basin PHCs"])
        ]
      );
    }

    console.log("\n=================================================================");
    console.log("  DATA INGESTION COMPLETED SUCCESSFULLY");
    console.log("=================================================================");
  } catch (error) {
    console.error("FATAL ERROR in data loader:", error);
    throw error;
  } finally {
    await close();
  }
}

if (require.main === module || process.argv[1]?.includes("load-data") || process.argv[1]?.includes("seed")) {
  loadData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
