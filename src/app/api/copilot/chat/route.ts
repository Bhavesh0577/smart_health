import { NextRequest, NextResponse } from "next/server";
import { runGeminiAgent } from "@/lib/services/gemini-service";
import { z } from "zod";

const chatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(["user", "model"]),
    content: z.string(),
  })).optional().default([]),
  node: z.string().optional().default("node_in_karnataka"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history, node } = chatSchema.parse(body);

    const result = await runGeminiAgent(message, history, node);

    return NextResponse.json({
      success: true,
      text: result.text,
      toolCallsExecuted: result.toolCallsExecuted,
    });
  } catch (error) {
    console.error("Copilot chat error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
