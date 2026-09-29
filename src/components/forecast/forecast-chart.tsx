"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, AlertTriangle, ShieldCheck, Activity, Brain } from "lucide-react";
import type { ForecastResult } from "@/lib/ml-client";

interface ForecastChartProps {
  forecast: ForecastResult;
  medicineName?: string;
  facilityName?: string;
}

export function ForecastChart({ forecast, medicineName = "Medicine", facilityName }: ForecastChartProps) {
  const chartData = forecast.predictions.map((p) => ({
    date: p.date.slice(5),
    fullDate: p.date,
    day: `Day ${p.day}`,
    expected: p.expected_demand,
    lower: p.lower_bound,
    upper: p.upper_bound,
    range: [p.lower_bound, p.upper_bound],
    stock: p.projected_stock,
  }));

  return (
    <div className="space-y-4">
      {/* Forecast Status Metric Ribbons */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-card border border-border shadow-xs">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">
            Days of Cover
          </div>
          <div className="text-xl font-bold mt-0.5 text-foreground">
            {forecast.days_of_cover} <span className="text-xs font-normal text-muted-foreground">days</span>
          </div>
          <Badge
            variant={forecast.days_of_cover <= 3.0 ? "destructive" : forecast.days_of_cover <= 7.0 ? "default" : "outline"}
            className="text-[9px] h-4 mt-1.5 px-1.5"
          >
            {forecast.days_of_cover <= 3.0 ? "Stockout Imminent" : forecast.days_of_cover <= 7.0 ? "Warning Buffer" : "Resilient"}
          </Badge>
        </div>

        <div className="p-3 rounded-lg bg-card border border-border shadow-xs">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">
            Stockout Probability (14-day)
          </div>
          <div className="text-xl font-bold mt-0.5 text-foreground">
            {Math.round(forecast.stockout_probability * 100)}%
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Normal CDF Integration
          </p>
        </div>

        <div className="p-3 rounded-lg bg-card border border-border shadow-xs">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground">
            Expected 14d Demand
          </div>
          <div className="text-xl font-bold mt-0.5 text-foreground">
            {forecast.total_expected_14d_demand} <span className="text-xs font-normal text-muted-foreground">units</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Cumulative consumption
          </p>
        </div>

        <div className="p-3 rounded-lg bg-card border border-border shadow-xs bg-primary/5">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
            <Brain className="w-3 h-3 text-primary" />
            Model R² Accuracy
          </div>
          <div className="text-xl font-bold mt-0.5 text-primary">
            {forecast.model_r2.toFixed(3)}
          </div>
          <Badge variant="outline" className="text-[9px] h-4 mt-1.5 px-1.5 border-primary/30 text-primary">
            Parametric Ridge
          </Badge>
        </div>
      </div>

      {/* Main Confidence Band Chart */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                14-Day Demand Forecast & Projected Stock Depletion
              </CardTitle>
              <CardDescription className="text-xs">
                {medicineName} {facilityName ? `at ${facilityName}` : ""} • Shaded 95% Confidence Interval Band (±1.96σ)
              </CardDescription>
            </div>
            {forecast.is_stockout_projected && (
              <Badge variant="destructive" className="text-[10px] h-5 px-2 animate-pulse self-start sm:self-auto">
                Stockout Expected at Day {forecast.projected_stockout_day}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="demand" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="stock" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderColor: "#374151",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#fff",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

                {/* Confidence Interval Band */}
                <Area
                  yAxisId="demand"
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#3b82f6"
                  fillOpacity={0.15}
                  name="Upper Bound (95%)"
                />
                <Area
                  yAxisId="demand"
                  type="monotone"
                  dataKey="lower"
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={0.0}
                  name="Lower Bound (95%)"
                />

                {/* Expected Demand Line */}
                <Line
                  yAxisId="demand"
                  type="monotone"
                  dataKey="expected"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Expected Daily Demand"
                />

                {/* Remaining Stock Line */}
                <Line
                  yAxisId="stock"
                  type="monotone"
                  dataKey="stock"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Projected Inventory Stock"
                />

                <ReferenceLine yAxisId="stock" y={0} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Zero Stockout', fill: '#dc2626', fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Model Parameters / Federated Weight Breakdown Card */}
      <Card className="border-border/80 shadow-xs bg-muted/20">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Federated Parametric Weights (Ridge Regression Coefficients)</span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              Shared Weights Only • No Raw Patient Records Exchanged
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
            {Object.entries(forecast.model_weights).map(([k, v]) => (
              <div key={k} className="p-2 rounded bg-background border border-border/60">
                <span className="text-[10px] text-muted-foreground block truncate">{k}</span>
                <span className="font-mono font-bold text-foreground text-xs">{typeof v === "number" ? v.toFixed(3) : v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
