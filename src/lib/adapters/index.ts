export type IngestionSource = "csv_upload" | "webhook" | "hmis" | "simulator";
export type DataOriginType = "real" | "derived" | "simulated";

export interface ValidationIssue {
  row?: number;
  field?: string;
  value?: any;
  message: string;
  severity: "error" | "warning";
}

export interface IngestResult {
  success: boolean;
  adapterName: string;
  sourceType: IngestionSource;
  dataOrigin: DataOriginType;
  datasetName: string;
  rowsProcessed: number;
  rowsAccepted: number;
  rowsRejected: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: string;
}

export interface IngestionAdapter {
  name: string;
  type: IngestionSource;
  dataOrigin: DataOriginType;
  description: string;
  validate(rawPayload: any, context?: any): Promise<{ isValid: boolean; issues: ValidationIssue[] }>;
  ingest(rawPayload: any, context?: any): Promise<IngestResult>;
}

export * from "./csv-upload-adapter";
export * from "./webhook-adapter";
export * from "./hmis-adapter";
export * from "./simulator-adapter";
