"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  AlertTriangle,
  Bed,
  Users,
  ExternalLink,
  Layers,
  RefreshCw,
  Navigation,
  ShieldCheck,
  Flame,
} from "lucide-react";
import type { PhcSummary } from "@/lib/services/phc-service";

const NODE_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  node_in_karnataka: { center: [75.8, 14.5], zoom: 6.8 },
  node_br_bahia: { center: [-39.5, -13.0], zoom: 6.2 },
  node_za_kzn: { center: [30.5, -29.0], zoom: 7.0 },
};

export function MapView() {
  const { selectedNode, selectedDistrict, setSelectedDistrict, isEmergencyActive } = useApp();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [phcs, setPhcs] = useState<PhcSummary[]>([]);
  const [selectedPhc, setSelectedPhc] = useState<PhcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterRisk, setFilterRisk] = useState<"all" | "critical" | "warning" | "healthy">("all");

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
      console.error("Failed to load map PHCs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhcs();
  }, [selectedNode, selectedDistrict]);

  // Initialize and update MapLibre GL map
  useEffect(() => {
    if (!mapContainer.current || typeof window === "undefined") return;

    let maplibre: any;
    let isCancelled = false;

    import("maplibre-gl").then((module: any) => {
      if (isCancelled) return;
      maplibre = module.default || module;

      // Add stylesheet dynamically if not present
      if (!document.getElementById("maplibre-css")) {
        const link = document.createElement("link");
        link.id = "maplibre-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        document.head.appendChild(link);
      }

      const nodeConfig = NODE_CENTERS[selectedNode] || NODE_CENTERS.node_in_karnataka;

      if (!mapInstance.current) {
        const map = new maplibre.Map({
          container: mapContainer.current!,
          style: {
            version: 8,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [
              {
                id: "osm-layer",
                type: "raster",
                source: "osm",
                minzoom: 0,
                maxzoom: 19,
              },
            ],
          },
          center: nodeConfig.center,
          zoom: nodeConfig.zoom,
        });

        map.addControl(new maplibre.NavigationControl(), "top-right");
        mapInstance.current = map;
      } else {
        mapInstance.current.flyTo({
          center: nodeConfig.center,
          zoom: nodeConfig.zoom,
          essential: true,
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedNode]);

  // Render Markers on Map
  useEffect(() => {
    if (!mapInstance.current || phcs.length === 0) return;

    import("maplibre-gl").then((module: any) => {
      const maplibre = module.default || module;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const filtered = filterRisk === "all" ? phcs : phcs.filter((p) => p.riskLevel === filterRisk);

      filtered.forEach((p) => {
        const el = document.createElement("div");
        el.className = "phc-marker-pin group cursor-pointer transition-transform duration-200 hover:scale-125 z-10";

        let bgColor = "bg-emerald-500 shadow-emerald-500/50";
        let ringColor = "ring-emerald-400";
        if (p.riskLevel === "critical") {
          bgColor = "bg-destructive shadow-destructive/50 animate-bounce";
          ringColor = "ring-rose-400";
        } else if (p.riskLevel === "warning") {
          bgColor = "bg-amber-500 shadow-amber-500/50";
          ringColor = "ring-amber-400";
        }

        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-6 w-6 rounded-full opacity-40 ${ringColor} ring-4"></span>
            <div class="h-4 w-4 rounded-full ${bgColor} shadow-md border-2 border-white flex items-center justify-center">
              <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
            </div>
          </div>
        `;

        el.addEventListener("click", () => {
          setSelectedPhc(p);
        });

        const marker = new maplibre.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .addTo(mapInstance.current);

        markersRef.current.push(marker);
      });
    });
  }, [phcs, filterRisk]);

  return (
    <div className="space-y-4 pb-8">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Live GIS Surveillance & Resource Network
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time geospatial health facility mapping • Colored by stockout & bed occupancy risk
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
            <button
              onClick={() => setFilterRisk("all")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterRisk === "all" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({phcs.length})
            </button>
            <button
              onClick={() => setFilterRisk("critical")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterRisk === "critical" ? "bg-destructive text-destructive-foreground shadow-xs font-semibold" : "text-destructive hover:bg-destructive/10"
              }`}
            >
              Critical ({phcs.filter((p) => p.riskLevel === "critical").length})
            </button>
            <button
              onClick={() => setFilterRisk("warning")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterRisk === "warning" ? "bg-amber-500 text-white shadow-xs font-semibold" : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              Warning ({phcs.filter((p) => p.riskLevel === "warning").length})
            </button>
            <button
              onClick={() => setFilterRisk("healthy")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filterRisk === "healthy" ? "bg-emerald-600 text-white shadow-xs font-semibold" : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              Optimal ({phcs.filter((p) => p.riskLevel === "healthy").length})
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={fetchPhcs} className="h-8 px-2.5 text-xs gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Map + Detail Dossier Drawer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Container (2 cols on desktop) */}
        <div className="lg:col-span-2 relative h-[600px] rounded-xl overflow-hidden border border-border/80 shadow-xs bg-muted/20">
          <div ref={mapContainer} className="w-full h-full" />

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-md p-3 rounded-lg border border-border/80 text-xs shadow-md space-y-1.5 z-20">
            <div className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Surveillance Legend
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse"></span>
              <span className="text-muted-foreground">Critical Stockout (&lt; 3.0 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              <span className="text-muted-foreground">Warning Vulnerability (3-7 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-muted-foreground">Optimal Inventory (&gt; 7 days)</span>
            </div>
          </div>

          {/* Emergency Outbreak Banner if Active */}
          {isEmergencyActive && (
            <div className="absolute top-4 left-4 bg-destructive/90 backdrop-blur-md text-destructive-foreground px-3 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 z-20 border border-white/20 animate-pulse">
              <Flame className="w-4 h-4" />
              <span>EMERGENCY EPIDEMIC CLUSTER ACTIVE (Kalaburagi Outbreak)</span>
            </div>
          )}
        </div>

        {/* Selected PHC Dossier Card */}
        <div className="h-[600px] flex flex-col">
          {selectedPhc ? (
            <Card className="h-full flex flex-col border-border/80 shadow-xs overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {selectedPhc.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {selectedPhc.district}, {selectedPhc.state} • {selectedPhc.type}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      selectedPhc.riskLevel === "critical"
                        ? "destructive"
                        : selectedPhc.riskLevel === "warning"
                        ? "default"
                        : "outline"
                    }
                    className="text-[10px] uppercase font-mono h-5"
                  >
                    {selectedPhc.riskLevel}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Resilience Score Gauge */}
                <div className="p-3 rounded-lg bg-card border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Facility Resilience Score
                    </div>
                    <div className="text-xl font-extrabold text-foreground mt-0.5">
                      {selectedPhc.resilienceScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`h-6 px-2 text-xs font-semibold ${
                      selectedPhc.resilienceScore >= 80
                        ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                        : selectedPhc.resilienceScore >= 70
                        ? "border-amber-500/40 text-amber-600 bg-amber-500/10"
                        : "border-destructive/40 text-destructive bg-destructive/10"
                    }`}
                  >
                    {selectedPhc.resilienceScore >= 80 ? "High Resilience" : "Vulnerable"}
                  </Badge>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">Min Days of Cover</span>
                    <span className={`text-base font-bold ${selectedPhc.minDaysOfCover <= 3.0 ? "text-destructive" : "text-foreground"}`}>
                      {selectedPhc.minDaysOfCover} days
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">Bed Occupancy</span>
                    <span className="text-base font-bold text-foreground">
                      {selectedPhc.bedOccupancyPercent}%
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {selectedPhc.occupiedBeds}/{selectedPhc.bedCapacity} beds
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">Staff Attendance</span>
                    <span className="text-base font-bold text-foreground">
                      {selectedPhc.staffAttendancePercent}%
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {selectedPhc.doctorsPresent} Doctors on duty
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground block text-[10px]">Oxygen Capacity</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {selectedPhc.availableOxygenBeds}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">O2 beds ready</span>
                  </div>
                </div>

                {/* Coordinates & Target Population */}
                <div className="text-[11px] text-muted-foreground space-y-1 p-2.5 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex justify-between">
                    <span>Coordinates:</span>
                    <span className="font-mono text-foreground font-medium">
                      {selectedPhc.lat.toFixed(4)}, {selectedPhc.lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Population:</span>
                    <span className="font-medium text-foreground">
                      {selectedPhc.targetPopulation.toLocaleString()} citizens
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Telemetry Status:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {selectedPhc.lastSync}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <Link href={`/phcs/${selectedPhc.id}`} className="w-full">
                    <Button className="w-full text-xs font-semibold gap-2">
                      <span>Open Full Facility Dossier & Stock Ledger</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col items-center justify-center p-6 text-center border-border/80 shadow-xs text-muted-foreground">
              <MapPin className="w-10 h-10 mb-3 text-muted-foreground/40 animate-pulse" />
              <h3 className="text-sm font-semibold text-foreground">No Facility Selected</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Click on any marker on the map to inspect real-time stock levels, bed availability, staff attendance, and resilience metrics.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
