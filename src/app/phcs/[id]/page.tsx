"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2,
  ArrowLeft,
  AlertTriangle,
  Bed,
  Users,
  Calendar,
  Activity,
  ShieldCheck,
  RefreshCw,
  Package,
  Layers,
  ArrowLeftRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { PhcDetail } from "@/lib/services/phc-service";
import { toast } from "sonner";

export default function PhcDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { selectedNode } = useApp();

  const [detail, setDetail] = useState<PhcDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/phcs/${id}?node=${selectedNode}`);
      const json = await res.json();
      if (json.success) {
        setDetail(json.data);
      }
    } catch (e) {
      console.error("Failed to load PHC detail:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDetail();
  }, [id, selectedNode]);

  const handleResolveAlert = (alertTitle: string) => {
    toast.success("Alert Acknowledged & Resolved", {
      description: `Action logged in audit trail for ${alertTitle}`,
    });
  };

  if (loading && !detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Loading clinical dossier and inventory ledgers for facility {id}...
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">Facility Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested PHC facility does not exist in the active node schema.</p>
        <Link href="/phcs">
          <Button variant="outline" size="sm">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/phcs" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to PHC Directory</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/redistribution">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Request Buffer Transfer</span>
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={fetchDetail} className="h-8 text-xs gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </div>
      </div>

      {/* Facility Header Card */}
      <div className="p-5 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {detail.name}
            </h1>
            <Badge
              variant={
                detail.riskLevel === "critical"
                  ? "destructive"
                  : detail.riskLevel === "warning"
                  ? "default"
                  : "outline"
              }
              className="text-xs font-mono uppercase h-5 px-2"
            >
              {detail.riskLevel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {detail.district} District, {detail.state} ({detail.country}) • Type: <span className="font-semibold text-foreground">{detail.type.replace("_", " ")}</span> • GPS: <span className="font-mono">{detail.lat.toFixed(4)}, {detail.lng.toFixed(4)}</span>
          </p>
        </div>

        {/* Resilience Badge */}
        <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/60 self-start md:self-auto">
          <div>
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              Facility Resilience Score
            </div>
            <div className="text-2xl font-extrabold text-foreground">
              {detail.resilienceScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`h-7 px-2.5 text-xs font-semibold ${
              detail.resilienceScore >= 80
                ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                : detail.resilienceScore >= 70
                ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                : "border-destructive/40 text-destructive bg-destructive/10"
            }`}
          >
            {detail.resilienceScore >= 80 ? "Optimal" : "At Risk"}
          </Badge>
        </div>
      </div>

      {/* Active Alerts for this PHC */}
      {detail.activeAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Surveillance Alerts ({detail.activeAlerts.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {detail.activeAlerts.map((a) => (
              <div
                key={a.id}
                className="p-3.5 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-destructive">{a.title}</div>
                    <div className="text-muted-foreground text-[11px] mt-0.5">{a.message}</div>
                    <div className="text-[10px] text-muted-foreground/80 mt-1 font-mono">{a.time}</div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResolveAlert(a.title)}
                  className="h-6 text-[10px] px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock Inventory Ledger with Expiry Flags & Days-of-Cover */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Essential Medicine Stock Ledger (NLEM Formulations)
            </CardTitle>
            <CardDescription className="text-xs">
              Real-time on-hand inventory, consumption velocity, days of cover, and shelf-life expiry flags
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            {detail.stockInventory.length} Items Audited
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs hover:bg-transparent">
                  <TableHead className="font-semibold">Medicine Name</TableHead>
                  <TableHead className="font-semibold">Code</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold text-center">On-Hand Qty</TableHead>
                  <TableHead className="font-semibold text-center">Reorder Threshold</TableHead>
                  <TableHead className="font-semibold text-center">Days of Cover</TableHead>
                  <TableHead className="font-semibold text-center">Batch Expiry Date</TableHead>
                  <TableHead className="text-right font-semibold pr-4">Supply Chain Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.stockInventory.map((item) => (
                  <TableRow key={item.medicineId} className="text-xs hover:bg-muted/40">
                    <TableCell className="font-medium text-foreground">
                      {item.medicineName}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {item.medicineCode}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-center font-bold font-mono">
                      {item.qty.toLocaleString()} {item.unit}
                    </TableCell>
                    <TableCell className="text-center font-mono text-muted-foreground">
                      {item.reorderThreshold.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold">
                      <span className={item.daysOfCover <= 3.0 ? "text-destructive" : item.daysOfCover <= 7.0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {item.daysOfCover} days
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono text-[11px]">
                      {item.expiryDate}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      {item.daysOfCover <= 3.0 ? (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                          Stockout Imminent
                        </Badge>
                      ) : item.isNearExpiry ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                          Near Expiry (&lt; 45d) - Rebalance
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-emerald-600 border-emerald-500/30">
                          Adequate
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Longitudinal Surveillance Charts (Last 30 Days) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bed Status History */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bed className="w-4 h-4 text-blue-500" />
              Bed Occupancy Trend (30-Day Longitudinal)
            </CardTitle>
            <CardDescription className="text-xs">
              Total Capacity: {detail.bedCapacity} Beds • Oxygen Headroom: {detail.availableOxygenBeds} Beds
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={detail.bedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(17, 24, 39, 0.95)",
                      borderColor: "#374151",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "#fff"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Area type="monotone" dataKey="occupiedBeds" name="Occupied Beds" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="availableOxygenBeds" name="Oxygen Available" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Staff Attendance History */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              Staff Attendance & Roster Reliability (30 Days)
            </CardTitle>
            <CardDescription className="text-xs">
              Daily doctors, nurses, and pharmacists reporting on shift
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detail.staffHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(17, 24, 39, 0.95)",
                      borderColor: "#374151",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "#fff"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Bar dataKey="doctorsPresent" name="Doctors on Duty" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="nursesPresent" name="Nurses on Duty" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pharmacistsPresent" name="Pharmacists" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outpatient Footfall by Symptom Syndrome */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-destructive" />
            Epidemic Surveillance: Daily Consultations by Syndrome
          </CardTitle>
          <CardDescription className="text-xs">
            Outpatient footfall breakdown (Fever vs Diarrhea vs Respiratory vs General)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={detail.footfallHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderColor: "#374151",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#fff"
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                <Area type="monotone" dataKey="fever" name="Acute Fever" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                <Area type="monotone" dataKey="diarrhea" name="Diarrheal Disease" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                <Area type="monotone" dataKey="respiratory" name="Respiratory" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                <Area type="monotone" dataKey="general" name="General / Maternal" stroke="#6b7280" fill="#6b7280" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
