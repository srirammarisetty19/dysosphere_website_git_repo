// ============================================================================
// BFF Proxy — Generic catch-all proxy for AI server routes
// Forwards: /api/auth/*, /api/users/*, /api/history/*, /api/agents/*, etc.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://127.0.0.1:8001";

// Route mapping: Next.js API path → AI server path
const ROUTE_MAP: Record<string, string> = {
  auth: "users", // /api/auth/login → /users/login
  users: "users",
  history: "history",
  agents: "agents",
  sessions: "agents/sessions",
  heartbeats: "heartbeats",
  gpu: "gpu",
  health: "health",
  notifications: "notifications",
  upload: "upload",
  speech: "speech",
  integrations: "integrations",
  calendar: "calendar",
  artifacts: "artifacts",
};

async function proxyRequest(req: NextRequest, params: { proxy: string[] }) {
  const segments = params.proxy;
  const firstSegment = segments[0];
  const restPath = segments.slice(1).join("/");

  // Map the route
  const serverPrefix = ROUTE_MAP[firstSegment] || firstSegment;
  const serverPath = restPath ? `${serverPrefix}/${restPath}` : serverPrefix;

  // Build target URL with query params
  const url = new URL(`${AI_SERVER_URL}/${serverPath}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Forward headers
  const headers: Record<string, string> = {};
  const authHeader = req.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;

  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  // Build fetch options
  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

  // Forward body for non-GET requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (contentType?.includes("multipart/form-data")) {
      // For file uploads, pass the raw body
      fetchOptions.body = await req.blob();
      // Let fetch set the content-type with boundary
      delete headers["Content-Type"];
    } else {
      try {
        const body = await req.text();
        if (body) fetchOptions.body = body;
      } catch {
        // No body
      }
    }
  }

  try {
    const response = await fetch(url.toString(), fetchOptions);

    // Check if it's a streaming response
    const responseContentType = response.headers.get("content-type") || "";
    if (responseContentType.includes("text/event-stream")) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Standard JSON response
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": responseContentType || "application/json",
      },
    });
  } catch (error) {
    console.error(`[BFF Proxy] Error forwarding to ${url}:`, error);
    return NextResponse.json(
      { detail: "AI server is unreachable" },
      { status: 502 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(req, await params);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ proxy: string[] }> }
) {
  return proxyRequest(req, await params);
}
