"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";

export function NodeSwitcher() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background/80 border border-border/80 text-xs font-medium text-foreground">
      <span className="text-sm">🇮🇳</span>
      <span className="font-semibold text-primary">Karnataka Health Hub</span>
      <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1 text-muted-foreground border-border/60">
        164 Facilities
      </Badge>
    </div>
  );
}
