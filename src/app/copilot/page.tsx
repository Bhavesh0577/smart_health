"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/context/app-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bot,
  Send,
  Sparkles,
  Camera,
  Mic,
  MicOff,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Upload,
  Cpu,
  ShieldCheck,
  Languages,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  toolCalls?: Array<{ toolName: string; args: any; result: any }>;
  time: string;
}

export default function CopilotPage() {
  const { selectedNode, selectedDistrict } = useApp();

  // Active Tab
  const [activeTab, setActiveTab] = useState<"chat" | "vision" | "voice" | "briefing">("chat");

  // 1. Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      role: "model",
      content: `### 🤖 Welcome to PHC Resilience Copilot
I am your server-side AI operational commander, powered by Gemini with native function calling.

**Available Sovereign Capabilities:**
- 📈 **Demand Forecasting:** Predict 14-day medicine consumption per PHC.
- 🚨 **Surveillance Anomaly Alerts:** Track fever clusters & critical stockouts.
- 📦 **Smart Redistribution:** Inspect OR-Tools cross-district transfer plans.
- 🏥 **PHC Status Dossiers:** Query bed occupancy, doctors on duty & cover days.
- 🛡️ **Multi-Pillar Resilience:** Compute 0-100 composite resilience scores.

*How can I assist your district health operations today?*`,
      time: "Just now",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 2. Vision State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionItems, setVisionItems] = useState<any[]>([]);
  const [visionSummary, setVisionSummary] = useState<string | null>(null);
  const [visionCommitted, setVisionCommitted] = useState(false);

  // 3. Voice State
  const [voiceLang, setVoiceLang] = useState<"en" | "hi" | "kn">("en");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [parsedUpdates, setParsedUpdates] = useState<any[]>([]);
  const [voiceCommitted, setVoiceCommitted] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 4. Briefing State
  const [briefingDistrict, setBriefingDistrict] = useState(
    selectedDistrict && selectedDistrict !== "All Districts" ? selectedDistrict : "Kalaburagi"
  );
  const [briefingData, setBriefingData] = useState<any>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load briefing on mount
  useEffect(() => {
    fetchBriefing(briefingDistrict);
  }, [selectedNode, briefingDistrict]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          node: selectedNode,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        const modelMsg: ChatMessage = {
          id: `mod_${Date.now()}`,
          role: "model",
          content: data.text,
          toolCalls: data.toolCallsExecuted,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, modelMsg]);
      } else {
        toast.error("Copilot request failed", { description: data.error });
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error("Could not reach Copilot agent");
    } finally {
      setChatLoading(false);
    }
  };

  // Image Upload handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setVisionItems([]);
        setVisionSummary(null);
        setVisionCommitted(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedImage) return;
    setVisionLoading(true);
    try {
      const res = await fetch("/api/copilot/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: selectedImage,
          node: selectedNode,
          phcId: "in_kar_kalaburagi_aland",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVisionItems(data.items || []);
        setVisionSummary(data.rawSummary);
        toast.success("Multimodal Analysis Complete", {
          description: `Identified ${data.items?.length || 0} pharmaceutical batches from shelf image.`,
        });
      } else {
        toast.error("Vision parsing error", { description: data.error });
      }
    } catch (e) {
      console.error("Vision error:", e);
      toast.error("Failed to connect to vision engine");
    } finally {
      setVisionLoading(false);
    }
  };

  const handleConfirmVisionSave = async () => {
    if (visionItems.length === 0) return;
    setVisionLoading(true);
    try {
      const res = await fetch("/api/copilot/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: selectedImage,
          node: selectedNode,
          phcId: "in_kar_kalaburagi_aland",
          confirmSave: true,
          itemsToSave: visionItems.map((i) => ({
            medicineCode: i.medicineCode || "MED_PARA",
            quantity: Number(i.quantity) || 100,
            expiryDate: i.expiryDate || "2027-12-31",
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVisionCommitted(true);
        toast.success("Stock Inventory Committed", {
          description: `Successfully logged ${data.savedItemsCount} audited batches to the sovereign ledger.`,
        });
      }
    } finally {
      setVisionLoading(false);
    }
  };

  // Web Speech API Voice Recognition
  const toggleSpeechRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Web Speech API not supported in this browser", {
        description: "Please use Chrome, Edge, or enter text transcript manually.",
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;

      const langMap: Record<string, string> = {
        en: "en-IN",
        hi: "hi-IN",
        kn: "kn-IN",
      };
      recognition.lang = langMap[voiceLang] || "en-IN";

      recognition.onstart = () => {
        setIsRecording(true);
        setVoiceTranscript("");
        setParsedUpdates([]);
        setVoiceCommitted(false);
      };

      recognition.onresult = (event: any) => {
        let current = "";
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setVoiceTranscript(current);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
        toast.error("Speech recognition error", { description: event.error });
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsRecording(false);
    }
  };

  const handleParseVoiceTranscript = async () => {
    if (!voiceTranscript.trim()) return;
    setVoiceLoading(true);
    try {
      const res = await fetch("/api/copilot/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: voiceTranscript,
          language: voiceLang,
          node: selectedNode,
          phcId: "in_kar_kalaburagi_aland",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setParsedUpdates(data.updates || []);
        toast.success("Voice Transcription Parsed", {
          description: `Extracted ${data.updates?.length || 0} structured medicine updates.`,
        });
      } else {
        toast.error("Voice parsing failed", { description: data.error });
      }
    } catch (e) {
      console.error("Voice parse error:", e);
      toast.error("Could not parse voice recording");
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleConfirmVoiceSave = async () => {
    if (parsedUpdates.length === 0) return;
    setVoiceLoading(true);
    try {
      const res = await fetch("/api/copilot/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: voiceTranscript,
          language: voiceLang,
          node: selectedNode,
          phcId: "in_kar_kalaburagi_aland",
          confirmSave: true,
          updatesToSave: parsedUpdates,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVoiceCommitted(true);
        toast.success("Voice Updates Applied", {
          description: `Applied ${data.savedUpdatesCount} inventory transactions to facility stock.`,
        });
      }
    } finally {
      setVoiceLoading(false);
    }
  };

  // Briefing Fetch & Generate
  const fetchBriefing = async (district: string) => {
    setBriefingLoading(true);
    try {
      const res = await fetch(`/api/copilot/briefing?district=${encodeURIComponent(district)}&node=${selectedNode}`);
      const data = await res.json();
      if (data.success) {
        setBriefingData(data.briefing);
      }
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleGenerateBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch("/api/copilot/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district: briefingDistrict,
          node: selectedNode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBriefingData(data.briefing);
        toast.success("Daily Briefing Generated", {
          description: `Stored official situation briefing for ${briefingDistrict}.`,
        });
      }
    } finally {
      setBriefingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              Gemini 2.5 Agentic Copilot
            </Badge>
            <Badge variant="secondary" className="text-xs font-mono">
              Native Function Calling
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            PHC Operational Intelligence Copilot
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Autonomous server-side assistant executing database tools, multimodal shelf vision counting, and multilingual voice reporting.
          </p>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border/80 rounded-lg shrink-0">
          <Button
            size="sm"
            variant={activeTab === "chat" ? "default" : "ghost"}
            onClick={() => setActiveTab("chat")}
            className="h-8 text-xs gap-1.5"
          >
            <Bot className="w-3.5 h-3.5" />
            Agent Chat
          </Button>
          <Button
            size="sm"
            variant={activeTab === "vision" ? "default" : "ghost"}
            onClick={() => setActiveTab("vision")}
            className="h-8 text-xs gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            Photo Counting
          </Button>
          <Button
            size="sm"
            variant={activeTab === "voice" ? "default" : "ghost"}
            onClick={() => setActiveTab("voice")}
            className="h-8 text-xs gap-1.5"
          >
            <Mic className="w-3.5 h-3.5" />
            Voice Reporting
          </Button>
          <Button
            size="sm"
            variant={activeTab === "briefing" ? "default" : "ghost"}
            onClick={() => setActiveTab("briefing")}
            className="h-8 text-xs gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Daily Briefing
          </Button>
        </div>
      </div>

      {/* TAB 1: Conversational Agent Chat */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Interface */}
          <Card className="lg:col-span-3 border-border/80 shadow-sm bg-card/60 backdrop-blur-sm flex flex-col h-[650px]">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  District Command Agent Loop
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Tools Online: 5
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {m.role === "user" ? "District Health Officer" : "Gemini Resilience Agent"}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">• {m.time}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-muted/40 border border-border/70 text-foreground"
                    }`}
                  >
                    {/* Tool execution badge */}
                    {m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="mb-2.5 pb-2 border-b border-border/40 space-y-1">
                        <div className="text-[10px] font-mono text-primary font-semibold flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          Native Function Calls Executed ({m.toolCalls.length})
                        </div>
                        {m.toolCalls.map((tc, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-background/50 border border-border/40 font-mono text-[10px] text-muted-foreground"
                          >
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {tc.toolName}
                            </span>
                            ({JSON.stringify(tc.args)})
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground bg-muted/20 border border-border/50 rounded-lg max-w-[50%]">
                  <RotateCcw className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Gemini is evaluating tools & formulating response...</span>
                </div>
              )}
              <div ref={chatScrollRef} />
            </CardContent>

            {/* Input Box */}
            <div className="p-3 border-t border-border/60 bg-muted/10">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask about stockouts, alerts, redistribution plans, or facility resilience..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 bg-background border border-border/80 rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={chatLoading}
                />
                <Button type="submit" size="sm" disabled={chatLoading || !inputMessage.trim()} className="h-8 px-3 text-xs gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Send
                </Button>
              </form>
            </div>
          </Card>

          {/* Quick Prompts & Context Sidebar */}
          <div className="space-y-4">
            <Card className="border-border/80 shadow-sm bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Quick Tactical Queries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 p-3 pt-0">
                {[
                  "What are the critical alerts in Kalaburagi?",
                  "Show pending OR-Tools redistribution plans",
                  "What is the Paracetamol forecast for PHC Aland?",
                  "Calculate resilience score for PHC Ullal",
                  "Review Dakshina Kannada monsoon supply cover",
                ].map((promptText, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendMessage(promptText)}
                    disabled={chatLoading}
                    className="w-full justify-start text-left h-auto py-1.5 px-2 text-[11px] leading-tight font-normal text-muted-foreground hover:text-foreground"
                  >
                    <Sparkles className="w-3 h-3 text-primary mr-1.5 shrink-0" />
                    <span>{promptText}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-sm bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Registered Native Tools</span>
                  <Badge variant="secondary" className="text-[9px]">v2.24</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] p-3 pt-0 text-muted-foreground">
                <div className="p-1.5 rounded bg-muted/20 border border-border/50">
                  <span className="font-mono font-semibold text-primary">get_forecast</span>
                  <p className="text-[10px] mt-0.5">14-day Ridge regression demand forecast & stockout probability.</p>
                </div>
                <div className="p-1.5 rounded bg-muted/20 border border-border/50">
                  <span className="font-mono font-semibold text-primary">get_alerts</span>
                  <p className="text-[10px] mt-0.5">Epidemic CUSUM anomalies & critical medicine depletions.</p>
                </div>
                <div className="p-1.5 rounded bg-muted/20 border border-border/50">
                  <span className="font-mono font-semibold text-primary">get_redistribution_plan</span>
                  <p className="text-[10px] mt-0.5">OR-Tools Min-Cost Flow moves with road detour ETA.</p>
                </div>
                <div className="p-1.5 rounded bg-muted/20 border border-border/50">
                  <span className="font-mono font-semibold text-primary">get_phc_status</span>
                  <p className="text-[10px] mt-0.5">Bed occupancy, oxygen headroom & staff attendance.</p>
                </div>
                <div className="p-1.5 rounded bg-muted/20 border border-border/50">
                  <span className="font-mono font-semibold text-primary">get_resilience_score</span>
                  <p className="text-[10px] mt-0.5">0-100 composite index weighted across 4 core pillars.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Multimodal Shelf Photo Counting */}
      {activeTab === "vision" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload & Photo Preview */}
          <Card className="border-border/80 shadow-sm bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  Shelf Photo Inspector (Gemini Multimodal)
                </span>
                <Badge variant="outline" className="text-[10px]">Zero Manual Tallying</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Upload or capture a photo of pharmaceutical storage shelves or blister packs to automate stock counts and expiry logging.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center hover:bg-muted/10 transition-colors">
                {selectedImage ? (
                  <div className="space-y-3">
                    <img
                      src={selectedImage}
                      alt="Uploaded Shelf"
                      className="max-h-64 mx-auto rounded-lg shadow-sm border border-border object-contain"
                    />
                    <div className="flex items-center justify-center gap-2">
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                          <span>Change Photo</span>
                        </Button>
                      </label>
                      <Button
                        size="sm"
                        onClick={handleAnalyzePhoto}
                        disabled={visionLoading}
                        className="h-8 text-xs font-semibold gap-1.5"
                      >
                        {visionLoading ? (
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>Run AI Multimodal Count</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="photo-upload" className="cursor-pointer block py-6">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                    <span className="text-xs font-semibold text-foreground block">
                      Click to upload shelf photo or medicine batch
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-1 block">
                      Supports JPG, PNG, WEBP • Max 10MB
                    </span>
                  </label>
                )}
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {visionSummary && (
                <div className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    Computer Vision Analysis:
                  </div>
                  {visionSummary}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parsed Structured Table & Confirmation */}
          <Card className="border-border/80 shadow-sm bg-card/60 flex flex-col justify-between">
            <div>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Detected Medicine Inventory</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {visionItems.length} Detected Batches
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Review extracted package counts and expiry dates before committing directly into the PHC stock ledger.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {visionItems.length === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    Upload an image and run analysis to populate structured counts.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Medicine</TableHead>
                        <TableHead className="text-center">Count</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead className="text-center">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visionItems.map((item, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-semibold text-foreground">
                            {item.item}
                            <span className="block text-[10px] text-muted-foreground font-mono">
                              {item.medicineCode} • {item.unit}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-foreground">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.expiryDate}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                              {Math.round((item.confidence || 0.9) * 100)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </div>

            {visionItems.length > 0 && (
              <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Target Facility: <strong className="text-foreground">PHC Aland (Kalaburagi)</strong>
                </span>
                <Button
                  size="sm"
                  onClick={handleConfirmVisionSave}
                  disabled={visionLoading || visionCommitted}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  {visionCommitted ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Committed to Ledger
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Confirm & Commit to Ledger
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: Voice Reporting (Web Speech API) */}
      {activeTab === "voice" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Voice Input & Recording */}
          <Card className="border-border/80 shadow-sm bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" />
                  Multilingual Voice Reporting (Speech-to-Text)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={voiceLang === "en" ? "default" : "outline"}
                    onClick={() => setVoiceLang("en")}
                    className="h-6 text-[10px] px-2"
                  >
                    English
                  </Button>
                  <Button
                    size="sm"
                    variant={voiceLang === "hi" ? "default" : "outline"}
                    onClick={() => setVoiceLang("hi")}
                    className="h-6 text-[10px] px-2"
                  >
                    हिन्दी
                  </Button>
                  <Button
                    size="sm"
                    variant={voiceLang === "kn" ? "default" : "outline"}
                    onClick={() => setVoiceLang("kn")}
                    className="h-6 text-[10px] px-2"
                  >
                    ಕನ್ನಡ
                  </Button>
                </div>
              </CardTitle>
              <CardDescription className="text-xs">
                Speak clinical dispensing or shipment receipts in English, Hindi, or Kannada. Gemini will parse speech into structured inventory updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-6">
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  onClick={toggleSpeechRecording}
                  className={`w-20 h-20 rounded-full transition-all duration-300 shadow-lg ${
                    isRecording ? "animate-pulse shadow-destructive/40" : "shadow-primary/20"
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="w-8 h-8 animate-bounce" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </Button>
                <div className="mt-3">
                  <span className="text-xs font-semibold block text-foreground">
                    {isRecording ? "Listening... Speak your stock report" : "Click microphone to start recording"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Selected dialect: {voiceLang === "en" ? "English (India)" : voiceLang === "hi" ? "Hindi (हिन्दी)" : "Kannada (ಕನ್ನಡ)"}
                  </span>
                </div>
              </div>

              {/* Spoken Transcript Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Recognized Spoken Transcript:</span>
                  {voiceTranscript && (
                    <span className="text-[10px] font-normal text-emerald-600">Speech Detected</span>
                  )}
                </label>
                <textarea
                  value={voiceTranscript}
                  onChange={(e) => setVoiceTranscript(e.target.value)}
                  placeholder={
                    voiceLang === "en"
                      ? 'e.g. "We received 400 boxes of Paracetamol expiring in December 2027 and dispensed 50 units of Amoxicillin today."'
                      : voiceLang === "hi"
                      ? 'जैसे: "हमारे पास 400 पत्ते पैरासिटामोल आए हैं और एक्सपायरी दिसंबर 2027 है"'
                      : 'ಉದಾಹರಣೆಗೆ: "ನಮಗೆ 400 ಪ್ಯಾರಾಸಿಟಮಾಲ್ ಪ್ಯಾಕೆಟ್‌ಗಳು ಬಂದಿವೆ ಮತ್ತು 50 ಒಆರ್‌ಎಸ್ ವಿತರಿಸಲಾಗಿದೆ"'
                  }
                  rows={3}
                  className="w-full bg-background border border-border/80 rounded-md p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVoiceTranscript(
                      voiceLang === "kn"
                        ? "ನಮ್ಮ ಪಿಎಚ್‌ಸಿಗೆ 400 ಪ್ಯಾರಾಸಿಟಮಾಲ್ ಮಾತ್ರೆಗಳು ಬಂದಿವೆ ಮತ್ತು 50 ಅಮಾಕ್ಸಿಲಿನ್ ವಿತರಿಸಲಾಗಿದೆ."
                        : voiceLang === "hi"
                        ? "हमारे केंद्र पर 400 पत्ते पैरासिटामोल प्राप्त हुए हैं और 50 पत्ते एमोक्सिसिलिन वितरित किए गए हैं।"
                        : "We received 400 tablets of Paracetamol 500mg expiring in Dec 2027 and dispensed 50 units of Amoxicillin."
                    );
                  }}
                  className="h-8 text-[11px]"
                >
                  Insert Sample Speech
                </Button>

                <Button
                  size="sm"
                  onClick={handleParseVoiceTranscript}
                  disabled={voiceLoading || !voiceTranscript.trim()}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  {voiceLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Parse into Structured Update
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parsed Updates & Commit */}
          <Card className="border-border/80 shadow-sm bg-card/60 flex flex-col justify-between">
            <div>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Structured Inventory Transactions</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {parsedUpdates.length} Transactions
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the structured output parsed by Gemini from spoken language before executing changes to stock.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {parsedUpdates.length === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground">
                    <Mic className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                    Speak a stock report and parse it to generate inventory transactions.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Medicine</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                        <TableHead className="text-center">Delta</TableHead>
                        <TableHead>Expiry Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedUpdates.map((upd, idx) => (
                        <TableRow key={idx} className="text-xs">
                          <TableCell className="font-semibold text-foreground">
                            {upd.medicineName}
                            <span className="block text-[10px] text-muted-foreground font-mono">
                              {upd.medicineCode}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                upd.action === "restock"
                                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                  : "border-blue-500/30 text-blue-600 bg-blue-500/10"
                              }`}
                            >
                              {upd.action.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-foreground">
                            {upd.quantityChange > 0 ? `+${upd.quantityChange}` : upd.quantityChange}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {upd.expiryDate || "2027-12-31"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </div>

            {parsedUpdates.length > 0 && (
              <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Target Facility: <strong className="text-foreground">PHC Aland (Kalaburagi)</strong>
                </span>
                <Button
                  size="sm"
                  onClick={handleConfirmVoiceSave}
                  disabled={voiceLoading || voiceCommitted}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  {voiceCommitted ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Applied to Stock
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Confirm & Apply Updates
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: Executive Daily Briefing */}
      {activeTab === "briefing" && (
        <div className="space-y-4">
          <Card className="border-border/80 shadow-sm bg-card/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Executive District Situation Briefing
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated intelligence briefing synthesized from live anomaly detectors, stockout forecasts, and OR-Tools routes.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={briefingDistrict}
                  onChange={(e) => setBriefingDistrict(e.target.value)}
                  className="bg-background border border-border/80 rounded-md px-2.5 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value="Kalaburagi">Kalaburagi</option>
                  <option value="Dakshina Kannada">Dakshina Kannada</option>
                  <option value="Bengaluru Urban">Bengaluru Urban</option>
                  <option value="Belagavi">Belagavi</option>
                  <option value="Mysuru">Mysuru</option>
                </select>

                <Button
                  size="sm"
                  onClick={handleGenerateBriefing}
                  disabled={briefingLoading}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  {briefingLoading ? (
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Generate / Refresh Briefing
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {briefingData ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/20 border border-border/60 text-xs leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                    {briefingData.contentMarkdown}
                  </div>

                  {briefingData.keyActionsJson && Array.isArray(briefingData.keyActionsJson) && (
                    <div className="p-3.5 rounded-lg border border-border/80 bg-card/80 space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        Executive Directives Checklist:
                      </div>
                      <div className="space-y-1.5">
                        {briefingData.keyActionsJson.map((act: string, idx: number) => (
                          <label
                            key={idx}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <input type="checkbox" defaultChecked className="accent-primary rounded" />
                            <span>{act}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No briefing loaded. Click &quot;Generate / Refresh Briefing&quot; above.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
