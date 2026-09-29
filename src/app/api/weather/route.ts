import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTablesForNode } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";
    const district = searchParams.get("district") || "Bengaluru Urban";
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const db = getDb();
    const tables = getTablesForNode(node);

    const rows = await db
      .select()
      .from(tables.weatherDaily)
      .where(eq(tables.weatherDaily.district, district))
      .orderBy(desc(tables.weatherDaily.time))
      .limit(limit * 2);

    const historical = rows
      .filter((r: any) => !r.isForecast)
      .slice(0, limit)
      .reverse();

    const forecast = rows
      .filter((r: any) => r.isForecast)
      .slice(0, 16)
      .reverse();

    // Outbreak risk assessment based on recent & projected rainfall
    const forecastRainSum = forecast.reduce((acc: number, cur: any) => acc + cur.precipitationSumMm, 0);
    const maxDayRain = forecast.length ? Math.max(...forecast.map((f: any) => f.precipitationSumMm)) : 0;
    
    let epidemicRisk: "low" | "moderate" | "high" | "severe" = "low";
    let riskReason = "Normal precipitation patterns observed.";

    if (maxDayRain > 40.0 || forecastRainSum > 120.0) {
      epidemicRisk = "severe";
      riskReason = "Severe precipitation expected (>40mm/day). High probability of water-borne diarrheal outbreak and vector breeding within 4-14 days.";
    } else if (maxDayRain > 20.0 || forecastRainSum > 60.0) {
      epidemicRisk = "high";
      riskReason = "Substantial precipitation surge (>20mm/day). Heightened diarrheal and acute fever presentation anticipated.";
    } else if (maxDayRain > 8.0) {
      epidemicRisk = "moderate";
      riskReason = "Moderate seasonal rains; localized standing water risk.";
    }

    return NextResponse.json({
      success: true,
      data: {
        district,
        node,
        data_origin: "real",
        source_dataset: "open_meteo_archive_and_forecast",
        historicalCount: historical.length,
        forecastCount: forecast.length,
        epidemicRisk,
        riskReason,
        maxDayRainMm: Math.round(maxDayRain * 10) / 10,
        forecastTotalRainMm: Math.round(forecastRainSum * 10) / 10,
        historical,
        forecast,
      }
    });
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
