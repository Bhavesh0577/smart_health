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

  // 1. Weather & Climate Risks
  try {
    console.log("Step 1/5: [Weather & Climate Risks]");
    console.log("  Portal: mausam.imd.gov.in or open-meteo.com");
    console.log("  Search Terms: \"IMD Daily Rainfall Karnataka\", \"Open-Meteo Historical Weather API\"");
    const weather = await fetchWeatherDaily();
    const weatherFile = path.join(process.cwd(), "data", "raw", "weather", "karnataka_weather_daily.json");
    results["weather_climate"] = {
      status: "SUCCESS (Real)",
      path: "data/raw/weather/karnataka_weather_daily.json",
      checksum: computeChecksum(weatherFile),
      records: Object.keys(weather).length,
    };
  } catch (err: any) {
    console.error("  Weather fetch failed:", err.message);
    results["weather_climate"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 2. PHC & CHC Directory
  try {
    console.log("\nStep 2/5: [PHC & CHC Directory]");
    console.log("  Portal: data.gov.in (Open Government Data - OGD)");
    console.log("  Search Terms: \"All India Health Centres Directory\", \"Karnataka PHC list\"");
    const facilities = await fetchRealFacilities();
    const karFacFile = path.join(process.cwd(), "data", "raw", "facilities", "karnataka_facilities.json");
    results["phc_chc_directory"] = {
      status: "SUCCESS (Real)",
      path: "data/raw/facilities/karnataka_facilities.json",
      checksum: computeChecksum(karFacFile),
      records: facilities.karnataka.length,
    };
  } catch (err: any) {
    console.error("  Facilities fetch failed:", err.message);
    results["phc_chc_directory"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 3. Essential Medicines Catalog
  try {
    console.log("\nStep 3/5: [Essential Medicines Catalog]");
    console.log("  Portal: cdsco.gov.in & mohfw.gov.in");
    console.log("  Search Terms: \"National List of Essential Medicines 2022\", \"NLEM 2022 PDF\"");
    const meds = await fetchMedicines();
    const medFile = path.join(process.cwd(), "data", "processed", "nlem_primary_care.json");
    results["essential_medicines"] = {
      status: "SUCCESS (Real)",
      path: "data/processed/nlem_primary_care.json",
      checksum: computeChecksum(medFile),
      records: meds.length,
    };
  } catch (err: any) {
    console.error("  Medicines fetch failed:", err.message);
    results["essential_medicines"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 4. District Population & Catchment
  try {
    console.log("\nStep 4/5: [District Population & Catchment]");
    console.log("  Portal: censusindia.gov.in");
    console.log("  Search Terms: \"Primary Census Abstract 2011 Karnataka\", \"PCA District Data\"");
    const pop = await fetchDistrictPopulations();
    const popFile = path.join(process.cwd(), "data", "raw", "population", "karnataka_census_2011.json");
    results["district_population"] = {
      status: "SUCCESS (Real & Derived)",
      path: "data/raw/population/karnataka_census_2011.json",
      checksum: computeChecksum(popFile),
      records: Object.keys(pop).length,
    };
  } catch (err: any) {
    console.error("  Population fetch failed:", err.message);
    results["district_population"] = { status: "FAILED", path: "", checksum: "", records: 0 };
  }

  // 5. Disease Outbreak Surveillance
  try {
    console.log("\nStep 5/5: [Disease Outbreak Surveillance]");
    console.log("  Portal: idsp.mohfw.gov.in (NCDC / IDSP)");
    console.log("  Search Terms: \"IDSP Weekly Outbreak Surveillance\", \"Karnataka disease weekly bulletin\"");
    const seas = await fetchSeasonalityProfiles();
    const seasFile = path.join(process.cwd(), "data", "raw", "seasonality", "disease_seasonality_karnataka.json");
    results["disease_surveillance"] = {
      status: "SUCCESS (Real Calibration)",
      path: "data/raw/seasonality/disease_seasonality_karnataka.json",
      checksum: computeChecksum(seasFile),
      records: Object.keys(seas).length,
    };
  } catch (err: any) {
    console.error("  Seasonality fetch failed:", err.message);
    results["disease_surveillance"] = { status: "FAILED", path: "", checksum: "", records: 0 };
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
