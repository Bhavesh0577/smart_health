import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "raw", "seasonality", "disease_seasonality_karnataka.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: "Seasonality parameters not found" }, { status: 404 });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    return NextResponse.json({
      success: true,
      data_origin: "real",
      source_dataset: "idsp_nvbdcp_karnataka",
      scope: "Macro-epidemiological calibration priors (not patient-level truth)",
      parameters: data,
      disclaimer: "These parameters reflect published state surveillance profiles from IDSP & NVBDCP Karnataka. They are utilized to calibrate baseline disease progression without fabricating patient-level or individual PHC telemetry.",
    });
  } catch (error) {
    console.error("Seasonality API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
