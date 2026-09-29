"use client";

import React from "react";
import { useApp, UserRole } from "@/lib/context/app-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, Building2, UserCog } from "lucide-react";

const ROLES: { id: UserRole; title: string; subtitle: string; icon: any }[] = [
  {
    id: "state_officer",
    title: "State Officer (HQ)",
    subtitle: "State Mission Director",
    icon: Building2,
  },
  {
    id: "district_officer",
    title: "District Officer",
    subtitle: "District Health Officer (DHO)",
    icon: ShieldAlert,
  },
  {
    id: "phc_staff",
    title: "PHC Staff / MO",
    subtitle: "Primary Health Centre",
    icon: UserCog,
  },
];

export function RoleSwitcher() {
  const { role, setRole } = useApp();
  const current = ROLES.find((r) => r.id === role) || ROLES[0];
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-2">
      <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
        <SelectTrigger className="h-8 px-2.5 bg-background/80 border-border/80 text-xs font-medium w-[170px]">
          <div className="flex items-center gap-1.5 truncate">
            <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{current.title}</span>
          </div>
        </SelectTrigger>
        <SelectContent align="end">
          {ROLES.map((r) => {
            const ItemIcon = r.icon;
            return (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <ItemIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex flex-col text-left">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-[10px] text-muted-foreground">{r.subtitle}</span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
