import { IngestionAdapter, IngestResult, ValidationIssue } from "./index";
import { getDb } from "@/lib/db";
import { getTablesForNode } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type CsvTargetType = "stock" | "beds" | "staff" | "footfall";

export class CsvUploadAdapter implements IngestionAdapter {
  name = "CSV Batch Ingestion Adapter";
  type = "csv_upload" as const;
  dataOrigin = "real" as const;
  description = "Validates and ingests user-uploaded clinical and inventory CSV files with schema enforcement and rejection reporting.";

  parseCsv(csvContent: string): { headers: string[]; rows: string[][] } {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
    return { headers, rows };
  }

  async validate(
    rawPayload: { targetType: CsvTargetType; csvContent: string },
    context: { node?: string } = {}
  ): Promise<{ isValid: boolean; issues: ValidationIssue[] }> {
    const issues: ValidationIssue[] = [];
    const { targetType, csvContent } = rawPayload;

    if (!csvContent || csvContent.trim().length === 0) {
      issues.push({ message: "CSV content is empty", severity: "error" });
      return { isValid: false, issues };
    }

    const { headers, rows } = this.parseCsv(csvContent);
    if (rows.length === 0) {
      issues.push({ message: "No data rows found in CSV (header only or empty file)", severity: "error" });
      return { isValid: false, issues };
    }

    const node = context.node || "node_in_karnataka";
    const db = getDb();
    const tables = getTablesForNode(node);

    // Fetch valid PHCs and medicines to cross-validate foreign keys
    const phcRecords = await db.select().from(tables.phcs);
    const validPhcIds = new Set(phcRecords.map((p: any) => p.id));

    const medicineRecords = await db.select().from(tables.medicines);
    const validMedCodes = new Map(medicineRecords.map((m: any) => [m.code, m.id]));

    // Target-specific schema rules
    const expectedHeaders: Record<CsvTargetType, string[]> = {
      stock: ["time", "phc_id", "medicine_code", "qty", "reorder_threshold", "expiry_date", "days_of_cover", "source"],
      beds: ["time", "phc_id", "total_beds", "occupied_beds", "critical_care_beds", "available_oxygen_beds"],
      staff: ["time", "phc_id", "doctors_present", "nurses_present", "pharmacists_present", "staff_on_duty", "required_staff"],
      footfall: ["time", "phc_id", "opd_count", "symptom_category"],
    };

    const required = expectedHeaders[targetType] || [];
    for (const reqCol of required) {
      if (!headers.includes(reqCol)) {
        issues.push({
          message: `Missing required column '${reqCol}' for ${targetType} ingestion`,
          severity: "error",
        });
      }
    }

    if (issues.some((i) => i.severity === "error")) {
      return { isValid: false, issues };
    }

    // Row-level validation
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const rowNum = rIdx + 2; // 1-indexed including header
      const rowData: Record<string, string> = {};
      headers.forEach((h, i) => {
        rowData[h] = row[i] ?? "";
      });

      // 1. Time validation
      if (!rowData.time || isNaN(Date.parse(rowData.time))) {
        issues.push({ row: rowNum, field: "time", value: rowData.time, message: "Invalid date format in 'time'", severity: "error" });
      }

      // 2. PHC ID validation
      if (!rowData.phc_id || !validPhcIds.has(rowData.phc_id)) {
        issues.push({ row: rowNum, field: "phc_id", value: rowData.phc_id, message: `Facility '${rowData.phc_id}' not found in node registry`, severity: "error" });
      }

      // 3. Target specific validation
      if (targetType === "stock") {
        const medCode = rowData.medicine_code;
        if (!medCode || !validMedCodes.has(medCode)) {
          issues.push({ row: rowNum, field: "medicine_code", value: medCode, message: `Unknown medicine code '${medCode}'`, severity: "error" });
        }
        const qty = parseInt(rowData.qty, 10);
        if (isNaN(qty) || qty < 0) {
          issues.push({ row: rowNum, field: "qty", value: rowData.qty, message: "Quantity must be a non-negative integer", severity: "error" });
        }
      } else if (targetType === "beds") {
        const total = parseInt(rowData.total_beds, 10);
        const occ = parseInt(rowData.occupied_beds, 10);
        if (isNaN(total) || total < 1) {
          issues.push({ row: rowNum, field: "total_beds", value: rowData.total_beds, message: "Total beds must be positive", severity: "error" });
        }
        if (isNaN(occ) || occ < 0) {
          issues.push({ row: rowNum, field: "occupied_beds", value: rowData.occupied_beds, message: "Occupied beds must be non-negative", severity: "error" });
        }
        if (occ > total) {
          issues.push({ row: rowNum, field: "occupied_beds", value: rowData.occupied_beds, message: "Occupied beds exceeds total beds", severity: "warning" });
        }
      } else if (targetType === "staff") {
        const onDuty = parseInt(rowData.staff_on_duty, 10);
        const reqStaff = parseInt(rowData.required_staff, 10);
        if (isNaN(onDuty) || onDuty < 0) {
          issues.push({ row: rowNum, field: "staff_on_duty", value: rowData.staff_on_duty, message: "Staff on duty must be non-negative", severity: "error" });
        }
        if (isNaN(reqStaff) || reqStaff < 1) {
          issues.push({ row: rowNum, field: "required_staff", value: rowData.required_staff, message: "Required staff must be >= 1", severity: "error" });
        }
      } else if (targetType === "footfall") {
        const opd = parseInt(rowData.opd_count, 10);
        if (isNaN(opd) || opd < 0) {
          issues.push({ row: rowNum, field: "opd_count", value: rowData.opd_count, message: "OPD count must be non-negative", severity: "error" });
        }
        const validCategories = ["fever", "diarrhea", "respiratory", "general", "maternal", "trauma"];
        if (!validCategories.includes(rowData.symptom_category?.toLowerCase())) {
          issues.push({ row: rowNum, field: "symptom_category", value: rowData.symptom_category, message: `Invalid symptom category '${rowData.symptom_category}'`, severity: "error" });
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    return { isValid: !hasErrors, issues };
  }

  async ingest(
    rawPayload: { targetType: CsvTargetType; csvContent: string },
    context: { node?: string } = {}
  ): Promise<IngestResult> {
    const node = context.node || "node_in_karnataka";
    const db = getDb();
    const tables = getTablesForNode(node);

    const { isValid, issues } = await this.validate(rawPayload, context);
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    const { headers, rows } = this.parseCsv(rawPayload.csvContent);

    if (!isValid) {
      return {
        success: false,
        adapterName: this.name,
        sourceType: this.type,
        dataOrigin: this.dataOrigin,
        datasetName: rawPayload.targetType,
        rowsProcessed: rows.length,
        rowsAccepted: 0,
        rowsRejected: rows.length,
        errors,
        warnings,
        summary: `Validation failed with ${errors.length} errors across ${rows.length} rows. No rows committed.`,
      };
    }

    // Medicine lookup mapping
    const medicineRecords = await db.select().from(tables.medicines);
    const medMap = new Map(medicineRecords.map((m: any) => [m.code, m.id]));

    let acceptedCount = 0;

    for (const row of rows) {
      const rowData: Record<string, string> = {};
      headers.forEach((h, i) => {
        rowData[h] = row[i];
      });

      const timeVal = new Date(rowData.time);

      if (rawPayload.targetType === "stock") {
        const medId = medMap.get(rowData.medicine_code)!;
        await db.insert(tables.stockLevels).values({
          time: timeVal,
          phcId: rowData.phc_id,
          medicineId: medId,
          qty: parseInt(rowData.qty, 10),
          reorderThreshold: parseInt(rowData.reorder_threshold, 10) || 500,
          expiryDate: new Date(rowData.expiry_date || Date.now() + 365 * 24 * 60 * 60 * 1000),
          daysOfCover: parseFloat(rowData.days_of_cover) || 20.0,
          source: rowData.source || "csv_upload",
          dataOrigin: "real",
          sourceDataset: "csv_upload_adapter",
        });
        acceptedCount++;
      } else if (rawPayload.targetType === "beds") {
        await db.insert(tables.bedStatus).values({
          time: timeVal,
          phcId: rowData.phc_id,
          totalBeds: parseInt(rowData.total_beds, 10),
          occupiedBeds: parseInt(rowData.occupied_beds, 10),
          criticalCareBeds: parseInt(rowData.critical_care_beds, 10) || 2,
          availableOxygenBeds: parseInt(rowData.available_oxygen_beds, 10) || 4,
          dataOrigin: "real",
          sourceDataset: "csv_upload_adapter",
        });
        acceptedCount++;
      } else if (rawPayload.targetType === "staff") {
        await db.insert(tables.staffAttendance).values({
          time: timeVal,
          phcId: rowData.phc_id,
          doctorsPresent: parseInt(rowData.doctors_present, 10) || 1,
          nursesPresent: parseInt(rowData.nurses_present, 10) || 2,
          pharmacistsPresent: parseInt(rowData.pharmacists_present, 10) || 1,
          staffOnDuty: parseInt(rowData.staff_on_duty, 10),
          requiredStaff: parseInt(rowData.required_staff, 10),
          dataOrigin: "real",
          sourceDataset: "csv_upload_adapter",
        });
        acceptedCount++;
      } else if (rawPayload.targetType === "footfall") {
        await db.insert(tables.patientFootfall).values({
          time: timeVal,
          phcId: rowData.phc_id,
          opdCount: parseInt(rowData.opd_count, 10),
          symptomCategory: rowData.symptom_category.toLowerCase(),
          dataOrigin: "real",
          sourceDataset: "csv_upload_adapter",
        });
        acceptedCount++;
      }
    }

    return {
      success: true,
      adapterName: this.name,
      sourceType: this.type,
      dataOrigin: this.dataOrigin,
      datasetName: rawPayload.targetType,
      rowsProcessed: rows.length,
      rowsAccepted: acceptedCount,
      rowsRejected: 0,
      errors: [],
      warnings,
      summary: `Successfully ingested ${acceptedCount} real ${rawPayload.targetType} rows (data_origin: real).`,
    };
  }
}
