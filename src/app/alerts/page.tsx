"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  ArrowLeftRight,
  ExternalLink,
  Flame,
  Search,
  Filter,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface AlertItem {
  id: string;
  time: string;
  phcId: string;
  phcName: string;
  district: string;
  severity: "critical" | "warning" | "info";
  alertType: string;
  title: string;
  message: string;
  status: "active" | "resolved";
  resolvedAt?: string;
}

export default function AlertsPage() {
  const { selectedNode, selectedDistrict, setSelectedDistrict } = useApp();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [scanning, setScanning] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const distParam = selectedDistrict !== "All Districts" ? `&district=${encodeURIComponent(selectedDistrict)}` : "";
      const res = await fetch(
        `/api/alerts?node=${selectedNode}&status=${filterStatus}&severity=${filterSeverity}${distParam}`
      );
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data);
      }
    } catch (e) {
      console.error("Failed to load alerts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedNode, selectedDistrict, filterSeverity, filterStatus]);

  // Real-time SSE alert listener
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/stream/updates");
      es.addEventListener("alert", (event) => {
        const data = JSON.parse(event.data);
        toast.error(`NEW SURVEILLANCE ALERT: ${data.title}`, {
          description: data.message,
        });
        fetchAlerts();
      });
    } catch {
      // Ignore
    }
    return () => {
      es?.close();
    };
  }, [selectedNode]);

  const handleResolve = async (id: string, title: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", node: selectedNode, alertId: id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Alert Resolved", {
          description: `Acknowledged: ${title}`,
        });
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (e) {
      toast.error("Failed to resolve alert");
    }
  };

  const handleScanAnomalies = async () => {
    try {
      setScanning(true);
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", node: selectedNode }),
      });
      const json = await res.json();
      if (json.success) {
        toast.info("Anomaly Surveillance Scan Complete", {
          description: `Scanned ${json.scannedFacilitiesCount} facilities. Discovered ${json.anomaliesDiscovered} statistical shifts.`,
        });
        fetchAlerts();
      }
    } finally {
      setScanning(false);
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Early Warning & Epidemiological Anomaly Alerts
            </h1>
            <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
              EWMA + CUSUM
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time statistical anomaly surveillance on outpatient syndrome footfall & essential medicine stock velocity
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleScanAnomalies}
            disabled={scanning}
            className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Sparkles className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Scanning Data..." : "Run Anomaly Scan"}</span>
          </Button>

          <Button size="sm" variant="outline" onClick={fetchAlerts} className="h-8 text-xs gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Critical Alerts (&lt; 3d Cover / Outbreak)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-destructive">
                {criticalCount}
              </span>
              <span className="text-xs text-muted-foreground">Active Emergencies</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Warning Alerts (CUSUM Shift / Low Buffer)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {warningCount}
              </span>
              <span className="text-xs text-muted-foreground">Sub-critical Alerts</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs bg-muted/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Surveillance Engine Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-semibold text-foreground">
                Statistical Monitoring Active
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              EWMA α=0.25 • CUSUM threshold h=4.0σ • 5-sec SSE push
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border">
            <button
              onClick={() => setFilterStatus("active")}
              className={`px-3 py-1 text-xs font-medium rounded-sm ${
                filterStatus === "active" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus("resolved")}
              className={`px-3 py-1 text-xs font-medium rounded-sm ${
                filterStatus === "resolved" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1 text-xs font-medium rounded-sm ${
                filterStatus === "all" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              All History
            </button>
          </div>

          {/* Severity Buttons */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border">
            <button
              onClick={() => setFilterSeverity("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${
                filterSeverity === "all" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterSeverity("critical")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${
                filterSeverity === "critical" ? "bg-destructive text-destructive-foreground font-semibold" : "text-destructive"
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setFilterSeverity("warning")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${
                filterSeverity === "warning" ? "bg-amber-500 text-white font-semibold" : "text-amber-600 dark:text-amber-400"
              }`}
            >
              Warning
            </button>
          </div>
        </div>

        {/* District Filter */}
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden"
        >
          <option value="All Districts">All Districts</option>
          <option value="Bengaluru Urban">Bengaluru Urban</option>
          <option value="Belagavi">Belagavi</option>
          <option value="Kalaburagi">Kalaburagi</option>
          <option value="Mysuru">Mysuru</option>
          <option value="Dakshina Kannada">Dakshina Kannada</option>
        </select>
      </div>

      {/* Alerts Table */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-primary" />
              Loading surveillance alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-semibold text-foreground">Zero Active Alerts</h3>
              <p className="text-xs">No unresolved stockout risks or statistical anomalies detected in this jurisdiction.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs hover:bg-transparent">
                    <TableHead className="font-semibold w-24">Severity</TableHead>
                    <TableHead className="font-semibold">Facility & District</TableHead>
                    <TableHead className="font-semibold">Surveillance Finding</TableHead>
                    <TableHead className="font-semibold text-center">Category</TableHead>
                    <TableHead className="font-semibold text-center">Timestamp</TableHead>
                    <TableHead className="text-right font-semibold pr-4">Mitigation Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((a) => (
                    <TableRow key={a.id} className="text-xs hover:bg-muted/40">
                      <TableCell>
                        <Badge
                          variant={a.severity === "critical" ? "destructive" : "default"}
                          className={`h-5 px-1.5 text-[10px] uppercase font-mono ${
                            a.severity === "critical" ? "animate-pulse" : "bg-amber-500 text-white"
                          }`}
                        >
                          {a.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{a.phcName}</div>
                        <div className="text-[10px] text-muted-foreground">{a.district}</div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="font-semibold text-foreground">{a.title}</div>
                        <div className="text-muted-foreground text-[11px] mt-0.5 leading-snug">{a.message}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-[10px]">
                        {a.alertType.replace("_", " ")}
                      </TableCell>
                      <TableCell className="text-center font-mono text-[10px] text-muted-foreground">
                        {new Date(a.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/phcs/${a.phcId}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary" title="View Facility Dossier">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
                          <Link href="/redistribution">
                            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] text-primary border-primary/30" title="Launch Supply Redistribution">
                              <ArrowLeftRight className="w-3 h-3 mr-1" />
                              <span>Rebalance</span>
                            </Button>
                          </Link>
                          {a.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolve(a.id, a.title)}
                              className="h-6 px-2 text-[10px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                              Resolve
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
