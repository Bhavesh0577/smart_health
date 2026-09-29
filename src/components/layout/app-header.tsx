"use client";

import React, { useEffect, useState } from "react";
import { NodeSwitcher } from "./node-switcher";
import { RoleSwitcher } from "./role-switcher";
import { EmergencyToggle } from "./emergency-toggle";
import { ThemeToggle } from "./theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Activity, ShieldCheck, Radio } from "lucide-react";

export function AppHeader() {
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  // Monitor SSE stream connectivity
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/stream/updates");
      es.onopen = () => setIsLiveConnected(true);
      es.onerror = () => setIsLiveConnected(false);
    } catch {
      setIsLiveConnected(false);
    }
    return () => {
      es?.close();
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between px-4 gap-2">
        {/* Left Branding & Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-foreground">
                  PHC Resilience Grid
                </span>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal border-primary/30 text-primary">
                  BRICS Track 3
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Federated Health Supply Chain
              </span>
            </div>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden md:inline">SSE LIVE</span>
          </div>

          {/* Synthetic Data Label */}
          <Badge variant="secondary" className="hidden lg:inline-flex text-[10px] h-5 font-mono px-2 uppercase tracking-wider bg-muted/80 text-muted-foreground border border-border">
            SYNTHETIC DATA
          </Badge>
        </div>

        {/* Right Switchers and Controls */}
        <div className="flex items-center gap-2">
          <EmergencyToggle />
          <NodeSwitcher />
          <RoleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
