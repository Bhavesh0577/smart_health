"use client";

import React from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { AppProvider } from "@/lib/context/app-context";
import { ThemeProvider } from "../theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SimulatedFeedBanner } from "@/components/ui/simulated-feed-banner";
import Link from "next/link";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
          <AppHeader />
          <div className="flex-1 flex overflow-hidden">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto min-h-[calc(100vh-3.5rem)] pb-12">
              <SimulatedFeedBanner />
              <div className="container mx-auto p-4 md:p-6 max-w-7xl">
                {children}
              </div>
            </main>
          </div>

          {/* Fixed Footer Watermark */}
          <footer className="h-7 border-t border-border/60 bg-muted/30 px-4 flex items-center justify-between text-[11px] text-muted-foreground fixed bottom-0 left-0 right-0 z-30 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground/80">
                BRICS Track 3: Smart Health & Supply Chain Resilience
              </span>
              <span className="hidden sm:inline">•</span>
              <Link
                href="/provenance"
                className="hidden sm:inline font-mono text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
              >
                PROVENANCE AUDIT: REAL GEOGRAPHY & WEATHER • CALIBRATED SIMULATION
              </Link>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span>TimescaleDB + Drizzle + FastAPI + OR-Tools + Gemini</span>
            </div>
          </footer>
        </div>
        <Toaster position="top-right" richColors />
      </AppProvider>
    </ThemeProvider>
  );
}
