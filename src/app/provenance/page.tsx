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
  Building2,
  Activity,
  FileText,
  Globe,
  Search,
} from "lucide-react";
import { useApp } from "@/lib/context/app-context";
import { toast } from "sonner";

interface OfficialDatasetEntry {
  dataType: string;
  icon: any;
  portals: Array<{ name: string; url: string }>;
  searchTerms: string[];
  status: string;
  origin: "real" | "derived" | "simulated";
  records: string;
  localFile: string;
  description: string;
}

const OFFICIAL_GOVERNMENT_DATASETS: OfficialDatasetEntry[] = [
  {
    dataType: "PHC & CHC Directory",
    icon: Building2,
    portals: [
      { name: "data.gov.in (Open Government Data - OGD)", url: "https://data.gov.in" },
    ],
    searchTerms: ["\"All India Health Centres Directory\"", "\"Karnataka PHC list\""],
    status: "Integrated (Real)",
    origin: "real",
    records: "164 Facilities (5 Focus Districts)",
    localFile: "data/raw/facilities/karnataka_facilities.json",
    description: "Verified primary health network geocoded across Karnataka, validated against Lok Sabha Unstarred Question 1924 (6 Dec 2024).",
  },
  {
    dataType: "Essential Medicines Catalog",
    icon: Pill,
    portals: [
      { name: "cdsco.gov.in", url: "https://cdsco.gov.in" },
      { name: "mohfw.gov.in", url: "https://mohfw.gov.in" },
    ],
    searchTerms: ["\"National List of Essential Medicines 2022\"", "\"NLEM 2022 PDF\""],
    status: "Integrated (Real)",
    origin: "real",
    records: "7 Primary Care Formulations",
    localFile: "data/processed/nlem_primary_care.json",
    description: "Official MoHFW NLEM 2022 Primary Care schedule with exact gazette page numbers, dosage forms, and shelf life.",
  },
  {
    dataType: "District Population & Catchment",
    icon: Users,
    portals: [
      { name: "censusindia.gov.in", url: "https://censusindia.gov.in" },
    ],
    searchTerms: ["\"Primary Census Abstract 2011 Karnataka\"", "\"PCA District Data\""],
    status: "Integrated (Real & Derived)",
    origin: "derived",
    records: "7 District Profiles (Census 2011)",
    localFile: "data/raw/population/karnataka_census_2011.json",
    description: "Census of India 2011 Primary Census Abstract rural/urban population used to derive deterministic catchment per PHC.",
  },
  {
    dataType: "Disease Outbreak Surveillance",
    icon: Activity,
    portals: [
      { name: "idsp.mohfw.gov.in (NCDC / IDSP)", url: "https://idsp.mohfw.gov.in" },
    ],
    searchTerms: ["\"IDSP Weekly Outbreak Surveillance\"", "\"Karnataka disease weekly bulletin\""],
    status: "Integrated (Real Calibration)",
    origin: "real",
    records: "3 Disease Syndromes (Weekly Profiles)",
    localFile: "data/raw/seasonality/disease_seasonality_karnataka.json",
    description: "NCDC Integrated Disease Surveillance Programme outbreak parameters (diarrhea 4d lag, vector fever 14d lag, ARI winter spike).",
  },
  {
    dataType: "Weather & Climate Risks",
    icon: CloudRain,
    portals: [
      { name: "mausam.imd.gov.in", url: "https://mausam.imd.gov.in" },
      { name: "open-meteo.com", url: "https://open-meteo.com" },
    ],
    searchTerms: ["\"IMD Daily Rainfall Karnataka\"", "\"Open-Meteo Historical Weather API\""],
    status: "Integrated (Real)",
    origin: "real",
    records: "1,368 Daily Observations + 16-Day Forecast",
    localFile: "data/raw/weather/karnataka_weather_daily.json",
    description: "ERA5 historical weather reanalysis and ECMWF NWP live forecast calibrated with IMD daily rainfall climate zones.",
  },
];

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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    Authoritative Portals & Search Terms Integration Matrix
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Official public data portals, exact search terms, and ingestion file paths specified for BRICS health logistics.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  5 of 5 Sourced & Integrated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y border-border text-muted-foreground font-medium">
                    <tr>
                      <th className="py-2.5 px-4 min-w-[180px]">Data Type</th>
                      <th className="py-2.5 px-4 min-w-[220px]">Official Portal & URL</th>
                      <th className="py-2.5 px-4 min-w-[240px]">Exact Search Terms</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Integration Status</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Local Dataset Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {OFFICIAL_GOVERNMENT_DATASETS.map((ds) => {
                      const Icon = ds.icon;
                      return (
                        <tr key={ds.dataType} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <Icon className="w-4 h-4 text-primary shrink-0" />
                              {ds.dataType}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px]">
                              {ds.description}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {ds.portals.map((portal) => (
                                <a
                                  key={portal.url}
                                  href={portal.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs mr-2"
                                >
                                  <span>{portal.name}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {ds.searchTerms.map((term, i) => (
                                <code
                                  key={i}
                                  className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground border border-border/80"
                                >
                                  {term}
                                </code>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <ProvenanceBadge origin={ds.origin} size="sm" />
                                <span className="font-medium text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  {ds.status}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {ds.records}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <code className="text-[10px] font-mono text-muted-foreground break-all bg-muted/40 p-1 rounded">
                              {ds.localFile}
                            </code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* International Partner Nodes (BRICS Federation) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500" />
                BRICS Federated Partner Nodes (Multi-National Sourcing)
              </CardTitle>
              <CardDescription className="text-xs">
                Independent national health jurisdiction nodes participating in cross-border federated learning and resilience benchmarking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-emerald-500" />
                      Brazil Node (Bahia - Salvador & Feira de Santana)
                    </div>
                    <ProvenanceBadge origin="real" size="sm" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    DATASUS / CNES (Cadastro Nacional de Estabelecimentos de Saúde) master verified with OpenStreetMap Bahia healthcare geometry.
                  </p>
                  <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    <div>Portal: <a href="https://datasus.saude.gov.br/" target="_blank" rel="noreferrer" className="text-primary hover:underline">datasus.saude.gov.br</a></div>
                    <div>Local Path: data/raw/facilities/bahia_facilities.json (7 UBS Centers)</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-border/80 bg-card/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-amber-500" />
                      South Africa Node (KwaZulu-Natal - eThekwini)
                    </div>
                    <ProvenanceBadge origin="real" size="sm" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    National Department of Health facility registry integrated via Healthsites.io Open Data Commons.
                  </p>
                  <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
                    <div>Portal: <a href="https://healthsites.io/" target="_blank" rel="noreferrer" className="text-primary hover:underline">healthsites.io</a> & health.gov.za</div>
                    <div>Local Path: data/raw/facilities/kzn_facilities.json (6 Clinics)</div>
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
