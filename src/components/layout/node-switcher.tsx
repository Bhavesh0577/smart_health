"use client";

import React from "react";
import { useApp, NodeId } from "@/lib/context/app-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const NODES: { id: NodeId; label: string; flag: string; phcCount: number }[] = [
  { id: "node_in_karnataka", label: "India (Karnataka)", flag: "🇮🇳", phcCount: 70 },
  { id: "node_br_bahia", label: "Brazil (Bahia)", flag: "🇧🇷", phcCount: 20 },
  { id: "node_za_kzn", label: "South Africa (KZN)", flag: "🇿🇦", phcCount: 20 },
];

export function NodeSwitcher() {
  const { selectedNode, setSelectedNode } = useApp();

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedNode}
        onValueChange={(val) => setSelectedNode(val as NodeId)}
      >
        <SelectTrigger className="h-8 px-2.5 bg-background/80 border-border/80 text-xs font-medium w-[190px]">
          <div className="flex items-center gap-1.5 truncate">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">
              {NODES.find((n) => n.id === selectedNode)?.flag}{" "}
              {NODES.find((n) => n.id === selectedNode)?.label}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent align="end">
          {NODES.map((node) => (
            <SelectItem key={node.id} value={node.id} className="text-xs">
              <div className="flex items-center justify-between w-full gap-3">
                <span>
                  {node.flag} {node.label}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {node.phcCount} PHCs
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
