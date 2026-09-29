import { NextRequest, NextResponse } from "next/server";
import { WebhookAdapter } from "@/lib/adapters/webhook-adapter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBodyString = await req.text();
    const signature = req.headers.get("x-phc-signature") || undefined;

    let body: any;
    try {
      body = JSON.parse(rawBodyString);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON payload in request body" }, { status: 400 });
    }

    const adapter = new WebhookAdapter();
    const result = await adapter.ingest({
      body,
      signature,
      rawBodyString,
    });

    return NextResponse.json({
      success: result.success,
      data: result,
    }, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Webhook Ingestion API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
