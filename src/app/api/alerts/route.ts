import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTablesForNode } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { detectAnomaly } from "@/lib/ml-client";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") || "node_in_karnataka";
    const status = searchParams.get("status") || "active";
    const severity = searchParams.get("severity") || "all";
    const district = searchParams.get("district") || undefined;

    const db = getDb();
    const tables = getTablesForNode(node);

    const query = db.select().from(tables.alerts);
    const rows = await query.orderBy(desc(tables.alerts.time));

    let filtered = rows;
    if (status !== "all") {
      filtered = filtered.filter((r: any) => r.status === status);
    }
    if (severity !== "all") {
      filtered = filtered.filter((r: any) => r.severity === severity);
    }
    if (district && district !== "All Districts") {
      filtered = filtered.filter((r: any) => r.district === district);
    }

    // Join PHC names for rich display
    const phcs = await db.select().from(tables.phcs);
    const phcMap = new Map(phcs.map((p: any) => [p.id, p]));

    const result = filtered.map((a: any) => {
      const phc = phcMap.get(a.phcId) as any;
      return {
        id: a.id,
        time: a.time ? new Date(a.time).toISOString() : new Date().toISOString(),
        phcId: a.phcId,
        phcName: phc?.name || a.phcId,
        district: a.district,
        severity: a.severity,
        alertType: a.alertType,
        title: a.title,
        message: a.message,
        status: a.status,
        resolvedAt: a.resolvedAt,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Alerts API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

const alertActionSchema = z.object({
  action: z.enum(["resolve", "scan"]),
  node: z.string().default("node_in_karnataka"),
  alertId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, node, alertId } = alertActionSchema.parse(body);
    const db = getDb();
    const tables = getTablesForNode(node);

    if (action === "resolve" && alertId) {
      await db
        .update(tables.alerts)
        .set({ status: "resolved", resolvedAt: new Date() })
        .where(eq(tables.alerts.id, alertId));

      return NextResponse.json({ success: true, message: `Alert ${alertId} resolved.` });
    }

    if (action === "scan") {
      // Scan for footfall & stock anomalies across facilities
      const phcs = await db.select().from(tables.phcs).limit(15);
      const generatedAlerts: any[] = [];

      for (const phc of phcs) {
        const footfalls = await db
          .select()
          .from(tables.patientFootfall)
          .where(eq(tables.patientFootfall.phcId, phc.id))
          .orderBy(desc(tables.patientFootfall.time))
          .limit(28);

        const feverSeries = footfalls
          .filter((f: any) => f.symptomCategory === "fever")
          .map((f: any) => f.opdCount)
          .reverse();

        if (feverSeries.length >= 7) {
          const anomaly = await detectAnomaly({
            series_name: "acute_fever",
            values: feverSeries,
          });

          if (anomaly.is_anomaly && anomaly.severity === "critical") {
            const newAlertId = `alt_dyn_${phc.id}_${Date.now()}`;
            await db.insert(tables.alerts).values({
              id: newAlertId,
              time: new Date(),
              phcId: phc.id,
              district: phc.district,
              severity: "critical",
              alertType: "epidemic_spike",
              title: `Epidemic Anomaly Triggered at ${phc.name}`,
              message: anomaly.explanation,
              status: "active",
            }).onConflictDoNothing();

            generatedAlerts.push({ id: newAlertId, phc: phc.name, explanation: anomaly.explanation });
          }
        }
      }

      return NextResponse.json({
        success: true,
        scannedFacilitiesCount: phcs.length,
        anomaliesDiscovered: generatedAlerts.length,
        alerts: generatedAlerts,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Alerts POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
