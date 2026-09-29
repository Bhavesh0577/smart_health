"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  Building2,
  AlertTriangle,
  ArrowLeftRight,
  Network,
  Bot,
  SlidersHorizontal,
  Smartphone,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  title: string;
  href: string;
  icon: any;
  badge?: string;
  highlight?: boolean;
}

const NAV_ITEMS: { category: string; items: NavItem[] }[] = [
  {
    category: "Surveillance & Visibility",
    items: [
      {
        title: "National Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
      {
        title: "Live GIS Map",
        href: "/map",
        icon: MapPin,
      },
      {
        title: "PHC Network",
        href: "/phcs",
        icon: Building2,
      },
    ],
  },
  {
    category: "Resilience & AI",
    items: [
      {
        title: "Demand Forecasting",
        href: "/forecasting",
        icon: TrendingUp,
      },
      {
        title: "Early Warning Alerts",
        href: "/alerts",
        icon: AlertTriangle,
        badge: "Active",
      },
      {
        title: "Smart Redistribution",
        href: "/redistribution",
        icon: ArrowLeftRight,
      },
      {
        title: "Federated AI Hub",
        href: "/federation",
        icon: Network,
        badge: "BRICS Core",
        highlight: true,
      },
      {
        title: "Gemini Copilot",
        href: "/copilot",
        icon: Bot,
      },
      {
        title: "Resilience Simulator",
        href: "/simulation",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    category: "Field Operations & Audit",
    items: [
      {
        title: "PHC Field Staff (PWA)",
        href: "/phc",
        icon: Smartphone,
      },
      {
        title: "Impact Backtest",
        href: "/impact",
        icon: BarChart3,
      },
      {
        title: "Data Provenance",
        href: "/provenance",
        icon: ShieldCheck,
        badge: "Audit",
        highlight: true,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border/80 bg-sidebar/50 backdrop-blur-sm shrink-0 hidden md:flex flex-col justify-between py-3 px-3 min-h-[calc(100vh-3.5rem)]">
      <div className="space-y-6">
        {NAV_ITEMS.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {section.category}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      item.highlight && !isActive && "text-primary/90 font-semibold"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                          isActive
                            ? "text-primary-foreground"
                            : item.highlight
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <span>{item.title}</span>
                    </div>

                    {item.badge && (
                      <Badge
                        variant={isActive ? "secondary" : "outline"}
                        className={cn(
                          "text-[9px] h-4 px-1.5 font-normal",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground border-none"
                            : item.highlight
                            ? "border-primary/40 text-primary"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Sovereign Node Status */}
      <div className="pt-3 border-t border-border/60">
        <div className="p-2.5 rounded-lg bg-card/60 border border-border/60 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Sovereignty Mode
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
              LOCAL ONLY
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Raw patient records stay on the local node schema. Only differential-privacy model weights federate.
          </p>
        </div>
      </div>
    </aside>
  );
}
