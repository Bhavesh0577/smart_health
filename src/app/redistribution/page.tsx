"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeftRight,
  Truck,
  CheckCircle2,
  Clock,
  Navigation,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  XCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { TransferMoveItem } from "@/lib/ml-client";

interface PlanItem {
  id: string;
  createdAt: string;
  status: "recommended" | "approved" | "in_transit" | "completed" | "rejected";
  totalCostEstimate: number;
  explanation: string;
  triggeredBy: string;
  moves: TransferMoveItem[];
}

const MEDICINES = [
  { id: "MED_ORS", name: "Oral Rehydration Salts (ORS) Sachets", priority: "Monsoon Surge" },
  { id: "MED_AL", name: "Artemether-Lumefantrine (Antimalarials)", priority: "Vector-borne Surge" },
  { id: "MED_PARA", name: "Paracetamol 500mg Tablets", priority: "Fever Deficit" },
  { id: "MED_INS", name: "Insulin Regular Vials", priority: "Cold-chain Priority" },
];

export default function RedistributionPage() {
  const { selectedNode, role } = useApp();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [selectedMed, setSelectedMed] = useState("MED_ORS");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/redistribution?node=${selectedNode}`);
      const json = await res.json();
      if (json.success) {
        setPlans(json.data);
        if (json.data.length > 0 && !selectedPlanId) {
          setSelectedPlanId(json.data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load redistribution plans:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [selectedNode]);

  const handleGeneratePlan = async () => {
    try {
      setOptimizing(true);
      const res = await fetch("/api/redistribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          node: selectedNode,
          medicineId: selectedMed,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("OR-Tools Optimization Solved", {
          description: `Generated optimal plan with ${json.plan.moves.length} moves.`,
        });
        setPlans((prev) => [json.plan, ...prev]);
        setSelectedPlanId(json.plan.id);
      }
    } catch (e) {
      toast.error("Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const handleUpdateStatus = async (planId: string, newStatus: PlanItem["status"]) => {
    try {
      const res = await fetch("/api/redistribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          node: selectedNode,
          planId,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Plan Status: ${newStatus.toUpperCase()}`, {
          description: `Dispatched audit event across ${selectedNode}`,
        });
        setPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, status: newStatus } : p))
        );
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filteredPlans = activeTab === "all" ? plans : plans.filter((p) => p.status === activeTab);
  const activePlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Automated Resource Redistribution (OR-Tools Min-Cost Flow)
            </h1>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              Shelf-Life Aware
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bipartite flow optimization resolving stockouts, minimizing road transport costs, and prioritizing near-expiry stock
          </p>
        </div>

        {/* Optimizer Action Trigger */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={selectedMed}
            onChange={(e) => setSelectedMed(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden"
          >
            {MEDICINES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            onClick={handleGeneratePlan}
            disabled={optimizing}
            className="h-8 text-xs gap-1.5 font-semibold"
          >
            <Sparkles className={`w-3.5 h-3.5 ${optimizing ? "animate-spin" : ""}`} />
            <span>{optimizing ? "Solving Linear Program..." : "Generate Optimal Plan"}</span>
          </Button>
        </div>
      </div>

      {/* Plans Navigation Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto p-1.5 rounded-lg bg-card border border-border/80">
        <div className="flex items-center gap-1.5">
          {["all", "recommended", "approved", "in_transit", "completed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.replace("_", " ")} ({tab === "all" ? plans.length : plans.filter((p) => p.status === tab).length})
            </button>
          ))}
        </div>

        <Button size="sm" variant="ghost" onClick={fetchPlans} className="h-7 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 mr-1" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Main Grid: Plan List + Selected Plan Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Plans List */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Optimization Plans ({filteredPlans.length})
          </h3>

          {loading ? (
            <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin mr-2 text-primary" />
              Loading plans...
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border/60 rounded-xl text-xs text-muted-foreground">
              No plans matching &apos;{activeTab}&apos;. Click &quot;Generate Optimal Plan&quot; above to solve.
            </div>
          ) : (
            filteredPlans.map((p) => {
              const isSelected = p.id === activePlan?.id;
              let statusBadgeColor = "bg-primary/10 text-primary border-primary/20";
              if (p.status === "in_transit") statusBadgeColor = "bg-amber-500/10 text-amber-600 border-amber-500/30";
              if (p.status === "completed") statusBadgeColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
              if (p.status === "rejected") statusBadgeColor = "bg-destructive/10 text-destructive border-destructive/30";

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                      : "border-border/80 bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-xs text-foreground font-mono">
                        {p.id}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString()} • {p.moves.length} transfers
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] uppercase font-mono h-5 px-1.5 ${statusBadgeColor}`}>
                      {p.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {p.explanation}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
                    <span>Cost: ₹{p.totalCostEstimate}</span>
                    <span className="font-semibold text-primary">Inspect Moves ➔</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Plan Details (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {activePlan ? (
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-foreground">
                        Plan Dossier: {activePlan.id}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs uppercase font-mono">
                        {activePlan.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Created {new Date(activePlan.createdAt).toLocaleString()} • Triggered by {activePlan.triggeredBy}
                    </CardDescription>
                  </div>

                  {/* Lifecycle Workflow Action Buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {activePlan.status === "recommended" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(activePlan.id, "approved")}
                          className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve Plan</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(activePlan.id, "rejected")}
                          className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </Button>
                      </>
                    )}

                    {activePlan.status === "approved" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(activePlan.id, "in_transit")}
                        className="h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch Logistics (In Transit)</span>
                      </Button>
                    )}

                    {activePlan.status === "in_transit" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(activePlan.id, "completed")}
                        className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Delivery (Completed)</span>
                      </Button>
                    )}

                    {activePlan.status === "completed" && (
                      <Badge variant="outline" className="h-7 px-2.5 text-xs text-emerald-600 border-emerald-500/40 bg-emerald-500/10 font-semibold gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Delivery Verified</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Plan Summary Banner */}
                <div className="p-3.5 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                  <div className="font-semibold text-primary uppercase text-[11px] tracking-wide">
                    Optimization Engine Explanation
                  </div>
                  <p className="text-foreground mt-1 leading-relaxed">
                    {activePlan.explanation}
                  </p>
                </div>

                {/* Moves Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Transfer Moves ({activePlan.moves.length})
                  </h4>

                  <div className="rounded-lg border border-border/80 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs hover:bg-transparent">
                          <TableHead className="font-semibold">From Facility</TableHead>
                          <TableHead className="font-semibold">To Deficit Facility</TableHead>
                          <TableHead className="font-semibold">Medicine</TableHead>
                          <TableHead className="font-semibold text-center">Transfer Qty</TableHead>
                          <TableHead className="font-semibold text-center">Road Distance & ETA</TableHead>
                          <TableHead className="text-right font-semibold pr-4">Shelf-Life Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activePlan.moves.map((m, idx) => (
                          <TableRow key={idx} className="text-xs hover:bg-muted/40">
                            <TableCell>
                              <div className="font-semibold text-foreground">{m.from_phc_name}</div>
                              <div className="text-[10px] text-muted-foreground">{m.from_district}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-destructive">{m.to_phc_name}</div>
                              <div className="text-[10px] text-muted-foreground">{m.to_district}</div>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              {m.medicine_name}
                            </TableCell>
                            <TableCell className="text-center font-bold font-mono text-primary">
                              {m.quantity.toLocaleString()} units
                            </TableCell>
                            <TableCell className="text-center font-mono">
                              <div>{m.distance_km} km</div>
                              <div className="text-[10px] text-muted-foreground">{m.eta_minutes} mins (OSRM)</div>
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              {m.near_expiry_units > 0 ? (
                                <Badge variant="outline" className="h-5 px-1.5 text-[9px] border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                                  Rescues {m.near_expiry_units} Expiring
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="h-5 px-1.5 text-[9px] text-muted-foreground">
                                  Surplus Buffer
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Plain Language Move Explanations */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Algorithmic Rationales (Per Move)
                  </h4>
                  <div className="space-y-2">
                    {activePlan.moves.map((m, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-muted/30 border border-border/60 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Navigation className="w-3.5 h-3.5 text-primary" />
                          <span>{m.from_phc_name} ➔ {m.to_phc_name} ({m.quantity} units)</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] mt-1 leading-snug">
                          {m.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center bg-card border border-border/80 rounded-xl text-muted-foreground">
              Select or generate a redistribution plan to inspect logistics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
