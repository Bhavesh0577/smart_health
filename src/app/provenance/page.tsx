"use client";

import React, { useEffect, useState, useTransition } from "react";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  ShieldCheck,
  UploadCloud,
  FileSpreadsheet,
  Cpu,
  Radio,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Info,
  Server,
  CloudRain,
  Pill,
  Users,
} from "lucide-react";
import { useApp } from "@/lib/context/app-context";
import { toast } from "sonner";

interface TableProvenance {
  tableName: string;
  displayName: string;
  category: "Master Infrastructure" | "Environmental Covariates" | "Operational Telemetry" | "Derived Analytics";
  totalRows: number;
  realCount: number;
  derivedCount: number;
  simulatedCount: number;
  realPct: number;
  derivedPct: number;
  simulatedPct: number;
  primarySource: string;
  sourceDataset: string;
  license: string;
  methodology: string;
  limitations: string;
}

interface ProvenanceData {
  node: string;
  generatedAt: string;
  summary: {
    totalRows: number;
    realRows: number;
    derivedRows: number;
    simulatedRows: number;
    realPct: number;
    derivedPct: number;
    simulatedPct: number;
    sourcesCount: number;
    adapterCount: number;
  };
  tables: TableProvenance[];
  adapters: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    targetOrigin: "real" | "derived" | "simulated";
    description: string;
    endpointOrPath: string;
  }>;
}

export default function ProvenancePage() {
  const { selectedNode: activeNode } = useApp();
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTableType, setSelectedTableType] = useState<"stock" | "beds" | "staff" | "footfall">("stock");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const fetchProvenance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/provenance?node=${activeNode}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        toast.error("Failed to load provenance audit");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to provenance service");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProvenance();
  }, [activeNode]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please choose a CSV file first");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("tableType", selectedTableType);
      formData.append("node", activeNode);
      formData.append("sourceDataset", "manual_facility_upload");

      const res = await fetch("/api/ingestion/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      setUploadResult(json);

      if (json.success) {
        toast.success(`Successfully ingested ${json.recordsProcessed} real records!`);
        fetchProvenance();
      } else {
        toast.error(json.error || "CSV validation failed");
      }
    } catch (err: any) {
      toast.error("Upload error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Data Provenance & Source Audit</h1>
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              BRICS Track 3
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Complete transparency into data lineage, authoritative public sources, and calibrated simulation telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProvenance}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Audit
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/70 border-emerald-500/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Authoritative Real Data</span>
              <ProvenanceBadge origin="real" size="sm" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {data ? data.summary.realPct : "0"}%
            </div>
            <p className="text-[11px] text-muted-foreground">
              {data ? data.summary.realRows.toLocaleString() : "..."} verified public records
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-sky-500/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Derived Analytics</span>
              <ProvenanceBadge origin="derived" size="sm" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
              {data ? data.summary.derivedPct : "0"}%
            </div>
            <p className="text-[11px] text-muted-foreground">
              {data ? data.summary.derivedRows.toLocaleString() : "..."} algorithmic rows
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-amber-500/30">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Calibrated Simulation</span>
              <ProvenanceBadge origin="simulated" size="sm" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {data ? data.summary.simulatedPct : "0"}%
            </div>
            <p className="text-[11px] text-muted-foreground">
              {data ? data.summary.simulatedRows.toLocaleString() : "..."} operational telemetry
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Ingestion Adapters</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                Active: 4
              </Badge>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              4 Gateways
            </div>
            <p className="text-[11px] text-muted-foreground">
              CSV Upload • Webhook • HMIS • Simulator
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="coverage" className="space-y-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="coverage" className="text-xs">
            Table Coverage
          </TabsTrigger>
          <TabsTrigger value="adapters" className="text-xs">
            Ingestion Hub (Upload)
          </TabsTrigger>
          <TabsTrigger value="sources" className="text-xs">
            Authoritative Sources
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Coverage Breakdown */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Table-by-Table Provenance Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Audit of every database relation in active node schema ({activeNode}). Shows row counts, origin breakdown, and data governance terms.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y border-border text-muted-foreground font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Relation & Display Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Total Rows</th>
                      <th className="py-2.5 px-4 min-w-[200px]">Origin Breakdown (% Real / Derived / Simulated)</th>
                      <th className="py-2.5 px-3">Authoritative Source</th>
                      <th className="py-2.5 px-3">License & Terms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data?.tables.map((table) => (
                      <tr key={table.tableName} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{table.displayName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{table.tableName}</div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {table.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium">
                          {table.totalRows.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            {/* Stacked bar */}
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                              {table.realPct > 0 && (
                                <div
                                  style={{ width: `${table.realPct}%` }}
                                  className="bg-emerald-500 h-full"
                                  title={`Real: ${table.realPct}%`}
                                />
                              )}
                              {table.derivedPct > 0 && (
                                <div
                                  style={{ width: `${table.derivedPct}%` }}
                                  className="bg-sky-500 h-full"
                                  title={`Derived: ${table.derivedPct}%`}
                                />
                              )}
                              {table.simulatedPct > 0 && (
                                <div
                                  style={{ width: `${table.simulatedPct}%` }}
                                  className="bg-amber-500 h-full"
                                  title={`Simulated: ${table.simulatedPct}%`}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-mono">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                {table.realPct}% Real
                              </span>
                              <span>•</span>
                              <span className="text-sky-600 dark:text-sky-400 font-medium">
                                {table.derivedPct}% Derived
                              </span>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {table.simulatedPct}% Sim
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-foreground max-w-[220px] truncate" title={table.primarySource}>
                            {table.primarySource}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[220px]" title={table.methodology}>
                            {table.methodology}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-muted-foreground max-w-[180px]">
                          {table.license}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Ingestion Hub */}
        <TabsContent value="adapters" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CSV Ingestion Form */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-primary" />
                  Live CSV Telemetry Ingestion (CsvUploadAdapter)
                </CardTitle>
                <CardDescription className="text-xs">
                  Upload real facility inventory, bed occupancy, clinician attendance, or patient footfall CSVs. Data will be tagged as <code className="text-emerald-500 font-mono">data_origin=real</code> upon validation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleUpload} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Target Telemetry Domain</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["stock", "beds", "staff", "footfall"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTableType(t)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${
                            selectedTableType === t
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-medium text-foreground">Select CSV File</label>
                      <a
                        href={`/docs/templates/${selectedTableType}_template.csv`}
                        download
                        className="text-primary hover:underline text-[11px] flex items-center gap-1"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        Download Template
                      </a>
                    </div>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 border border-input rounded-md p-1.5 bg-background cursor-pointer"
                    />
                  </div>

                  <Button type="submit" disabled={uploading || !selectedFile} className="w-full text-xs gap-2">
                    {uploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Validating & Ingesting...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" /> Ingest Real Telemetry (data_origin=real)
                      </>
                    )}
                  </Button>
                </form>

                {/* Upload Results Box */}
                {uploadResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      uploadResult.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 border-destructive/30 text-destructive dark:text-destructive-foreground"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      {uploadResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Ingestion Successful: {uploadResult.recordsProcessed} Rows Ingested
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-destructive" />
                          Ingestion Validation Failed
                        </>
                      )}
                    </div>
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto font-mono text-[11px]">
                        {uploadResult.errors.map((err: string, i: number) => (
                          <div key={i} className="text-red-500">
                            • {err}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Ingestion Adapters Status */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    Available Ingestion Adapters
                  </CardTitle>
                  <CardDescription className="text-xs">
                    All adapters normalize incoming feeds into the exact same database hypertable schema with automated provenance tags.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.adapters.map((adapter) => (
                    <div
                      key={adapter.id}
                      className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-2">
                          {adapter.name}
                          <ProvenanceBadge origin={adapter.targetOrigin} size="sm" />
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {adapter.status}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{adapter.description}</p>
                      <div className="text-[10px] font-mono text-muted-foreground/80 pt-1">
                        Endpoint: <code className="text-foreground">{adapter.endpointOrPath}</code>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Webhook Stream Specs */}
              <Card className="bg-card/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                    <Radio className="w-3.5 h-3.5 text-emerald-500" />
                    IoT Webhook Signature Header
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-muted-foreground">
                  <p className="text-[11px]">
                    To push automated telemetry, post JSON to <code className="text-foreground font-mono">/api/ingestion/webhook</code> with header:
                  </p>
                  <pre className="p-2 rounded bg-muted/60 font-mono text-[10px] text-foreground overflow-x-auto">
                    X-Signature-SHA256: HMAC_SHA256(payload, process.env.INGESTION_WEBHOOK_SECRET)
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Authoritative Public Sources */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Authoritative Data Sources Directory</CardTitle>
              <CardDescription className="text-xs">
                Audited public datasets and epidemiological citations documented in <code className="text-foreground font-mono">docs/DATA_SOURCES.md</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Source 1 */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-emerald-500" />
                      data.gov.in & OpenStreetMap
                    </div>
                    <ProvenanceBadge origin="real" size="sm" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    All India Health Centres Directory supplemented by OSM Overpass API healthcare nodes. Reconciled against Lok Sabha Unstarred Question 1924 (6 Dec 2024, Annexure I).
                  </p>
                  <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    <div>Records: 164 Karnataka facilities (32 BLR, 36 BG, 32 KLB, 33 MYS, 31 DK)</div>
                    <div>License: Open Government Data (OGD) / ODbL</div>
                    <div>Checksum: data/raw/facilities/karnataka_facilities.json</div>
                  </div>
                </div>

                {/* Source 2 */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4 text-sky-500" />
                      Open-Meteo Weather Archive & NWP
                    </div>
                    <ProvenanceBadge origin="real" size="sm" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    ERA5 Reanalysis historical daily precipitation and temperatures (2022-2025) plus ECMWF 16-day live ensemble forecasts for early-warning lag triggers.
                  </p>
                  <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    <div>Records: 1,368 daily district observations + 16-day forecast</div>
                    <div>License: Creative Commons Attribution 4.0 (CC BY 4.0)</div>
                    <div>Checksum: data/raw/weather/karnataka_weather_archive.json</div>
                  </div>
                </div>

                {/* Source 3 */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-purple-500" />
                      National List of Essential Medicines (NLEM 2022)
                    </div>
                    <ProvenanceBadge origin="real" size="sm" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Official MoHFW NLEM 2022 Gazette schedule indexed by Level of Care (Primary / Secondary / Tertiary) with verifiable source page references.
                  </p>
                  <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    <div>Records: 16 Core Primary Care formulations with IPHS units</div>
                    <div>License: Government Open Access / Official Publication</div>
                    <div>Checksum: data/raw/medicines/nlem_2022_extracted.json</div>
                  </div>
                </div>

                {/* Source 4 */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-500" />
                      Census of India 2011 Catchment Derivation
                    </div>
                    <ProvenanceBadge origin="derived" size="sm" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    District populations divided by verified PHC counts to establish empirical facility catchment populations (e.g. 301,000 for BLR Urban; 133,000 for Belagavi).
                  </p>
                  <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    <div>Method: Catchment = District Population / PHC Count</div>
                    <div>License: Government Open Data (Census of India)</div>
                    <div>Checksum: data/raw/population/census_2011_karnataka.json</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
