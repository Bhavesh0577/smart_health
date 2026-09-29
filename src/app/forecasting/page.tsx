"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context/app-context";
import { ForecastChart } from "@/components/forecast/forecast-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, RefreshCw, Sparkles, AlertTriangle } from "lucide-react";
import type { ForecastResult } from "@/lib/ml-client";
import type { PhcSummary } from "@/lib/services/phc-service";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";

const MEDICINES = [
  { id: "MED_ORS", name: "Oral Rehydration Salts (ORS) Sachets", desc: "Monsoon Diarrhea Priority" },
  { id: "MED_AL", name: "Artemether-Lumefantrine (Antimalarial)", desc: "Vector-borne Surge Priority" },
  { id: "MED_PARA", name: "Paracetamol 500mg Tablets", desc: "Acute Fever Prophylaxis" },
  { id: "MED_AMOX", name: "Amoxicillin 500mg Capsules", desc: "Bacterial Infection Control" },
  { id: "MED_AZI", name: "Azithromycin 500mg Tablets", desc: "Macrolide Antibiotic" },
  { id: "MED_INS", name: "Insulin Regular 100 IU/mL Vials", desc: "Chronic Diabetes Management" },
];

export default function ForecastingPage() {
  const { selectedNode, selectedDistrict } = useApp();
  const [phcs, setPhcs] = useState<PhcSummary[]>([]);
  const [selectedPhcId, setSelectedPhcId] = useState<string>("");
  const [selectedMedId, setSelectedMedId] = useState<string>("MED_ORS");
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Load facilities for the selected node
  useEffect(() => {
    async function loadPhcs() {
      try {
        const res = await fetch(`/api/phcs?node=${selectedNode}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          setPhcs(json.data);
          // Default to the first critical PHC if available (e.g. Ullal or Aland)
          const critical = json.data.find((p: any) => p.riskLevel === "critical") || json.data[0];
          setSelectedPhcId(critical.id);
        }
      } catch (e) {
        console.error("Failed to load facilities for forecast:", e);
      }
    }
    loadPhcs();
  }, [selectedNode]);

  // Load forecast when PHC or medicine changes
  const runForecast = async () => {
    if (!selectedPhcId) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/forecast?phcId=${selectedPhcId}&medicineId=${selectedMedId}&node=${selectedNode}&horizon=14`
      );
      const json = await res.json();
      if (json.success) {
        setForecast(json.data);
      }
    } catch (e) {
      console.error("Forecast failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPhcId) {
      runForecast();
    }
  }, [selectedPhcId, selectedMedId, selectedNode]);

  const activePhc = phcs.find((p) => p.id === selectedPhcId);
  const activeMed = MEDICINES.find((m) => m.id === selectedMedId);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Parametric Demand Forecasting & Stockout Prediction
            </h1>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              Phase 3 • Fast ML
            </Badge>
            <ProvenanceBadge origin="derived" size="sm" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            14-day auto-regressive Ridge regression incorporating real Open-Meteo precipitation, IDSP seasonal priors, and calibrated telemetry
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={runForecast}
          disabled={loading}
          className="h-8 text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Re-compute Horizon</span>
        </Button>
      </div>

      {/* Target Selector Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-lg bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase block">
              Target Primary Health Centre (PHC)
            </label>
            <ProvenanceBadge origin="real" size="sm" />
          </div>
          <select
            value={selectedPhcId}
            onChange={(e) => setSelectedPhcId(e.target.value)}
            className="w-full h-9 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden"
          >
            {phcs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.district}) - {p.riskLevel.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase block">
              Essential Medicine (NLEM Formulation)
            </label>
            <ProvenanceBadge origin="real" size="sm" />
          </div>
          <select
            value={selectedMedId}
            onChange={(e) => setSelectedMedId(e.target.value)}
            className="w-full h-9 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden"
          >
            {MEDICINES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.desc})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Forecast Output */}
      {loading && !forecast ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Running parametric linear model on time-series history...</p>
        </div>
      ) : forecast ? (
        <ForecastChart
          forecast={forecast}
          medicineName={activeMed?.name}
          facilityName={activePhc?.name}
        />
      ) : (
        <div className="text-center p-8 text-muted-foreground">
          Select a facility and medicine to generate demand forecast.
        </div>
      )}
    </div>
  );
}
