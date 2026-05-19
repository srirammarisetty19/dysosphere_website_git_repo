// ============================================================================
// BFF Proxy — Chat Stream
// Browser → Next.js → AI Server (SSE passthrough)
// ============================================================================

import { NextRequest } from "next/server";

const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://127.0.0.1:8001";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = req.headers.get("authorization");

  const response = await fetch(`${AI_SERVER_URL}/agents/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify({
      message: body.message,
      session_id: body.session_id,
      agent: body.agent,
      model: body.model,
      images: body.images,
      is_temporary: body.is_temporary,
      description: body.description,
    }),
  });

  if (!response.ok) {
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Passthrough the SSE stream
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
