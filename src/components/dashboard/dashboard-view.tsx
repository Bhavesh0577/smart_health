"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Bed,
  Users,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  MapPin,
  RefreshCw,
  ExternalLink,
  Activity,
  Layers,
  ArrowLeftRight,
  Bot,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { DashboardStats } from "@/lib/services/dashboard-service";

export function DashboardView() {
  const { selectedNode, selectedDistrict, setSelectedDistrict, role } = useApp();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchBriefing = async () => {
    try {
      const dist = selectedDistrict !== "All Districts" ? selectedDistrict : "Kalaburagi";
      const res = await fetch(`/api/copilot/briefing?district=${encodeURIComponent(dist)}&node=${selectedNode}`);
      const data = await res.json();
      if (data.success) {
        setBriefing(data.briefing);
      }
    } catch (e) {
      console.warn("Could not load dashboard briefing:", e);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const distParam = selectedDistrict !== "All Districts" ? `&district=${encodeURIComponent(selectedDistrict)}` : "";
      const res = await fetch(`/api/dashboard/stats?node=${selectedNode}${distParam}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchBriefing();
  }, [selectedNode, selectedDistrict]);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Querying sovereign node records from {selectedNode}...
        </p>
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner & Context Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              National Health Resource & Resilience Dashboard
            </h1>
            <Badge variant="outline" className="text-xs font-mono uppercase bg-primary/5 text-primary border-primary/20">
              {role.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active Federated Node: <span className="font-semibold text-foreground">{s?.nodeId}</span> • 90-day time-series continuous surveillance
          </p>
        </div>

        {/* District Filter Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-medium text-muted-foreground hidden md:inline">District:</span>
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          >
            <option value="All Districts">All Districts ({s?.totalPhcs} PHCs)</option>
            {s?.districtBreakdown.map((d) => (
              <option key={d.district} value={d.district}>
                {d.district} ({d.totalPhcs} PHCs)
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            className="h-8 px-2.5 text-xs gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Critical Early Warning Notice if Stockout Risks Exist */}
      {s?.criticalPhcsCount > 0 && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-destructive uppercase tracking-wide">
                Urgent Stockout Alert: {s.criticalPhcsCount} Primary Health Centres at Critical Risk (&lt; 3.0 Days Cover)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Key shortages in Oral Rehydration Salts (ORS) and ACT Antimalarials due to heavy seasonal surge. Automated redistribution plan ready.
              </p>
            </div>
          </div>
          <Link href="/redistribution" className="self-end sm:self-auto">
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5 shadow-sm">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Launch Min-Cost Flow
            </Button>
          </Link>
        </div>
      )}

      {/* 5 Core KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Stock-out Risk */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Stock-Out Risk
            </CardTitle>
            <div className={`p-1.5 rounded-md ${s?.criticalPhcsCount > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-500"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {s?.criticalPhcsCount}
              </span>
              <span className="text-xs text-muted-foreground">Critical PHCs</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-600 dark:text-amber-400">
                +{s?.warningPhcsCount} Warning
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {s?.healthyPhcsCount} Resilient
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Bed Occupancy */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Bed Occupancy
            </CardTitle>
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
              <Bed className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {s?.averageBedOccupancyPercent}%
              </span>
              <span className="text-xs text-muted-foreground">
                {s?.occupiedBeds}/{s?.totalBeds} Beds
              </span>
            </div>
            <Progress value={s?.averageBedOccupancyPercent} className="h-1.5 mt-2.5" />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              <span className="font-semibold text-foreground">{s?.availableOxygenBeds}</span> Oxygen beds available
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Staff Attendance */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Staff Attendance
            </CardTitle>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {s?.staffAttendancePercent}%
              </span>
              <span className="text-xs text-muted-foreground">On Duty</span>
            </div>
            <Progress value={s?.staffAttendancePercent} className="h-1.5 mt-2.5" />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              <span className="font-semibold text-foreground">{s?.doctorsPresent}</span> Doctors active in shift
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Active Alerts */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Early Warning Alerts
            </CardTitle>
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {s?.activeAlertsCount}
              </span>
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                {s?.criticalAlertsCount} Critical
              </Badge>
              <Link href="/alerts" className="text-[10px] text-primary hover:underline flex items-center">
                Review <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Resilience Score */}
        <Card className="border-border/80 shadow-xs bg-linear-to-br from-card to-primary/5">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Resilience Score
            </CardTitle>
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Activity className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {s?.averageResilienceScore}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                {s?.averageResilienceScore >= 75 ? "Optimal Resilience" : "Vulnerable"}
              </Badge>
              <Link href="/simulation" className="text-[10px] text-primary hover:underline flex items-center">
                Simulate <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2 Primary Charts: Footfall Dynamics and Medicine Depletion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Footfall & Symptom Surveillance */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Outpatient Footfall by Syndrome (Last 14 Days)
                </CardTitle>
                <CardDescription className="text-xs">
                  Monsoon diarrhea & vector-borne fever surge detection
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                CUSUM / EWMA Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s?.recentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFever" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDiarrhea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                  <Area type="monotone" dataKey="feverFootfall" name="Fever (Syndrome)" stroke="#ef4444" fillOpacity={1} fill="url(#colorFever)" />
                  <Area type="monotone" dataKey="diarrheaFootfall" name="Diarrhea (Monsoon)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorDiarrhea)" />
                  <Area type="monotone" dataKey="respiratoryFootfall" name="Respiratory" stroke="#3b82f6" fillOpacity={1} fill="url(#colorResp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Medicine Consumption Surge */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Critical Medicine Consumption Velocity
                </CardTitle>
                <CardDescription className="text-xs">
                  ORS Sachets vs Antimalarials (AL) demand spike
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                NLEM Priority
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s?.recentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="orsConsumption" name="ORS Sachets (Units)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="antimalarialConsumption" name="Antimalarials (AL 80/480mg)" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* District Resilience Table */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              District Health Network Status
            </CardTitle>
            <CardDescription className="text-xs">
              Continuous aggregates across all {s?.districtBreakdown.length} districts in this federated jurisdiction
            </CardDescription>
          </div>
          <Link href="/map">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              GIS Cluster Map
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs hover:bg-transparent">
                  <TableHead className="font-semibold">District</TableHead>
                  <TableHead className="font-semibold text-center">Total PHCs</TableHead>
                  <TableHead className="font-semibold text-center">At-Risk Count</TableHead>
                  <TableHead className="font-semibold text-center">Bed Occupancy</TableHead>
                  <TableHead className="font-semibold text-center">Staff Attendance</TableHead>
                  <TableHead className="font-semibold text-center">Avg Days Cover</TableHead>
                  <TableHead className="font-semibold text-center">Resilience Score</TableHead>
                  <TableHead className="text-right font-semibold pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s?.districtBreakdown.map((d) => (
                  <TableRow key={d.district} className="text-xs hover:bg-muted/40">
                    <TableCell className="font-medium text-foreground">
                      {d.district}
                    </TableCell>
                    <TableCell className="text-center font-mono">{d.totalPhcs}</TableCell>
                    <TableCell className="text-center">
                      {d.atRiskPhcs > 0 ? (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                          {d.atRiskPhcs} At-Risk
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-emerald-600 border-emerald-500/30">
                          Optimal
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{d.avgBedOccupancy}%</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{d.avgStaffAttendance}%</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${d.avgDaysCover <= 7 ? "text-destructive" : "text-foreground"}`}>
                        {d.avgDaysCover} days
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-mono h-5 ${
                          d.resilienceScore >= 80
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : d.resilienceScore >= 70
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {d.resilienceScore} / 100
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDistrict(d.district)}
                        className="h-6 px-2 text-[11px] text-primary hover:text-primary"
                      >
                        Filter View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Executive Daily Briefing Card */}
      {briefing && (
        <Card className="border-border/80 shadow-xs bg-card/60 backdrop-blur-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>Daily Executive Health Briefing</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    Gemini Copilot
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {briefing.district} • {briefing.date}
                </CardDescription>
              </div>
            </div>
            <Link href="/copilot">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                <span>Open Copilot Agent</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans bg-muted/20 p-3 rounded-lg border border-border/60">
              {briefing.contentMarkdown}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Stockout Watchlist */}
      {s?.criticalStockouts.length > 0 && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Critical Stock-Out Watchlist
                </CardTitle>
                <CardDescription className="text-xs">
                  PHCs where essential life-saving inventory is below 3.5 days of cover
                </CardDescription>
              </div>
              <Link href="/redistribution">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Automate Rebalance
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs hover:bg-transparent">
                    <TableHead className="font-semibold">PHC Facility</TableHead>
                    <TableHead className="font-semibold">District</TableHead>
                    <TableHead className="font-semibold">Depleted Medicine</TableHead>
                    <TableHead className="font-semibold text-center">Remaining Quantity</TableHead>
                    <TableHead className="font-semibold text-center">Days of Cover</TableHead>
                    <TableHead className="text-right font-semibold pr-4">Facility Dossier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s?.criticalStockouts.map((c, i) => (
                    <TableRow key={i} className="text-xs hover:bg-destructive/5">
                      <TableCell className="font-medium text-foreground">
                        {c.phcName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.district}</TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {c.medicineName}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <span className="text-destructive font-bold">{c.currentQty}</span> units
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive" className="h-5 px-2 text-[10px] font-mono">
                          {c.daysOfCover} days remaining
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Link href={`/phcs/${c.phcId}`}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-primary">
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
