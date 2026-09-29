import { NextRequest, NextResponse } from "next/server";
import { CsvUploadAdapter, CsvTargetType } from "@/lib/adapters/csv-upload-adapter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let targetType: CsvTargetType = "stock";
    let csvContent = "";
    let node = "node_in_karnataka";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      targetType = body.targetType || "stock";
      csvContent = body.csvContent || "";
      node = body.node || "node_in_karnataka";
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      targetType = (formData.get("targetType") as CsvTargetType) || "stock";
      node = (formData.get("node") as string) || "node_in_karnataka";
      const file = formData.get("file") as File;
      if (file) {
        csvContent = await file.text();
      }
    } else {
      csvContent = await req.text();
      const url = new URL(req.url);
      targetType = (url.searchParams.get("targetType") as CsvTargetType) || "stock";
      node = url.searchParams.get("node") || "node_in_karnataka";
    }

    const adapter = new CsvUploadAdapter();
    const result = await adapter.ingest(
      { targetType, csvContent },
      { node }
    );

    return NextResponse.json({
      success: result.success,
      data: result,
    }, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("CSV Ingestion Upload API error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
