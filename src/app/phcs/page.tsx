"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2,
  Search,
  Filter,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  MapPin,
} from "lucide-react";
import type { PhcSummary } from "@/lib/services/phc-service";

export default function PhcsDirectoryPage() {
  const { selectedNode, selectedDistrict, setSelectedDistrict } = useApp();
  const [phcs, setPhcs] = useState<PhcSummary[]>([]);
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState<"all" | "critical" | "warning" | "healthy">("all");
  const [loading, setLoading] = useState(true);

  const fetchPhcs = async () => {
    try {
      setLoading(true);
      const distParam = selectedDistrict !== "All Districts" ? `&district=${encodeURIComponent(selectedDistrict)}` : "";
      const res = await fetch(`/api/phcs?node=${selectedNode}${distParam}`);
      const json = await res.json();
      if (json.success) {
        setPhcs(json.data);
      }
    } catch (e) {
      console.error("Failed to load PHCs directory:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhcs();
  }, [selectedNode, selectedDistrict]);

  const filtered = phcs.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.district.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = filterRisk === "all" || p.riskLevel === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const districts = Array.from(new Set(phcs.map((p) => p.district)));

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Primary Health Centre (PHC) Directory
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Surveillance of all facilities in {selectedNode} • Inventory cover, bed capacity, staffing, and resilience scores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/map">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Map View</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchPhcs} className="h-8 text-xs gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search facility name or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md bg-background border border-border text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* District Select */}
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="h-9 px-2.5 rounded-md border border-border bg-background text-xs font-medium text-foreground focus:outline-hidden"
          >
            <option value="All Districts">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Risk Filter Buttons */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-md border border-border">
            <button
              onClick={() => setFilterRisk("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${filterRisk === "all" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterRisk("critical")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${filterRisk === "critical" ? "bg-destructive text-destructive-foreground font-semibold" : "text-destructive"}`}
            >
              Critical
            </button>
            <button
              onClick={() => setFilterRisk("warning")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${filterRisk === "warning" ? "bg-amber-500 text-white font-semibold" : "text-amber-600 dark:text-amber-400"}`}
            >
              Warning
            </button>
            <button
              onClick={() => setFilterRisk("healthy")}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm ${filterRisk === "healthy" ? "bg-emerald-600 text-white font-semibold" : "text-emerald-600 dark:text-emerald-400"}`}
            >
              Optimal
            </button>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs hover:bg-transparent">
                  <TableHead className="font-semibold">Facility Name</TableHead>
                  <TableHead className="font-semibold">District</TableHead>
                  <TableHead className="font-semibold text-center">Type</TableHead>
                  <TableHead className="font-semibold text-center">Stock Cover</TableHead>
                  <TableHead className="font-semibold text-center">Beds Occupied</TableHead>
                  <TableHead className="font-semibold text-center">Staff Attendance</TableHead>
                  <TableHead className="font-semibold text-center">Resilience Score</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="text-right font-semibold pr-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="text-xs hover:bg-muted/40">
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/phcs/${p.id}`} className="hover:text-primary transition-colors">
                        {p.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.district}</TableCell>
                    <TableCell className="text-center font-mono text-[11px]">
                      {p.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold font-mono ${p.minDaysOfCover <= 3.0 ? "text-destructive" : p.minDaysOfCover <= 7.0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {p.minDaysOfCover} days
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {p.occupiedBeds}/{p.bedCapacity} ({p.bedOccupancyPercent}%)
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {p.staffAttendancePercent}% ({p.doctorsPresent} MDs)
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-mono h-5 ${
                          p.resilienceScore >= 80
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : p.resilienceScore >= 70
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {p.resilienceScore} / 100
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          p.riskLevel === "critical"
                            ? "destructive"
                            : p.riskLevel === "warning"
                            ? "default"
                            : "outline"
                        }
                        className="text-[10px] uppercase font-mono h-5"
                      >
                        {p.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Link href={`/phcs/${p.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-primary">
                          <span>Dossier</span>
                          <ArrowRight className="w-3 h-3" />
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
    </div>
  );
}
