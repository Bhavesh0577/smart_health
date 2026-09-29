import React from "react";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Cpu, Database } from "lucide-react";
import { cn } from "cn";

export interface ProvenanceBadgeProps {
  origin: "real" | "derived" | "simulated" | string;
  sourceDataset?: string;
  className?: string;
  size?: "sm" | "default";
  showLabel?: boolean;
}

export function ProvenanceBadge({
  origin,
  sourceDataset,
  className,
  size = "sm",
  showLabel = true,
}: ProvenanceBadgeProps) {
  const normOrigin = (origin || "real").toLowerCase();

  if (normOrigin === "real") {
    return (
      <Badge
        variant="outline"
        title={sourceDataset ? `Data Origin: REAL (${sourceDataset})` : "Data Origin: REAL authoritative public data"}
        className={cn(
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-mono tracking-tight",
          size === "sm" ? "text-[10px] px-1.5 py-0 h-4.5" : "text-xs px-2 py-0.5 h-5",
          className
        )}
      >
        <ShieldCheck className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        {showLabel && <span>REAL</span>}
      </Badge>
    );
  }

  if (normOrigin === "derived") {
    return (
      <Badge
        variant="outline"
        title={sourceDataset ? `Data Origin: DERIVED (${sourceDataset})` : "Data Origin: DERIVED from authoritative baseline"}
        className={cn(
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-mono tracking-tight",
          size === "sm" ? "text-[10px] px-1.5 py-0 h-4.5" : "text-xs px-2 py-0.5 h-5",
          className
        )}
      >
        <Cpu className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
        {showLabel && <span>DERIVED</span>}
      </Badge>
    );
  }

  // Simulated
  return (
    <Badge
      variant="outline"
      title={sourceDataset ? `Data Origin: SIMULATED (${sourceDataset})` : "Data Origin: SIMULATED calibrated operational feed"}
      className={cn(
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1 font-mono tracking-tight",
        size === "sm" ? "text-[10px] px-1.5 py-0 h-4.5" : "text-xs px-2 py-0.5 h-5",
        className
      )}
    >
      <Database className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {showLabel && <span>SIMULATED</span>}
    </Badge>
  );
}
