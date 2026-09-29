import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fetchWeatherDaily } from "./fetch-weather";
import { fetchRealFacilities } from "./fetch-facilities";
import { fetchMedicines } from "./fetch-medicines";
import { fetchDistrictPopulations } from "./fetch-population";
import { fetchSeasonalityProfiles } from "./fetch-seasonality";

function computeChecksum(filePath: string): string {
  if (!fs.existsSync(filePath)) return "FILE_NOT_FOUND";
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

export async function fetchAllData() {
  console.log("=================================================================");
  console.log("  PHC Resilience Grid: Authoritative Data Ingestion Pipeline");
  console.log("=================================================================\n");

  const results: Record<string, { status: string; path: string; checksum: string; records: number }> = {};

  // 1. Weather
  try {
    console.log("Step 1/5: Fetching real meteorological records (Open-Meteo)...");
    const weather = await fetchWeatherDaily();
    const weatherFile = path.join(process.cwd(), "data", "raw", "weather", "karnataka_weather_daily.json");
    results["weather"] = {
      status: "SUCCESS (Real)",
      path: "data/raw/weather/karnataka_weather_daily.json",
      checksum: computeChecksum(weatherFile),
      records: Object.keys(weather).length,
    };
  } catch (err: any) {
    console.error("  Weather fetch failed:", err.message);
    results["weather"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 2. Facilities
  try {
    console.log("\nStep 2/5: Ingesting verified facility master (OSM / State Directory)...");
    const facilities = await fetchRealFacilities();
    const karFacFile = path.join(process.cwd(), "data", "raw", "facilities", "karnataka_facilities.json");
    results["facilities_karnataka"] = {
      status: "SUCCESS (Real)",
      path: "data/raw/facilities/karnataka_facilities.json",
      checksum: computeChecksum(karFacFile),
      records: facilities.karnataka.length,
    };
  } catch (err: any) {
    console.error("  Facilities fetch failed:", err.message);
    results["facilities_karnataka"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 3. Medicines
  try {
    console.log("\nStep 3/5: Compiling NLEM 2022 Primary Care medicine catalog...");
    const meds = await fetchMedicines();
    const medFile = path.join(process.cwd(), "data", "processed", "nlem_primary_care.json");
    results["medicines_nlem"] = {
      status: "SUCCESS (Real)",
      path: "data/processed/nlem_primary_care.json",
      checksum: computeChecksum(medFile),
      records: meds.length,
    };
  } catch (err: any) {
    console.error("  Medicines fetch failed:", err.message);
    results["medicines_nlem"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 4. Population
  try {
    console.log("\nStep 4/5: Compiling Census of India 2011 district populations...");
    const pop = await fetchDistrictPopulations();
    const popFile = path.join(process.cwd(), "data", "raw", "population", "karnataka_census_2011.json");
    results["population_census"] = {
      status: "SUCCESS (Real)",
      path: "data/raw/population/karnataka_census_2011.json",
      checksum: computeChecksum(popFile),
      records: Object.keys(pop).length,
    };
  } catch (err: any) {
    console.error("  Population fetch failed:", err.message);
    results["population_census"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 5. Seasonality
  try {
    console.log("\nStep 5/5: Compiling IDSP / NVBDCP epidemiological calibration priors...");
    const seas = await fetchSeasonalityProfiles();
    const seasFile = path.join(process.cwd(), "data", "raw", "seasonality", "disease_seasonality_karnataka.json");
    results["seasonality_idsp"] = {
      status: "SUCCESS (Real Calibration)",
      path: "data/raw/seasonality/disease_seasonality_karnataka.json",
      checksum: computeChecksum(seasFile),
      records: Object.keys(seas).length,
    };
  } catch (err: any) {
    console.error("  Seasonality fetch failed:", err.message);
    results["seasonality_idsp"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  console.log("\n=================================================================");
  console.log("  INSPECTION SUMMARY & FILE CHECKSUMS (SHA-256)");
  console.log("=================================================================");
  for (const [key, res] of Object.entries(results)) {
    console.log(`- [${res.status}] ${key.toUpperCase()}`);
    console.log(`    File:     ${res.path}`);
    console.log(`    Records:  ${res.records}`);
    console.log(`    Checksum: ${res.checksum.substring(0, 24)}...`);
  }
  console.log("=================================================================\n");
}

if (require.main === module || process.argv[1]?.includes("fetch-all")) {
  fetchAllData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal error in data fetch pipeline:", err);
      process.exit(1);
    });
}
