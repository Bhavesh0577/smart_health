"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Pill,
  Bed,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Send,
  Database,
  ShieldCheck,
  AlertCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  queueOfflineEntry,
  getPendingOfflineEntries,
  getAllOfflineEntries,
  flushOfflineQueue,
  OfflineEntry,
} from "@/lib/offline/db";

const MEDICINES = [
  { id: "MED_PARA", name: "Paracetamol 500mg", unit: "Tablets" },
  { id: "MED_AMOX", name: "Amoxicillin 500mg", unit: "Capsules" },
  { id: "MED_AZI", name: "Azithromycin 500mg", unit: "Tablets" },
  { id: "MED_ORS", name: "Oral Rehydration Salts (ORS)", unit: "Sachets" },
  { id: "MED_IFA", name: "Iron & Folic Acid", unit: "Tablets" },
  { id: "MED_AL", name: "Artemether-Lumefantrine 80/480mg", unit: "Tablets" },
  { id: "MED_INS", name: "Insulin Regular 100 IU/mL", unit: "Vials" },
];

export default function PhcFieldStaffPage() {
  const { selectedNode, setRole } = useApp();

  // Set role to phc_staff on entry
  useEffect(() => {
    setRole("phc_staff");
  }, []);

  // Offline / Online state
  const [isOnline, setIsOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<OfflineEntry[]>([]);
  const [allEntries, setAllEntries] = useState<OfflineEntry[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Selected Facility context
  const [phcId, setPhcId] = useState("in_kar_kalaburagi_aland");
  const [phcName, setPhcName] = useState("Aland 24x7 Taluk PHC (Kalaburagi)");

  // Active Form Tab
  const [activeTab, setActiveTab] = useState<"stock" | "beds" | "staff" | "footfall">("stock");

  // Form states
  // 1. Stock Form
  const [stockMed, setStockMed] = useState("MED_PARA");
  const [stockAction, setStockAction] = useState<"restock" | "dispensed" | "audit">("restock");
  const [stockQty, setStockQty] = useState(200);
  const [stockExpiry, setStockExpiry] = useState("2027-12-31");

  // 2. Bed Form
  const [totalBeds, setTotalBeds] = useState(12);
  const [occupiedBeds, setOccupiedBeds] = useState(8);
  const [oxygenBeds, setOxygenBeds] = useState(3);
  const [criticalBeds, setCriticalBeds] = useState(2);

  // 3. Staff Form
  const [doctorsPres, setDoctorsPres] = useState(2);
  const [nursesPres, setNursesPres] = useState(4);
  const [pharmPres, setPharmPres] = useState(1);
  const [reqStaff, setReqStaff] = useState(7);

  // 4. Footfall Form
  const [symptomCat, setSymptomCat] = useState("fever");
  const [opdCount, setOpdCount] = useState(35);

  // Register Service Worker on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("ServiceWorker registration notice:", err);
      });
    }

    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    refreshQueueState();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const refreshQueueState = async () => {
    const pending = await getPendingOfflineEntries();
    const all = await getAllOfflineEntries();
    setPendingQueue(pending);
    setAllEntries(all.slice(-10).reverse());
  };

  const effectiveOnline = isOnline && !simulateOffline;

  // Auto-sync when coming back online
  useEffect(() => {
    if (effectiveOnline && pendingQueue.length > 0) {
      handleSync();
    }
  }, [effectiveOnline]);

  const handleSync = async () => {
    if (syncing || pendingQueue.length === 0) return;
    setSyncing(true);
    try {
      const result = await flushOfflineQueue(selectedNode);
      if (result.syncedCount > 0) {
        toast.success("Offline Queue Synced", {
          description: `Successfully uploaded ${result.syncedCount} entries to the sovereign database schema.`,
        });
      }
      await refreshQueueState();
    } catch (e) {
      console.error("Sync error:", e);
      toast.error("Background sync failed; items remain safe in IndexedDB.");
    } finally {
      setSyncing(false);
    }
  };

  const handleQueueEntry = async (type: OfflineEntry["type"], payload: any) => {
    try {
      const queued = await queueOfflineEntry({
        phcId,
        type,
        payload,
      });

      await refreshQueueState();

      if (!effectiveOnline) {
        toast.warning("Queued in Offline Storage", {
          description: "No active network link. Entry saved to local IndexedDB and will auto-sync when online.",
        });
      } else {
        toast.info("Queued for Instant Sync", {
          description: "Syncing entry with central node...",
        });
        await handleSync();
      }
    } catch (e) {
      console.error("Queue error:", e);
      toast.error("Failed to write to local storage");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12">
      {/* Top Mobile Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl bg-card border border-border/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              <Smartphone className="w-3 h-3 mr-1" />
              PHC Field Staff Terminal (PWA)
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-mono">
              IndexedDB Queue
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Offline Field Operations Portal
          </h1>
          <p className="text-xs text-muted-foreground">
            Zero-data-loss telemetry queueing for remote clinics with intermittent satellite or cellular links.
          </p>
        </div>

        {/* Sync Status Badge & Action */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={effectiveOnline ? "outline" : "secondary"}
            className={`h-7 px-2.5 text-xs font-semibold gap-1.5 ${
              effectiveOnline
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                : "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 animate-pulse"
            }`}
          >
            {effectiveOnline ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>{effectiveOnline ? "ONLINE" : `OFFLINE (${pendingQueue.length})`}</span>
          </Badge>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing || pendingQueue.length === 0 || !effectiveOnline}
            className="h-7 px-2 text-xs gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </Button>
        </div>
      </div>

      {/* Simulator Toggle & Facility Context */}
      <Card className="border-border/80 bg-muted/20">
        <CardContent className="p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Active Facility:</span>
              <select
                value={phcId}
                onChange={(e) => {
                  setPhcId(e.target.value);
                  const selectedText = e.target.options[e.target.selectedIndex].text;
                  setPhcName(selectedText);
                }}
                className="bg-background border border-border/80 rounded-md px-2 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="in_kar_kalaburagi_aland">PHC Aland (Kalaburagi)</option>
                <option value="in_kar_kalaburagi_sedam">CHC Sedam (Kalaburagi)</option>
                <option value="in_kar_dk_ullal">CHC Ullal (Dakshina Kannada)</option>
                <option value="in_kar_bengaluru_nelamangala">PHC Nelamangala (Bengaluru Urban)</option>
                <option value="in_kar_belagavi_chikkodi">CHC Chikkodi (Belagavi)</option>
                <option value="in_kar_mysuru_nanjangud">THC Nanjangud (Mysuru)</option>
              </select>
            </div>

            {/* Simulated Offline Switch for demonstration */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={simulateOffline ? "destructive" : "outline"}
                onClick={() => setSimulateOffline(!simulateOffline)}
                className="h-7 text-[11px] gap-1.5"
              >
                {simulateOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                <span>{simulateOffline ? "Simulated Offline Active" : "Simulate Offline Mode"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Touch-Friendly Entry Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted/30 border border-border/80 rounded-xl">
        <Button
          size="sm"
          variant={activeTab === "stock" ? "default" : "ghost"}
          onClick={() => setActiveTab("stock")}
          className="h-9 text-xs flex items-center justify-center gap-1.5 rounded-lg"
        >
          <Pill className="w-3.5 h-3.5" />
          <span>Stock</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "beds" ? "default" : "ghost"}
          onClick={() => setActiveTab("beds")}
          className="h-9 text-xs flex items-center justify-center gap-1.5 rounded-lg"
        >
          <Bed className="w-3.5 h-3.5" />
          <span>Beds</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "staff" ? "default" : "ghost"}
          onClick={() => setActiveTab("staff")}
          className="h-9 text-xs flex items-center justify-center gap-1.5 rounded-lg"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "footfall" ? "default" : "ghost"}
          onClick={() => setActiveTab("footfall")}
          className="h-9 text-xs flex items-center justify-center gap-1.5 rounded-lg"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Footfall</span>
        </Button>
      </div>

      {/* FORM 1: Stock Inventory */}
      {activeTab === "stock" && (
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              Medicine Stock & Shipment Entry
            </CardTitle>
            <CardDescription className="text-xs">
              Log daily dispensing or shipment receipts for {phcName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Select Medicine</label>
              <select
                value={stockMed}
                onChange={(e) => setStockMed(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground"
              >
                {MEDICINES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Transaction Action</label>
                <select
                  value={stockAction}
                  onChange={(e) => setStockAction(e.target.value as any)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground"
                >
                  <option value="restock">Shipment Received (+)</option>
                  <option value="dispensed">OPD Dispensed (-)</option>
                  <option value="audit">Physical Inventory Audit</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Quantity Units</label>
                <input
                  type="number"
                  min="1"
                  value={stockQty}
                  onChange={(e) => setStockQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Batch Expiration Date</label>
              <input
                type="date"
                value={stockExpiry}
                onChange={(e) => setStockExpiry(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
              />
            </div>

            <Button
              className="w-full h-9 text-xs font-semibold gap-1.5 mt-2"
              onClick={() =>
                handleQueueEntry("stock", {
                  medicineId: stockMed,
                  action: stockAction,
                  qty: stockQty,
                  expiryDate: stockExpiry,
                })
              }
            >
              <Send className="w-3.5 h-3.5" />
              Queue & Log Stock Transaction
            </Button>
          </CardContent>
        </Card>
      )}

      {/* FORM 2: Bed Headroom */}
      {activeTab === "beds" && (
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bed className="w-4 h-4 text-primary" />
              Inpatient Bed Headroom & Oxygen Audit
            </CardTitle>
            <CardDescription className="text-xs">
              Daily capacity and critical care headroom for {phcName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Total Sanctioned Beds</label>
                <input
                  type="number"
                  min="4"
                  value={totalBeds}
                  onChange={(e) => setTotalBeds(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Currently Occupied Beds</label>
                <input
                  type="number"
                  min="0"
                  max={totalBeds}
                  value={occupiedBeds}
                  onChange={(e) => setOccupiedBeds(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Available Oxygen Beds</label>
                <input
                  type="number"
                  min="0"
                  value={oxygenBeds}
                  onChange={(e) => setOxygenBeds(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Critical Care Stabilisation Beds</label>
                <input
                  type="number"
                  min="0"
                  value={criticalBeds}
                  onChange={(e) => setCriticalBeds(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Calculated Occupancy:</span>
              <span className="font-mono font-bold text-foreground">
                {Math.round((occupiedBeds / Math.max(1, totalBeds)) * 100)}% (Headroom: {Math.max(0, totalBeds - occupiedBeds)} beds)
              </span>
            </div>

            <Button
              className="w-full h-9 text-xs font-semibold gap-1.5 mt-2"
              onClick={() =>
                handleQueueEntry("beds", {
                  totalBeds,
                  occupiedBeds,
                  availableOxygenBeds: oxygenBeds,
                  criticalCareBeds: criticalBeds,
                })
              }
            >
              <Send className="w-3.5 h-3.5" />
              Queue & Log Bed Status
            </Button>
          </CardContent>
        </Card>
      )}

      {/* FORM 3: Staff Attendance */}
      {activeTab === "staff" && (
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Clinical Staff Attendance & Duty Roster
            </CardTitle>
            <CardDescription className="text-xs">
              Daily staff duty verification for {phcName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Doctors Present</label>
                <input
                  type="number"
                  min="0"
                  value={doctorsPres}
                  onChange={(e) => setDoctorsPres(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Nurses Present</label>
                <input
                  type="number"
                  min="0"
                  value={nursesPres}
                  onChange={(e) => setNursesPres(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Pharmacists</label>
                <input
                  type="number"
                  min="0"
                  value={pharmPres}
                  onChange={(e) => setPharmPres(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Sanctioned Total Staff</label>
              <input
                type="number"
                min="1"
                value={reqStaff}
                onChange={(e) => setReqStaff(parseInt(e.target.value) || 1)}
                className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Attendance Ratio:</span>
              <span className="font-mono font-bold text-foreground">
                {Math.round(((doctorsPres + nursesPres + pharmPres) / Math.max(1, reqStaff)) * 100)}% ({doctorsPres + nursesPres + pharmPres} / {reqStaff} staff on duty)
              </span>
            </div>

            <Button
              className="w-full h-9 text-xs font-semibold gap-1.5 mt-2"
              onClick={() =>
                handleQueueEntry("staff", {
                  doctorsPresent: doctorsPres,
                  nursesPresent: nursesPres,
                  pharmacistsPresent: pharmPres,
                  requiredStaff: reqStaff,
                })
              }
            >
              <Send className="w-3.5 h-3.5" />
              Queue & Log Attendance Roster
            </Button>
          </CardContent>
        </Card>
      )}

      {/* FORM 4: Patient Footfall */}
      {activeTab === "footfall" && (
        <Card className="border-border/80 shadow-sm bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Outpatient Footfall by Clinical Syndrome
            </CardTitle>
            <CardDescription className="text-xs">
              Feeds real-time CUSUM epidemic anomaly detectors for {phcName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Primary Syndrome Category</label>
              <select
                value={symptomCat}
                onChange={(e) => setSymptomCat(e.target.value)}
                className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground"
              >
                <option value="fever">Acute Febrile Illness / Fever Surge</option>
                <option value="diarrhea">Acute Diarrheal Disease / Gastroenteritis</option>
                <option value="respiratory">Acute Respiratory Infection (ARI)</option>
                <option value="maternal">Maternal & Antenatal Consultations</option>
                <option value="trauma">Trauma & Emergency Care</option>
                <option value="general">General Outpatient Consultations</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Patient Consultation Count (Today)</label>
              <input
                type="number"
                min="1"
                value={opdCount}
                onChange={(e) => setOpdCount(parseInt(e.target.value) || 0)}
                className="w-full bg-background border border-border/80 rounded-md p-2 text-xs text-foreground font-mono"
              />
            </div>

            <Button
              className="w-full h-9 text-xs font-semibold gap-1.5 mt-2"
              onClick={() =>
                handleQueueEntry("footfall", {
                  symptomCategory: symptomCat,
                  opdCount,
                })
              }
            >
              <Send className="w-3.5 h-3.5" />
              Queue & Log Syndromic Footfall
            </Button>
          </CardContent>
        </Card>
      )}

      {/* IndexedDB Offline Queue Ledger */}
      <Card className="border-border/80 shadow-sm bg-card/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              Client IndexedDB Storage Ledger
            </CardTitle>
            <CardDescription className="text-xs">
              Local persistent queue surviving offline sessions and browser reloads.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {pendingQueue.length} Pending Sync
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {allEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Queue is empty. Submit entries above to inspect local IndexedDB storage.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Type</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Payload Preview</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allEntries.map((e) => (
                  <TableRow key={e.id} className="text-xs">
                    <TableCell className="font-semibold uppercase text-primary text-[10px]">
                      {e.type}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {e.phcId.replace("in_kar_", "")}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] max-w-[200px] truncate text-muted-foreground">
                      {JSON.stringify(e.payload)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono ${
                          e.syncStatus === "synced"
                            ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                            : "border-amber-500/30 text-amber-600 bg-amber-500/10"
                        }`}
                      >
                        {e.syncStatus === "synced" ? "SYNCED" : "QUEUED"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
