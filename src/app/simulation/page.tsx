"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SlidersHorizontal,
  CloudRain,
  Users,
  RouteOff,
  AlertTriangle,
  Flame,
  RotateCcw,
  Play,
  TrendingDown,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function SimulationPage() {
  const { selectedNode, isEmergencyActive, triggerEmergencyMode, resetEmergencyMode } = useApp();

  // Simulation parameters
  const [monsoonIntensity, setMonsoonIntensity] = useState<number>(1.0);
  const [staffAbsentPercent, setStaffAbsentPercent] = useState<number>(0);
  const [roadClosureActive, setRoadClosureActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [emergencyLoading, setEmergencyLoading] = useState<boolean>(false);

  // Simulation output data
  const [simData, setSimData] = useState<any>(null);

  const runSimulation = async (paramsOverride?: {
    monsoon?: number;
    staff?: number;
    road?: boolean;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/simulation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node: selectedNode,
          monsoonIntensity: paramsOverride?.monsoon ?? monsoonIntensity,
          staffAbsentPercent: paramsOverride?.staff ?? staffAbsentPercent,
          roadClosureActive: paramsOverride?.road ?? roadClosureActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimData(data);
      } else {
        toast.error("Simulation failed", { description: data.error });
      }
    } catch (e) {
      console.error("Simulation run error:", e);
      toast.error("Failed to connect to simulation engine");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [selectedNode]);

  const handleReset = async () => {
    setMonsoonIntensity(1.0);
    setStaffAbsentPercent(0);
    setRoadClosureActive(false);
    if (isEmergencyActive) {
      await resetEmergencyMode();
    }
    await runSimulation({ monsoon: 1.0, staff: 0, road: false });
    toast.info("Simulation Reset to Baseline", {
      description: "All climate stress, staff absenteeism, and road obstacles restored to normal.",
    });
  };

  const handleEmergencyToggle = async () => {
    setEmergencyLoading(true);
    try {
      if (isEmergencyActive) {
        await resetEmergencyMode();
        setMonsoonIntensity(1.0);
        setStaffAbsentPercent(0);
        setRoadClosureActive(false);
        await runSimulation({ monsoon: 1.0, staff: 0, road: false });
        toast.success("Emergency Mode Deactivated", {
          description: "Cluster records reset to nominal surveillance baseline.",
        });
      } else {
        await triggerEmergencyMode();
        setMonsoonIntensity(2.8);
        setStaffAbsentPercent(20);
        setRoadClosureActive(true);
        await runSimulation({ monsoon: 2.8, staff: 20, road: true });
        toast.error("EMERGENCY OUTBREAK CLUSTER INJECTED!", {
          description: "Fever/diarrhea surge active in Kalaburagi. AI redistribution & early warnings initiated.",
        });
      }
    } finally {
      setEmergencyLoading(false);
    }
  };

  const comp = simData?.comparison;
  const districtTable = simData?.districtTable || [];
  const moves = simData?.simulatedRedistributionMoves || [];

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              <SlidersHorizontal className="w-3 h-3 mr-1" />
              What-If Stress Testing Engine
            </Badge>
            {isEmergencyActive && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                <Flame className="w-3 h-3 mr-1" />
                OUTBREAK CLUSTER ACTIVE
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Resilience Simulator & Crisis Stress-Testing Lab
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Test supply chain resilience against severe monsoon deluges, road washouts, and staff epidemics with live OR-Tools re-routing.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={loading || emergencyLoading}
            className="h-9 text-xs gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </Button>

          <Button
            variant={isEmergencyActive ? "destructive" : "default"}
            size="sm"
            onClick={handleEmergencyToggle}
            disabled={emergencyLoading}
            className={`h-9 text-xs font-semibold gap-1.5 ${
              isEmergencyActive ? "animate-pulse shadow-md shadow-destructive/30" : "bg-amber-600 hover:bg-amber-700 text-white"
            }`}
          >
            {emergencyLoading ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : isEmergencyActive ? (
              <Flame className="w-3.5 h-3.5 fill-current" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>{isEmergencyActive ? "Deactivate Outbreak" : "Trigger Outbreak Cluster"}</span>
          </Button>
        </div>
      </div>

      {/* Control Panel: Sliders & Toggles */}
      <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Simulated Crisis Parameters
            </span>
            <Button
              size="sm"
              onClick={() => runSimulation()}
              disabled={loading}
              className="h-7 px-3 text-xs gap-1.5"
            >
              {loading ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Execute Simulation
            </Button>
          </CardTitle>
          <CardDescription className="text-xs">
            Adjust variables to see real-time shifts in PHC days-of-cover, bed saturation, and re-routed logistics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Control 1: Monsoon Intensity */}
            <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-blue-500" />
                  Monsoon Deluge Intensity
                </label>
                <Badge variant="secondary" className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {monsoonIntensity.toFixed(1)}x
                </Badge>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={monsoonIntensity}
                onChange={(e) => setMonsoonIntensity(parseFloat(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>1.0x (Normal)</span>
                <span>2.0x (Heavy Rains)</span>
                <span>3.0x (Catastrophic Flood)</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Increases fever/diarrhea admissions and multiplies ORS & antimalarial consumption by up to 2.8x.
              </p>
            </div>

            {/* Control 2: Staff Absenteeism */}
            <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-500" />
                  Healthcare Staff Absenteeism
                </label>
                <Badge variant="secondary" className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  {staffAbsentPercent}%
                </Badge>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={staffAbsentPercent}
                onChange={(e) => setStaffAbsentPercent(parseInt(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>0% (Full Staff)</span>
                <span>20% (Epidemic Shortfall)</span>
                <span>50% (Crisis Gridlock)</span>
              </div>
              <div className="flex gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant={staffAbsentPercent === 20 ? "secondary" : "outline"}
                  onClick={() => setStaffAbsentPercent(20)}
                  className="h-6 text-[10px] px-2"
                >
                  Quick Toggle: 20% Absent
                </Button>
                <Button
                  size="sm"
                  variant={staffAbsentPercent === 0 ? "secondary" : "outline"}
                  onClick={() => setStaffAbsentPercent(0)}
                  className="h-6 text-[10px] px-2"
                >
                  Reset Staff
                </Button>
              </div>
            </div>

            {/* Control 3: Road Closures & Bridge Outages */}
            <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <RouteOff className="w-4 h-4 text-rose-500" />
                  Critical Road Washout / Landslides
                </label>
                <Badge
                  variant={roadClosureActive ? "destructive" : "outline"}
                  className="text-xs font-semibold"
                >
                  {roadClosureActive ? "SEVERED" : "OPEN"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant={roadClosureActive ? "destructive" : "outline"}
                  onClick={() => setRoadClosureActive(!roadClosureActive)}
                  className="w-full h-8 text-xs font-semibold gap-1.5"
                >
                  <RouteOff className="w-3.5 h-3.5" />
                  {roadClosureActive ? "Disable Road Obstacles" : "Simulate Western Ghats Landslide"}
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground pt-1">
                Simulates closure of NH-66 and Shiradi Ghat passes. OR-Tools must re-route medical supplies via inland detours (+140 min ETA).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delta KPI Cards: Baseline vs Simulated */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Resilience Index */}
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Composite Resilience</span>
              <ShieldAlert className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {comp ? comp.simulatedScore : "--"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                / 100 (Base: {comp ? comp.baselineScore : "--"})
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
              <Badge
                variant="outline"
                className={`text-[11px] font-mono ${
                  comp?.scoreDelta < 0
                    ? "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                    : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                }`}
              >
                {comp ? `${comp.scoreDelta > 0 ? "+" : ""}${comp.scoreDelta} pts` : "--"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Impact delta</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Stockout Risk Facilities */}
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Facilities at Stockout Risk</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {comp ? comp.simulatedAtRiskCount : "--"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                PHCs (Base: {comp ? comp.baselineAtRiskCount : "--"})
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
              <Badge
                variant="outline"
                className={`text-[11px] font-mono ${
                  comp?.atRiskDelta > 0
                    ? "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                    : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                }`}
              >
                {comp ? `+${comp.atRiskDelta} Vulnerable` : "--"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Under 7d cover</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Bed Headroom */}
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Simulated Bed Occupancy</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {comp ? `${comp.simulatedBedOccupancy}%` : "--"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                (Headroom: {comp ? `${100 - comp.simulatedBedOccupancy}%` : "--"})
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
              <Badge
                variant="outline"
                className={`text-[11px] font-mono ${
                  comp?.simulatedBedOccupancy >= 90
                    ? "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10"
                    : "border-blue-500/30 text-blue-600 bg-blue-500/10"
                }`}
              >
                {comp ? `${comp.simulatedBedOccupancy - comp.baselineBedOccupancy > 0 ? "+" : ""}${comp.simulatedBedOccupancy - comp.baselineBedOccupancy}% surge` : "--"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Inpatient demand</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Logistics Transport Delay */}
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span className="font-medium">Logistics Delay Factor</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-foreground">
                {comp ? `${comp.logisticsDelayFactor}x` : "--"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                transit time
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
              <Badge
                variant="outline"
                className={`text-[11px] font-mono ${
                  comp?.logisticsDelayFactor > 1.0
                    ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                    : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                }`}
              >
                {comp?.logisticsDelayFactor > 1.0 ? "+55% Transit Penalty" : "Nominal Routes"}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Detour overhead</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resilience Pillars Formula Reference */}
      <Card className="border-border/80 bg-muted/10">
        <CardContent className="p-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">
                Resilience Formulation:
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                Score = 0.35 × StockCover + 0.25 × BedHeadroom + 0.25 × StaffAttendance + 0.15 × RouteAccessibility
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px]">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Optimal ≥80</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Moderate 68-79</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Vulnerable 50-67</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Critical &lt;50</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual Chart: Baseline vs Simulated District Resilience */}
      <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            District Resilience Index: Baseline vs Simulated Stress
          </CardTitle>
          <CardDescription className="text-xs">
            Comparative resilience degradation per district under the selected crisis parameters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtTable} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} / 100`, ""]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="baselineScore" name="Baseline Resilience" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="simulatedScore" name="Simulated Resilience" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* District Stress Breakdown Table */}
      <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>District Stress Impact Ledger</span>
            <Badge variant="outline" className="text-[10px] font-normal">
              {districtTable.length} Districts Analyzed
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Detailed vulnerability analysis across all administrative territories.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>District</TableHead>
                <TableHead className="text-center">PHCs</TableHead>
                <TableHead className="text-center">Baseline Score</TableHead>
                <TableHead className="text-center">Simulated Score</TableHead>
                <TableHead className="text-center">Score Delta</TableHead>
                <TableHead className="text-center">At-Risk PHCs</TableHead>
                <TableHead>Primary Vulnerability Vector</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {districtTable.map((d: any, idx: number) => (
                <TableRow key={idx} className="text-xs">
                  <TableCell className="font-semibold text-foreground">{d.district}</TableCell>
                  <TableCell className="text-center font-mono">{d.totalPhcs}</TableCell>
                  <TableCell className="text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {d.baselineScore}
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold">
                    <span
                      className={
                        d.simulatedScore < 50
                          ? "text-rose-600 dark:text-rose-400"
                          : d.simulatedScore < 68
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-blue-600 dark:text-blue-400"
                      }
                    >
                      {d.simulatedScore}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        d.scoreDelta < -15
                          ? "border-rose-500/30 text-rose-600 bg-rose-500/10"
                          : d.scoreDelta < 0
                          ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {d.scoreDelta > 0 ? "+" : ""}
                      {d.scoreDelta} pts
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    <span className="font-bold text-rose-600 dark:text-rose-400">{d.simulatedAtRisk}</span>
                    <span className="text-muted-foreground text-[10px]"> / {d.totalPhcs}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {d.primaryThreat}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Simulated Automated Redistribution Re-routing */}
      <Card className="border-border/80 shadow-sm bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-primary" />
              OR-Tools Re-Optimized Emergency Supply Dispatch
            </span>
            <Badge variant="secondary" className="text-[10px] font-mono">
              Min-Cost Flow with Detour Penalties
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Automated redistribution recommendations generated to neutralize the simulated deficit while routing around severed infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Origin Depot</TableHead>
                <TableHead>Destination Cluster</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-center">Distance & ETA</TableHead>
                <TableHead>Routing Rationale & Detour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moves.map((m: any, idx: number) => (
                <TableRow key={idx} className="text-xs">
                  <TableCell className="font-medium text-foreground">{m.from}</TableCell>
                  <TableCell className="font-medium text-primary">{m.to}</TableCell>
                  <TableCell className="font-mono text-[11px]">{m.medicine}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-foreground">
                    {m.quantity.toLocaleString()} units
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-mono text-xs font-semibold">{m.distanceKm} km</div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" />
                      {m.etaMinutes} min {m.detourApplied && "(Detour)"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[11px] text-muted-foreground leading-snug">
                      {m.reason}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
