// ============================================================================
// BFF Proxy — Generic catch-all proxy for AI + NAS server routes
// AI:  /api/auth/*, /api/users/*, /api/agents/*, etc. → :8001
// NAS: /api/nas-auth/*, /api/nas-files/*, etc. → :8000
// ============================================================================

import { NextRequest, NextResponse } from "next/server";

const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://127.0.0.1:8001";
const NAS_SERVER_URL = process.env.NAS_SERVER_URL || "http://127.0.0.1:8000";

// Binary content types that should be streamed as-is (not parsed as JSON)
const BINARY_TYPES = [
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "image/",
  "video/",
  "audio/",
];

// AI route mapping: Next.js API path → AI server path
const AI_ROUTE_MAP: Record<string, string> = {
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

// NAS route mapping: /api/nas-files/list → /api/nas/files/list
const NAS_ROUTE_MAP: Record<string, string> = {
  "nas-auth": "api/nas/auth",
  "nas-files": "api/nas/files",
  "nas-share": "api/nas/share",
  "nas-notifications": "api/nas/notifications",
  "nas-people": "api/nas/people",
  "nas-health": "api/nas/health",
  "nas-thumb": "api/nas/files/thumbnail",
  "nas-face-thumb": "api/nas/people/face-thumbnail",
};

function isBinaryContentType(ct: string): boolean {
  return BINARY_TYPES.some((t) => ct.includes(t));
}

async function proxyRequest(req: NextRequest, params: { proxy: string[] }) {
  const segments = params.proxy;
  const firstSegment = segments[0];
  const restPath = segments.slice(1).join("/");

  // Determine if this is a NAS or AI route
  const isNasRoute = firstSegment.startsWith("nas-");
  const baseUrl = isNasRoute ? NAS_SERVER_URL : AI_SERVER_URL;

  let serverPath: string;
  if (isNasRoute) {
    // NAS routes: map prefix to actual server path
    const nasPrefix = NAS_ROUTE_MAP[firstSegment] || firstSegment;
    serverPath = restPath ? `${nasPrefix}/${restPath}` : nasPrefix;
  } else {
    // AI routes: existing mapping
    const serverPrefix = AI_ROUTE_MAP[firstSegment] || firstSegment;
    serverPath = restPath ? `${serverPrefix}/${restPath}` : serverPrefix;
  }

  // Build target URL with query params
  const url = new URL(`${baseUrl}/${serverPath}`);
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
      // For file uploads, forward the raw body as-is
      // Keep the original Content-Type header (it contains the boundary)
      fetchOptions.body = await req.arrayBuffer();
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

    // Binary response (thumbnails, file downloads, images, etc.)
    if (isBinaryContentType(responseContentType)) {
      const body = response.body;
      const responseHeaders: Record<string, string> = {
        "Content-Type": responseContentType,
      };
      // Forward cache headers (Google Drive pattern)
      const etag = response.headers.get("etag");
      const cacheControl = response.headers.get("cache-control");
      const contentDisposition = response.headers.get("content-disposition");
      if (etag) responseHeaders["ETag"] = etag;
      if (cacheControl) {
        responseHeaders["Cache-Control"] = cacheControl;
      } else {
        responseHeaders["Cache-Control"] = "private, max-age=3600, immutable";
      }
      if (contentDisposition)
        responseHeaders["Content-Disposition"] = contentDisposition;

      return new Response(body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Standard JSON / text response
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": responseContentType || "application/json",
      },
    });
  } catch (error) {
    console.error(`[BFF Proxy] Error forwarding to ${url}:`, error);
    const service = url.toString().includes("/api/nas") ? "NAS" : "AI";
    return NextResponse.json(
      { detail: `${service} server is unreachable` },
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
