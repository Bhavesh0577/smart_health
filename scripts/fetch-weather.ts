import fs from "fs";
import path from "path";

interface LocationTarget {
  name: string;
  district: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
}

const TARGET_LOCATIONS: LocationTarget[] = [
  // Karnataka 5 Focus Districts
  { name: "Bengaluru Urban Centroid", district: "Bengaluru Urban", state: "Karnataka", country: "India", lat: 12.9716, lng: 77.5946 },
  { name: "Belagavi Centroid", district: "Belagavi", state: "Karnataka", country: "India", lat: 15.8497, lng: 74.4977 },
  { name: "Kalaburagi Centroid", district: "Kalaburagi", state: "Karnataka", country: "India", lat: 17.3297, lng: 76.8343 },
  { name: "Mysuru Centroid", district: "Mysuru", state: "Karnataka", country: "India", lat: 12.2958, lng: 76.6394 },
  { name: "Dakshina Kannada Centroid", district: "Dakshina Kannada", state: "Karnataka", country: "India", lat: 12.8703, lng: 74.8806 },
  // Bahia, Brazil
  { name: "Salvador Centroid", district: "Salvador", state: "Bahia", country: "Brazil", lat: -12.9777, lng: -38.5016 },
  // KwaZulu-Natal, South Africa
  { name: "eThekwini Centroid", district: "eThekwini", state: "KwaZulu-Natal", country: "South Africa", lat: -29.8587, lng: 31.0218 },
];

async function fetchWithRetry(url: string, retries = 3, delayMs = 1500): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`  [Retry ${attempt}/${retries}] Fetch failed (${err.message}). Retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
}

export async function fetchWeatherDaily(force = false) {
  const outputDir = path.join(process.cwd(), "data", "raw", "weather");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, "karnataka_weather_daily.json");

  if (!force && fs.existsSync(outputFile)) {
    console.log(`[Weather] Using existing cached dataset at: ${outputFile}`);
    const raw = fs.readFileSync(outputFile, "utf-8");
    return JSON.parse(raw);
  }

  console.log(`[Weather] Fetching 3-year historical archive + 16-day forecast from Open-Meteo API...`);
  const aggregatedResults: Record<string, any> = {};

  const startDate = "2023-01-01";
  const endDate = "2026-09-29";

  for (const loc of TARGET_LOCATIONS) {
    console.log(`  Fetching weather for ${loc.district} (${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)})...`);

    // 1. Archive API (Daily 2023-2026)
    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lng}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;

    // 2. Forecast API (16-day live outlook)
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=16&timezone=auto`;

    try {
      const [archiveData, forecastData] = await Promise.all([
        fetchWithRetry(archiveUrl),
        fetchWithRetry(forecastUrl),
      ]);

      aggregatedResults[loc.district] = {
        location: loc,
        archive: archiveData.daily || null,
        forecast: forecastData.daily || null,
        metadata: {
          archiveUrl,
          forecastUrl,
          fetchedAt: new Date().toISOString(),
          dataOrigin: "real",
          license: "CC BY 4.0 Open-Meteo",
        },
      };

      const recordCount = archiveData.daily?.time?.length || 0;
      console.log(`    ✓ Received ${recordCount} daily observations + 16-day forecast for ${loc.district}`);
    } catch (err: any) {
      console.error(`    ✗ Failed fetching weather for ${loc.district}:`, err.message);
    }

    // Rate-limit courteous delay (300ms between district calls)
    await new Promise((r) => setTimeout(r, 300));
  }

  fs.writeFileSync(outputFile, JSON.stringify(aggregatedResults, null, 2), "utf-8");
  console.log(`[Weather] Successfully saved Open-Meteo dataset to: ${outputFile}`);
  return aggregatedResults;
}

if (require.main === module || process.argv[1]?.includes("fetch-weather")) {
  fetchWeatherDaily(process.argv.includes("--force"))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Fatal weather fetch error:", err);
      process.exit(1);
    });
}
