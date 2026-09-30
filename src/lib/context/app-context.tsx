"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type UserRole = "state_officer" | "district_officer" | "phc_staff";
export type NodeId = "node_in_karnataka";

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  selectedNode: NodeId;
  setSelectedNode: (node: NodeId) => void;
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  isEmergencyActive: boolean;
  setEmergencyActive: (active: boolean) => void;
  triggerEmergencyMode: () => Promise<void>;
  resetEmergencyMode: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()}`;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("state_officer");
  const [selectedNode, setSelectedNodeState] = useState<NodeId>("node_in_karnataka");
  const [selectedDistrict, setSelectedDistrictState] = useState<string>("All Districts");
  const [isEmergencyActive, setEmergencyActive] = useState<boolean>(false);

  useEffect(() => {
    const savedRole = getCookie("phc_role") as UserRole | null;
    const savedDistrict = getCookie("phc_district");
    const savedEmergency = getCookie("phc_emergency");

    if (savedRole && ["state_officer", "district_officer", "phc_staff"].includes(savedRole)) {
      setRoleState(savedRole);
    }
    setSelectedNodeState("node_in_karnataka");
    if (savedDistrict) {
      setSelectedDistrictState(savedDistrict);
    }
    if (savedEmergency === "true") {
      setEmergencyActive(true);
    }
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setCookie("phc_role", newRole);
  };

  const setSelectedNode = (newNode: NodeId) => {
    setSelectedNodeState(newNode);
    setCookie("phc_node", newNode);
  };

  const setSelectedDistrict = (newDist: string) => {
    setSelectedDistrictState(newDist);
    setCookie("phc_district", newDist);
  };

  const triggerEmergencyMode = async () => {
    setEmergencyActive(true);
    setCookie("phc_emergency", "true");
    try {
      await fetch("/api/simulation/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger" }),
      });
    } catch (e) {
      console.error("Failed to trigger emergency mode API:", e);
    }
  };

  const resetEmergencyMode = async () => {
    setEmergencyActive(false);
    setCookie("phc_emergency", "false");
    try {
      await fetch("/api/simulation/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
    } catch (e) {
      console.error("Failed to reset emergency mode API:", e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        selectedNode,
        setSelectedNode,
        selectedDistrict,
        setSelectedDistrict,
        isEmergencyActive,
        setEmergencyActive,
        triggerEmergencyMode,
        resetEmergencyMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
