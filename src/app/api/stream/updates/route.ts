import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date().toISOString() })}\n\n`)
      );

      // Periodic heartbeat and telemetry ping
      const interval = setInterval(() => {
        try {
          const telemetryUpdate = {
            type: "HEARTBEAT",
            timestamp: new Date().toISOString(),
            activeNodes: ["node_in_karnataka", "node_br_bahia", "node_za_kzn"],
            syncStatus: "OPTIMAL",
          };
          controller.enqueue(
            encoder.encode(`event: telemetry\ndata: ${JSON.stringify(telemetryUpdate)}\n\n`)
          );
        } catch {
          clearInterval(interval);
        }
      }, 5000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
