"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Info, ArrowRight, X, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SimulatedFeedBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="w-full bg-gradient-to-r from-purple-950/40 via-background to-blue-950/40 border-b border-purple-500/20 px-4 py-2 text-xs transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px] h-4.5 px-1.5 font-mono gap-1 shrink-0"
          >
            <Database className="w-2.5 h-2.5" />
            <span>SIMULATED OPERATIONAL FEED</span>
          </Badge>
          <span className="text-muted-foreground truncate">
            Facility stock levels, bed occupancies, and patient footfall are simulated and calibrated against{" "}
            <strong className="text-foreground font-medium">real Census 2011 populations</strong> and{" "}
            <strong className="text-foreground font-medium">real Open-Meteo weather</strong>. Sovereign nodes do not publish patient-level records.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/provenance"
            className="text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1 hover:underline text-[11px]"
          >
            <span>Audit Provenance & Ingestion</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
