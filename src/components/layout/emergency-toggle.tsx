"use client";

import React, { useState } from "react";
import { useApp } from "@/lib/context/app-context";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Flame } from "lucide-react";
import { toast } from "sonner";

export function EmergencyToggle() {
  const { isEmergencyActive, triggerEmergencyMode, resetEmergencyMode } = useApp();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isEmergencyActive) {
        await resetEmergencyMode();
        toast.success("Emergency Mode Deactivated", {
          description: "Outbreak cluster reset to normal baseline surveillance.",
        });
      } else {
        await triggerEmergencyMode();
        toast.error("EMERGENCY MODE ACTIVATED!", {
          description: "Epidemic fever cluster injected in Kalaburagi. AI redistribution & early warnings initiated.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isEmergencyActive ? "destructive" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={`h-8 px-2.5 text-xs font-semibold gap-1.5 transition-all duration-200 ${
        isEmergencyActive
          ? "animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20"
          : "border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
      }`}
    >
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : isEmergencyActive ? (
        <Flame className="w-3.5 h-3.5 fill-current" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
      )}
      <span>{isEmergencyActive ? "EMERGENCY ACTIVE" : "Simulate Outbreak"}</span>
    </Button>
  );
}
