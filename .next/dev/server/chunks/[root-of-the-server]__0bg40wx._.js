module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/app/api/[...proxy]/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "PATCH",
    ()=>PATCH,
    "POST",
    ()=>POST,
    "PUT",
    ()=>PUT
]);
// ============================================================================
// BFF Proxy — Generic catch-all proxy for AI + NAS server routes
// AI:  /api/auth/*, /api/users/*, /api/agents/*, etc. → :8001
// NAS: /api/nas-auth/*, /api/nas-files/*, etc. → :8000
// ============================================================================
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://127.0.0.1:8001";
const NAS_SERVER_URL = process.env.NAS_SERVER_URL || "http://127.0.0.1:8000";
// Binary content types that should be streamed as-is (not parsed as JSON)
const BINARY_TYPES = [
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "image/",
    "video/",
    "audio/"
];
// AI route mapping: Next.js API path → AI server path
const AI_ROUTE_MAP = {
    auth: "users",
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
    artifacts: "artifacts"
};
// NAS route mapping: /api/nas-files/list → /api/nas/files/list
const NAS_ROUTE_MAP = {
    "nas-auth": "api/nas/auth",
    "nas-files": "api/nas/files",
    "nas-share": "api/nas/share",
    "nas-notifications": "api/nas/notifications",
    "nas-people": "api/nas/people",
    "nas-health": "api/nas/health",
    "nas-thumb": "api/nas/files/thumbnail",
    "nas-face-thumb": "api/nas/people/face-thumbnail"
};
function isBinaryContentType(ct) {
    return BINARY_TYPES.some((t)=>ct.includes(t));
}
async function proxyRequest(req, params) {
    const segments = params.proxy;
    const firstSegment = segments[0];
    const restPath = segments.slice(1).join("/");
    // Determine if this is a NAS or AI route
    const isNasRoute = firstSegment.startsWith("nas-");
    const baseUrl = isNasRoute ? NAS_SERVER_URL : AI_SERVER_URL;
    let serverPath;
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
    req.nextUrl.searchParams.forEach((value, key)=>{
        url.searchParams.set(key, value);
    });
    // Forward headers
    const headers = {};
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers["Authorization"] = authHeader;
    const contentType = req.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;
    // Build fetch options
    const fetchOptions = {
        method: req.method,
        headers
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
            } catch  {
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
                    Connection: "keep-alive"
                }
            });
        }
        // Binary response (thumbnails, file downloads, images, etc.)
        if (isBinaryContentType(responseContentType)) {
            const body = response.body;
            const responseHeaders = {
                "Content-Type": responseContentType
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
            if (contentDisposition) responseHeaders["Content-Disposition"] = contentDisposition;
            return new Response(body, {
                status: response.status,
                headers: responseHeaders
            });
        }
        // Standard JSON / text response
        const data = await response.text();
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"](data, {
            status: response.status,
            headers: {
                "Content-Type": responseContentType || "application/json"
            }
        });
    } catch (error) {
        console.error(`[BFF Proxy] Error forwarding to ${url}:`, error);
        const service = url.toString().includes("/api/nas") ? "NAS" : "AI";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            detail: `${service} server is unreachable`
        }, {
            status: 502
        });
    }
}
async function GET(req, { params }) {
    return proxyRequest(req, await params);
}
async function POST(req, { params }) {
    return proxyRequest(req, await params);
}
async function PUT(req, { params }) {
    return proxyRequest(req, await params);
}
async function PATCH(req, { params }) {
    return proxyRequest(req, await params);
}
async function DELETE(req, { params }) {
    return proxyRequest(req, await params);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0bg40wx._.js.map