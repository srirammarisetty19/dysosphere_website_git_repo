(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/api-client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ============================================================================
// Sphere AI — API Client
// TypeScript port of api_service.dart
//
// Architecture (Cloudflare Tunnel — single-origin):
//   The web app and API are both served from dysosphere.ai via Nginx.
//   Nginx routes /api/ai/* to the AI FastAPI backend and everything else
//   to the Next.js website. Since both are on the same origin, there are
//   no cross-origin issues.
//
//   Flow:
//     1. Gateway authenticates → stores serverUrl + token in localStorage
//     2. This client calls /api/ai/<path> (same-origin, no CORS needed)
//     3. Nginx strips /api/ai/ → forwards to AI FastAPI on :8001
//
//   For development or multi-server setups, the serverUrl can be set to
//   a different SphereX appliance URL (cross-origin, CORS enabled on Nginx).
// ============================================================================
__turbopack_context__.s([
    "ApiClientError",
    ()=>ApiClientError,
    "apiClient",
    ()=>apiClient,
    "default",
    ()=>__TURBOPACK__default__export__
]);
class ApiClientError extends Error {
    status;
    constructor(message, status){
        super(message);
        this.name = "ApiClientError";
        this.status = status;
    }
}
// ── Route Mapping ──────────────────────────────────────────────────────
// Maps logical API namespaces to actual AI server path prefixes.
// Nginx strips /api/ai/ and forwards to the AI backend.
// Example: /api/auth/login → resolveUrl → {server}/api/ai/users/login
const ROUTE_MAP = {
    auth: "users",
    users: "users",
    history: "history",
    agents: "agents",
    sessions: "agents/sessions",
    heartbeats: "heartbeats",
    schedules: "schedules",
    gpu: "gpu",
    health: "health",
    notifications: "notifications",
    upload: "upload",
    speech: "speech",
    integrations: "integrations",
    calendar: "calendar",
    artifacts: "artifacts",
    tools: "tools",
    files: "files",
    images: "images",
    webhooks: "webhooks",
    scheduler: "scheduler"
};
class ApiClient {
    token = null;
    serverUrl = null;
    refreshToken_ = null;
    // ── Force Logout Callback ────────────────────────────────────────────
    // Registered by the auth store. Invoked when auth is irrecoverably dead
    // (401 after refresh failure). Clears Zustand state and redirects.
    forceLogoutCallback = null;
    // ── Cross-Tab Token Sync (Google BroadcastChannel pattern) ───────────
    // When one tab refreshes the token, all other tabs receive the new
    // access + refresh tokens via BroadcastChannel. This prevents the
    // "refresh token rotation race" where Tab B uses a revoked refresh
    // token because Tab A already rotated it.
    tokenChannel = null;
    // ── Proactive Token Refresh (Google-style) ───────────────────────────
    // Uses a 60-second interval instead of a single long setTimeout.
    // Browsers throttle/suspend timers in background tabs, making long
    // setTimeout unreliable (it may fire hours late). A short interval
    // that checks "is token expiring soon?" is immune to this.
    refreshTimer = null;
    visibilityHandler = null;
    // Guard to prevent concurrent refresh attempts across handlers
    isRefreshing = false;
    // ── Server URL Management ───────────────────────────────────────────
    /**
   * Set the target SphereX server URL.
   * Called by the auth store on hydration, login, and account switching.
   */ setServerUrl(url) {
        this.serverUrl = url ? url.replace(/\/+$/, "") : null;
    }
    /**
   * Get the current server URL. Falls back to localStorage.
   */ getServerUrl() {
        if (this.serverUrl) return this.serverUrl;
        if ("TURBOPACK compile-time truthy", 1) {
            const stored = localStorage.getItem("spherex_server");
            if (stored) {
                this.serverUrl = stored.replace(/\/+$/, "");
                return this.serverUrl;
            }
        }
        return null;
    }
    // ── Token Management ────────────────────────────────────────────────
    setToken(token) {
        this.token = token;
        if (token) {
            if ("TURBOPACK compile-time truthy", 1) {
                localStorage.setItem("sphere_token", token);
            }
        } else {
            if ("TURBOPACK compile-time truthy", 1) {
                localStorage.removeItem("sphere_token");
            }
        }
    }
    getToken() {
        if (this.token) return this.token;
        if ("TURBOPACK compile-time truthy", 1) {
            return localStorage.getItem("sphere_token");
        }
        //TURBOPACK unreachable
        ;
    }
    // ── Refresh Token Management ────────────────────────────────────────
    setRefreshToken(token) {
        this.refreshToken_ = token;
        if ("TURBOPACK compile-time truthy", 1) {
            if (token) {
                localStorage.setItem("sphere_refresh_token", token);
            } else {
                localStorage.removeItem("sphere_refresh_token");
            }
        }
    }
    getRefreshToken() {
        if (this.refreshToken_) return this.refreshToken_;
        if ("TURBOPACK compile-time truthy", 1) {
            return localStorage.getItem("sphere_refresh_token");
        }
        //TURBOPACK unreachable
        ;
    }
    // ── Force Logout Registration ────────────────────────────────────────
    // Called by the auth store during hydration to wire up the
    // "unrecoverable 401 → clear state → redirect" circuit.
    registerForceLogout(callback) {
        this.forceLogoutCallback = callback;
    }
    // ── BroadcastChannel: Cross-Tab Token Sync (Google pattern) ──────────
    // Google Workspace apps use BroadcastChannel to synchronize auth state
    // across all open tabs. When one tab refreshes tokens, it broadcasts
    // the new pair so other tabs don't race with the (now-revoked) old
    // refresh token.
    initTokenBroadcast() {
        if (("TURBOPACK compile-time value", "object") === "undefined" || typeof BroadcastChannel === "undefined") return;
        if (this.tokenChannel) return; // Already initialized
        this.tokenChannel = new BroadcastChannel("sphere-auth-sync");
        this.tokenChannel.onmessage = (event)=>{
            const { type, accessToken, refreshToken: rt } = event.data || {};
            if (type === "token-refresh" && accessToken) {
                // Another tab refreshed — adopt the new tokens silently
                this.token = accessToken;
                if ("TURBOPACK compile-time truthy", 1) {
                    localStorage.setItem("sphere_token", accessToken);
                }
                if (rt) {
                    this.refreshToken_ = rt;
                    if ("TURBOPACK compile-time truthy", 1) {
                        localStorage.setItem("sphere_refresh_token", rt);
                    }
                }
                // Reschedule our own refresh timer with the new token's expiry
                this.scheduleTokenRefresh();
                // Reconnect WS with fresh token
                this.reconnectNotificationWebSocketAfterRefresh();
            } else if (type === "force-logout") {
                // Another tab triggered force logout — follow suit
                this.forceLogoutCallback?.();
            }
        };
    }
    broadcastTokenRefresh(accessToken, refreshToken) {
        try {
            this.tokenChannel?.postMessage({
                type: "token-refresh",
                accessToken,
                refreshToken
            });
        } catch  {
        // BroadcastChannel closed or unavailable — non-critical
        }
    }
    broadcastForceLogout() {
        try {
            this.tokenChannel?.postMessage({
                type: "force-logout"
            });
        } catch  {
        // Non-critical
        }
    }
    // ── JWT Expiry Helpers ───────────────────────────────────────────────
    /**
   * Decode the `exp` claim from a JWT without verifying the signature.
   * Returns the expiry as a Unix timestamp (seconds), or null if unparseable.
   */ parseTokenExpiry(token) {
        try {
            const parts = token.split(".");
            if (parts.length !== 3) return null;
            // base64url → base64 → JSON
            const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const json = JSON.parse(atob(payload));
            return typeof json.exp === "number" ? json.exp : null;
        } catch  {
            return null;
        }
    }
    /**
   * Returns true if the current token is expired (or expires within the
   * next `bufferSec` seconds). Used for pre-flight checks before SSE streams.
   */ isTokenExpiredOrExpiringSoon(bufferSec = 30) {
        const token = this.getToken();
        if (!token) return true;
        const exp = this.parseTokenExpiry(token);
        if (!exp) return false; // Can't parse — assume valid
        const nowSec = Math.floor(Date.now() / 1000);
        return exp - nowSec <= bufferSec;
    }
    // ── Proactive Refresh Timer (Google / Slack pattern) ─────────────────
    /**
   * Start a 60-second interval that checks whether the access token is
   * approaching expiry. If it will expire within 120 seconds, silently
   * refresh. Also registers a `visibilitychange` listener for tab-wake
   * session recovery (Google Drive / Gmail pattern).
   *
   * Why setInterval instead of setTimeout?
   *   Browsers aggressively throttle setTimeout in background tabs
   *   (Chrome: once per minute, Safari: can suspend entirely). A long
   *   setTimeout (e.g. 23h59m) will fire much later than expected —
   *   or not at all before the token expires. A short interval that
   *   checks expiry is immune to this: even if throttled, it fires at
   *   most 60s late.
   *
   * Call this after login and after hydration from localStorage.
   */ scheduleTokenRefresh() {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        // Cancel any existing timer
        this.cancelTokenRefreshTimer();
        const token = this.getToken();
        if (!token) return;
        // ── Interval: check every 60s if token needs refresh ────────────────
        this.refreshTimer = setInterval(async ()=>{
            if (this.isRefreshing) return;
            if (this.isTokenExpiredOrExpiringSoon(120)) {
                await this.tryRefreshToken();
            }
        }, 60_000);
        // ── visibilitychange: session recovery on tab wake ──────────────────
        // Google Drive/Gmail pattern: when the user returns to the tab after
        // hours of inactivity, immediately validate the session. Don't just
        // check the JWT math — the refresh token may also be revoked.
        if (!this.visibilityHandler) {
            this.visibilityHandler = async ()=>{
                if (document.visibilityState !== "visible") return;
                if (this.isRefreshing) return;
                if (this.isTokenExpiredOrExpiringSoon(0)) {
                    // Access token already expired — must refresh
                    const refreshed = await this.tryRefreshToken();
                    if (!refreshed) {
                        // Both tokens dead — force logout (Google pattern)
                        this.broadcastForceLogout();
                        this.forceLogoutCallback?.();
                    }
                } else if (this.isTokenExpiredOrExpiringSoon(120)) {
                    // Expiring soon — proactively refresh
                    await this.tryRefreshToken();
                }
            };
            document.addEventListener("visibilitychange", this.visibilityHandler);
        }
    }
    /**
   * Cancel the background refresh timer and remove the visibilitychange
   * listener. Call on logout / clearAuth.
   */ cancelTokenRefreshTimer() {
        if (this.refreshTimer !== null) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.visibilityHandler && ("TURBOPACK compile-time value", "object") !== "undefined") {
            document.removeEventListener("visibilitychange", this.visibilityHandler);
            this.visibilityHandler = null;
        }
    }
    // ── URL Resolution ──────────────────────────────────────────────────
    //
    // Converts logical API paths to actual server URLs.
    //
    // With server URL (production — direct cross-origin call):
    //   /api/auth/login    → https://server/api/ai/users/login
    //   /api/chat/stream   → https://server/api/ai/chat/stream
    //   /api/sessions      → https://server/api/ai/agents/sessions
    //
    // Without server URL (local dev fallback — BFF proxy):
    //   /api/auth/login    → /api/auth/login (relative, same-origin)
    resolveUrl(path) {
        const server = this.getServerUrl();
        if (!server) {
            // No server configured — use relative paths (BFF proxy fallback for dev)
            return path;
        }
        // Direct mode: strip /api/ prefix, apply route mapping, prefix with /api/ai/
        const stripped = path.replace(/^\/api\//, "");
        const segments = stripped.split("/");
        const namespace = segments[0];
        const rest = segments.slice(1).join("/");
        const mapped = ROUTE_MAP[namespace] || namespace;
        const serverPath = rest ? `${mapped}/${rest}` : mapped;
        return `${server}/api/ai/${serverPath}`;
    }
    /**
   * Resolve a relative file path (e.g. /files/user123/image.jpg) to a
   * fully-qualified URL that can be used in <img> tags.
   * Used by the chat UI to display uploaded images on conversation restore.
   */ resolveFileUrl(path) {
        if (!path) return '';
        // Already absolute
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        // Relative path — resolve through the API
        return this.resolveUrl(`/api${path.startsWith('/') ? path : `/${path}`}`);
    }
    // ── Error Message Extraction (Bulletproof) ─────────────────────────
    //
    // FastAPI/Pydantic can return errors in several shapes:
    //   1. {detail: "string"}                      — simple error
    //   2. {detail: [{loc, msg, type}, ...]}       — 422 validation errors (array)
    //   3. {detail: {msg: "string", ...}}          — single validation error (object)
    //   4. {message: "string"}                     — generic error
    //   5. Anything else                           — use fallback
    //
    // This method handles ALL cases and NEVER produces "[object Object]".
    extractErrorMessage(errorData, fallback) {
        const detail = errorData.detail;
        // Case 1: detail is a plain string (most common for HTTPException)
        if (typeof detail === "string") {
            return detail;
        }
        // Case 2: detail is an array of validation errors (FastAPI 422)
        if (Array.isArray(detail) && detail.length > 0) {
            // Extract msg from each error, strip "Value error, " prefix, join with ". "
            const messages = detail.map((item)=>{
                if (typeof item === "string") return item;
                if (item && typeof item === "object" && "msg" in item) {
                    return String(item.msg).replace(/^Value error,\s*/i, "");
                }
                return null;
            }).filter(Boolean);
            if (messages.length > 0) return messages.join(". ");
            return "Validation error";
        }
        // Case 3: detail is a single object with msg or message (edge case)
        if (detail && typeof detail === "object") {
            const d = detail;
            if ("msg" in d && typeof d.msg === "string") {
                return d.msg.replace(/^Value error,\s*/i, "");
            }
            if ("message" in d && typeof d.message === "string") {
                return d.message;
            }
        }
        // Case 4: top-level message field
        if (typeof errorData.message === "string") {
            return errorData.message;
        }
        // Case 5: detail exists but is some other type — safe stringify
        if (detail !== undefined && detail !== null) {
            const str = String(detail);
            if (str && str !== "[object Object]") return str;
        }
        return fallback;
    }
    // ── Core Fetch Wrapper ──────────────────────────────────────────────
    async request(path, options = {}) {
        const token = this.getToken();
        const headers = {
            ...options.headers
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
        // Don't set Content-Type for FormData (browser sets boundary automatically)
        if (!(options.body instanceof FormData)) {
            headers["Content-Type"] = headers["Content-Type"] || "application/json";
        }
        const url = this.resolveUrl(path);
        const response = await fetch(url, {
            ...options,
            headers
        });
        if (response.status === 401) {
            // Try token refresh
            const refreshed = await this.tryRefreshToken();
            if (refreshed) {
                headers["Authorization"] = `Bearer ${this.getToken()}`;
                const retryResponse = await fetch(url, {
                    ...options,
                    headers
                });
                if (!retryResponse.ok) {
                    throw new ApiClientError(await retryResponse.text(), retryResponse.status);
                }
                return retryResponse.json();
            }
            // Refresh failed — session is irrecoverably dead.
            // Force logout: clear auth state and redirect to login.
            // This prevents the "zombie session" where the user sees
            // the chat screen but all API calls silently fail.
            this.broadcastForceLogout();
            this.forceLogoutCallback?.();
            throw new ApiClientError("Session expired. Please sign in again.", 401);
        }
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = this.extractErrorMessage(errorData, response.statusText);
            } catch  {
                errorMessage = response.statusText;
            }
            throw new ApiClientError(errorMessage, response.status);
        }
        // Handle 204 No Content
        if (response.status === 204) {
            return {};
        }
        return response.json();
    }
    async tryRefreshToken() {
        // Guard against concurrent refresh attempts (e.g. interval + visibility
        // handler firing at the same time). Google uses a similar mutex.
        if (this.isRefreshing) return false;
        this.isRefreshing = true;
        try {
            const refreshTok = this.getRefreshToken();
            if (!refreshTok) return false;
            const url = this.resolveUrl("/api/auth/refresh");
            // The server expects a JSON body with the refresh token — NOT a Bearer
            // header with the access token. The NAS server validates the refresh
            // token hash against its database and issues a new access + refresh
            // token pair (rotation).
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    refresh_token: refreshTok
                })
            });
            if (response.ok) {
                const data = await response.json();
                const newAccessToken = data.access_token || "";
                const newRefreshToken = data.refresh_token || null;
                this.setToken(newAccessToken);
                // Store the rotated refresh token (NAS revokes the old one)
                this.setRefreshToken(newRefreshToken);
                // Sync the new tokens to the Zustand auth store so they
                // persist across page reloads via localStorage.
                this.syncRefreshTokenToStore(newAccessToken, newRefreshToken);
                // Broadcast to other tabs (Google BroadcastChannel pattern)
                this.broadcastTokenRefresh(newAccessToken, newRefreshToken);
                // Reconnect notification WebSocket with fresh token
                this.reconnectNotificationWebSocketAfterRefresh();
                return true;
            }
        } catch  {
        // Refresh failed — network error or server down
        } finally{
            this.isRefreshing = false;
        }
        return false;
    }
    /**
   * Sync refreshed tokens back to the Zustand auth store so they persist
   * in localStorage via the `persist` middleware. Without this, a page
   * reload after a silent refresh would revert to the old (revoked) tokens.
   */ syncRefreshTokenToStore(accessToken, refreshToken) {
        // Dynamically import to avoid circular dependency at module level.
        // This is the standard pattern for singletons that need store access.
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { useAuthStore } = __turbopack_context__.r("[project]/src/stores/auth-store.ts [app-client] (ecmascript)");
            const state = useAuthStore.getState();
            if (state.activeAccount) {
                useAuthStore.setState({
                    activeAccount: {
                        ...state.activeAccount,
                        token: accessToken,
                        refreshToken: refreshToken || undefined
                    },
                    // Also update the account in the accounts list
                    accounts: state.accounts.map((a)=>a.id === state.activeAccount.id ? {
                            ...a,
                            token: accessToken,
                            refreshToken: refreshToken || undefined
                        } : a)
                });
            }
        } catch  {
        // Store not available (SSR) — non-critical
        }
    }
    // ── Auth Endpoints ──────────────────────────────────────────────────
    async login(username, password) {
        const data = await this.request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });
        this.setToken(data.access_token);
        this.setRefreshToken(data.refresh_token || null);
        return data;
    }
    async register(username, email, password) {
        const data = await this.request("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username,
                email,
                password
            })
        });
        this.setToken(data.access_token);
        this.setRefreshToken(data.refresh_token || null);
        return data;
    }
    async logout() {
        try {
            await this.request("/api/auth/logout", {
                method: "POST"
            });
        } finally{
            this.setToken(null);
            this.setRefreshToken(null);
        }
    }
    // ── User Endpoints ──────────────────────────────────────────────────
    async getProfile() {
        return this.request("/api/users/me");
    }
    async updateProfile(data) {
        return this.request("/api/users/me", {
            method: "PUT",
            body: JSON.stringify(data)
        });
    }
    async changePassword(currentPassword, newPassword) {
        await this.request("/api/users/change-password", {
            method: "POST",
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
    }
    async deleteAccount() {
        await this.request("/api/users/me", {
            method: "DELETE"
        });
        this.setToken(null);
    }
    // ── Chat / History ──────────────────────────────────────────────────
    // Server returns session_id (not id) and timestamp (not created_at).
    // We normalize here so the rest of the app uses a consistent Conversation shape.
    async getConversations(limit = 50, page = 1) {
        const raw = await this.request(`/api/history?limit=${limit}&page=${page}`);
        return {
            conversations: (raw.conversations || []).map((c)=>({
                    id: c.session_id,
                    title: c.title,
                    created_at: c.updated_at || c.created_at,
                    message_count: c.message_count,
                    last_message_preview: c.last_message_preview,
                    metadata: c.metadata
                })),
            total: raw.total
        };
    }
    async getConversation(sessionId) {
        const raw = await this.request(`/api/history/${sessionId}`);
        return {
            session_id: raw.session_id,
            title: raw.title,
            messages: (raw.messages || []).map((m)=>{
                const parts = m.parts || m.metadata?.parts || [];
                // Extract image URLs from parts (preferred) or flat images (legacy)
                const imageUrls = parts.length > 0 ? parts.filter((p)=>p.type === "image" && p.file_url).map((p)=>p.file_url) : m.images || [];
                return {
                    role: m.role,
                    content: m.content || "",
                    created_at: m.timestamp || new Date().toISOString(),
                    steps: m.metadata?.steps || [],
                    thinking_duration_sec: m.metadata?.thinking_duration_sec || 0,
                    image_urls: imageUrls,
                    attachments: [],
                    nas_files: [],
                    parts: parts,
                    name: m.name || undefined
                };
            })
        };
    }
    async deleteConversation(sessionId) {
        await this.request(`/api/history/${sessionId}`, {
            method: "DELETE"
        });
    }
    async searchHistory(query, limit = 20) {
        return this.request(`/api/history/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    }
    // ── Sessions ────────────────────────────────────────────────────────
    async createSession(title) {
        return this.request("/api/sessions", {
            method: "POST",
            body: JSON.stringify({
                title
            })
        });
    }
    async getSessions() {
        const data = await this.request("/api/sessions");
        return data.sessions;
    }
    async deleteSession(sessionId) {
        await this.request(`/api/sessions/${sessionId}`, {
            method: "DELETE"
        });
    }
    // Note: Server-side session rename is not supported (no PATCH endpoint).
    // The title is auto-generated from the first message by the AI backend.
    // This method is a no-op to prevent 405 errors.
    async renameSession(_sessionId, _title) {
    // Server does not support session rename — title is auto-set from first message
    }
    /**
   * Cancel an active agent run on a session (v2 — registry-based).
   * Signals the engine to stop via cancel_event and persists partial results.
   */ async cancelAgentRun(sessionId) {
        try {
            await this.request(`/api/sessions/${sessionId}/cancel`, {
                method: "POST"
            });
        } catch  {
        // Non-critical — silent failure (run may have already completed)
        }
    }
    // ── Agents ──────────────────────────────────────────────────────────
    async getAgents() {
        const data = await this.request("/api/agents");
        return data.agents;
    }
    async getAvailableTools() {
        return this.request("/api/agents/tools");
    }
    async getModels() {
        const data = await this.request("/api/agents/models");
        return data.models;
    }
    // ── Run Status (Gemini-style auto-resume) ────────────────────────────
    /**
   * Check if a session has an active agent generation in progress.
   * Used by loadConversation to detect mid-generation state and auto-resume.
   */ async getRunStatus(sessionId) {
        try {
            return await this.request(`/api/sessions/${sessionId}/run-status`);
        } catch  {
            return {
                status: "idle",
                has_active_run: false,
                session_id: sessionId
            };
        }
    }
    // ── Streaming ───────────────────────────────────────────────────────
    async *streamMessage(message, sessionId, options) {
        // ── Pre-flight token check (Google pattern) ──────────────────────────
        // SSE bypasses the normal request() interceptor, so we check the token
        // expiry here before opening the stream. If it expires within 30s, refresh
        // silently first — the user never sees a failure.
        if (this.isTokenExpiredOrExpiringSoon(30)) {
            await this.tryRefreshToken();
        }
        let token = this.getToken();
        const url = this.resolveUrl("/api/agents/stream");
        const body = JSON.stringify({
            message,
            session_id: sessionId,
            agent: options?.agent,
            model: options?.model,
            images: options?.images,
            file_parts: options?.file_parts,
            is_temporary: options?.isTemporary,
            description: options?.description
        });
        let response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...token ? {
                    Authorization: `Bearer ${token}`
                } : {}
            },
            body,
            signal: options?.signal
        });
        // ── 401 auto-retry (expired token during stream initiation) ─────────
        // Mirrors what request() already does for regular JSON endpoints.
        if (response.status === 401) {
            const refreshed = await this.tryRefreshToken();
            if (refreshed) {
                token = this.getToken();
                response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...token ? {
                            Authorization: `Bearer ${token}`
                        } : {}
                    },
                    body,
                    signal: options?.signal
                });
            }
        }
        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = this.extractErrorMessage(errorData, response.statusText);
            } catch  {
                errorMessage = response.statusText;
            }
            // 429 = Too Many Runs, 503 = Server Busy — both carry registry error details
            throw new ApiClientError(errorMessage, response.status);
        }
        if (!response.body) {
            throw new ApiClientError("No response body", 500);
        }
        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
            while(true){
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, {
                    stream: true
                });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines){
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") return;
                        try {
                            const event = JSON.parse(data);
                            yield event;
                        } catch  {
                        // Skip malformed events
                        }
                    }
                }
            }
        } finally{
            reader.releaseLock();
        }
    }
    // ── File Upload ─────────────────────────────────────────────────────
    async uploadFile(file) {
        const formData = new FormData();
        formData.append("file", file);
        return this.request("/api/upload", {
            method: "POST",
            body: formData
        });
    }
    // ── Heartbeats / Reminders ──────────────────────────────────────────
    async getHeartbeats() {
        const data = await this.request("/api/heartbeats");
        return data.heartbeats;
    }
    async createHeartbeat(data) {
        return this.request("/api/heartbeats", {
            method: "POST",
            body: JSON.stringify(data)
        });
    }
    async updateHeartbeat(id, data) {
        await this.request(`/api/heartbeats/${id}`, {
            method: "PUT",
            body: JSON.stringify(data)
        });
    }
    async deleteHeartbeat(id) {
        await this.request(`/api/heartbeats/${id}`, {
            method: "DELETE"
        });
    }
    // ── GPU Heartbeat ───────────────────────────────────────────────────
    async sendGpuHeartbeat(state = "active") {
        try {
            await this.request("/api/gpu/heartbeat", {
                method: "POST",
                body: JSON.stringify({
                    state
                })
            });
        } catch  {
        // Non-critical — silent failure
        }
    }
    async getGpuStatus() {
        return this.request("/api/gpu/status");
    }
    // ── Notifications ───────────────────────────────────────────────────
    async getNotifications(limit = 50) {
        return this.request(`/api/notifications?limit=${limit}`);
    }
    async markNotificationRead(id) {
        await this.request(`/api/notifications/${id}/read`, {
            method: "POST"
        });
    }
    async markAllNotificationsRead() {
        await this.request("/api/notifications/read-all", {
            method: "POST"
        });
    }
    // ── Calendar ─────────────────────────────────────────────────────────
    // Server: GET /calendar?range=month&after=YYYY-MM-DD&before=YYYY-MM-DD
    async getCalendarEvents(year, month) {
        const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0);
        const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
        return this.request(`/api/calendar?range=custom&after=${firstDay}&before=${lastDayStr}&type=all&limit=100`);
    }
    // ── Heartbeat Results ───────────────────────────────────────────────
    async getHeartbeatResults(id, limit = 20) {
        return this.request(`/api/heartbeats/${id}/results?limit=${limit}`);
    }
    // ── Email Integration ──────────────────────────────────────────────
    // Server: /integrations/email/*
    async getEmailStatus() {
        return this.request("/api/integrations/email/status");
    }
    async setupEmail(email, appPassword, provider) {
        await this.request("/api/integrations/email/setup", {
            method: "POST",
            body: JSON.stringify({
                email,
                app_password: appPassword,
                provider
            })
        });
    }
    async testEmail(action = "list_inbox") {
        return this.request("/api/integrations/email/test", {
            method: "POST",
            body: JSON.stringify({
                action
            })
        });
    }
    async disconnectEmail() {
        await this.request("/api/integrations/email/setup", {
            method: "DELETE"
        });
    }
    // ── Telegram Integration ───────────────────────────────────────────
    // Server: /integrations/telegram/*
    async getTelegramStatus() {
        try {
            return await this.request("/api/integrations/telegram/status");
        } catch  {
            return {
                configured: false
            };
        }
    }
    async setupTelegram(botToken, allowedUsers = []) {
        return this.request("/api/integrations/telegram/setup", {
            method: "POST",
            body: JSON.stringify({
                bot_token: botToken,
                ...allowedUsers.length > 0 ? {
                    allowed_users: allowedUsers
                } : {}
            })
        });
    }
    async testTelegram() {
        return this.request("/api/integrations/telegram/test", {
            method: "POST"
        });
    }
    async disconnectTelegram() {
        await this.request("/api/integrations/telegram/setup", {
            method: "DELETE"
        });
    }
    // ── Notifications (extended) ────────────────────────────────────────
    async deleteNotification(id) {
        await this.request(`/api/notifications/${id}`, {
            method: "DELETE"
        });
    }
    async clearAllNotifications() {
        await this.request("/api/notifications", {
            method: "DELETE"
        });
    }
    async getUnreadCount() {
        try {
            const data = await this.request("/api/notifications/unread");
            return data.unread_count;
        } catch  {
            return 0;
        }
    }
    // ── Artifacts ─────────────────────────────────────────────────────────
    async getArtifacts(limit = 50, offset = 0, fileType) {
        const params = new URLSearchParams({
            limit: String(limit),
            offset: String(offset)
        });
        if (fileType) params.set("file_type", fileType);
        return this.request(`/api/artifacts?${params}`);
    }
    async deleteArtifact(id) {
        await this.request(`/api/artifacts/${id}`, {
            method: "DELETE"
        });
    }
    /**
   * Build a full URL for an artifact file.
   * Uses the stored_path from the artifacts API.
   */ getArtifactFileUrl(storedPath) {
        const server = this.getServerUrl();
        if (!server) return `/files/${storedPath}`;
        return `${server}/api/ai/files/${storedPath}`;
    }
    // ── Authenticated File Fetch ──────────────────────────────────────────
    // <img> tags can't send Authorization headers. This fetches the file
    // with auth and returns a blob URL that can be used as img src.
    async fetchAuthenticatedBlob(storedPath) {
        const url = this.getArtifactFileUrl(storedPath);
        const token = this.getToken();
        const resp = await fetch(url, {
            headers: token ? {
                Authorization: `Bearer ${token}`
            } : {}
        });
        if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`);
        const blob = await resp.blob();
        return URL.createObjectURL(blob);
    }
    /**
   * Fetch any server file path with auth and return a blob URL.
   * Handles both:
   *   - Chat image paths: /files/user123/image.jpg, /images/download?file_id=xxx
   *   - Artifact stored paths: user123/artifacts/image.png (bare, no /files/ prefix)
   *
   * Industry pattern: Google Workspace, Notion, Slack all use this approach
   * for authenticated media — fetch with Bearer token → blob URL.
   */ async fetchAuthenticatedFileBlob(filePath) {
        let url;
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            // Already absolute
            url = filePath;
        } else if (filePath.startsWith('/files/') || filePath.startsWith('/images/') || filePath.startsWith('/api/')) {
            // Chat image or API path — resolve through the standard API route mapper
            url = this.resolveFileUrl(filePath);
        } else {
            // Bare path (artifact stored_path like "user123/artifacts/img.png")
            // Use the artifact-specific URL builder
            url = this.getArtifactFileUrl(filePath);
        }
        const token = this.getToken();
        const resp = await fetch(url, {
            headers: token ? {
                Authorization: `Bearer ${token}`
            } : {}
        });
        if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`);
        const blob = await resp.blob();
        return URL.createObjectURL(blob);
    }
    // ── Health Check ────────────────────────────────────────────────────
    async healthCheck() {
        try {
            await this.request("/api/health");
            return true;
        } catch  {
            return false;
        }
    }
    // ── Notification WebSocket (Google/Slack/OpenAI pattern) ──────────────
    // Real-time push notifications via WebSocket. Uses the latest JWT
    // token from the auth store on every (re)connection attempt, so token
    // refreshes automatically propagate to the WebSocket layer.
    //
    // Architecture (exactly matching Google Chat / Slack):
    //   1. Connect with fresh JWT as ?token= query parameter
    //   2. On disconnect/error → exponential backoff reconnect (capped at 30s)
    //   3. On token refresh → reconnect immediately with new token
    //   4. Heartbeat ping every 25s to detect dead connections proactively
    //   5. visibilitychange → reconnect on tab wake if disconnected
    _notifWs = null;
    _notifReconnectTimer = null;
    _notifPingTimer = null;
    _notifReconnectAttempt = 0;
    _notifListeners = new Set();
    _notifWsActive = false;
    /**
   * Build the WebSocket URL using the current (freshest) token.
   * Always called at connection time so token refreshes propagate automatically.
   */ _buildNotifWsUrl() {
        const token = this.getToken();
        if (!token) return null;
        const server = this.getServerUrl();
        if (!server) return null;
        // Convert http(s) → ws(s)
        const wsBase = server.replace(/^http/, "ws");
        return `${wsBase}/api/ai/ws/notifications?token=${encodeURIComponent(token)}`;
    }
    /**
   * Start the notification WebSocket connection.
   * Call after login and after hydration from localStorage.
   * Idempotent — safe to call multiple times.
   */ connectNotificationWebSocket() {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        this._notifWsActive = true;
        this._connectNotifWs();
        // Also reconnect when tab becomes visible (matches Slack behavior)
        if (!this._notifVisibilityHandler) {
            this._notifVisibilityHandler = ()=>{
                if (document.visibilityState === "visible" && this._notifWsActive) {
                    if (!this._notifWs || this._notifWs.readyState !== WebSocket.OPEN) {
                        this._notifReconnectAttempt = 0; // Reset backoff on manual wake
                        this._connectNotifWs();
                    }
                }
            };
            document.addEventListener("visibilitychange", this._notifVisibilityHandler);
        }
    }
    _notifVisibilityHandler = null;
    /**
   * Disconnect the notification WebSocket cleanly.
   * Call on logout / clearAuth.
   */ disconnectNotificationWebSocket() {
        this._notifWsActive = false;
        this._cleanupNotifWs();
    }
    /**
   * Register a listener for notification events.
   * Returns an unsubscribe function (React useEffect pattern).
   */ onNotification(callback) {
        this._notifListeners.add(callback);
        return ()=>{
            this._notifListeners.delete(callback);
        };
    }
    /**
   * Called after a token refresh succeeds. Reconnects the notification WS
   * with the new token so it doesn't get rejected with 403.
   * This is exactly what Google and Slack do: reconnect WS after token rotation.
   */ reconnectNotificationWebSocketAfterRefresh() {
        if (!this._notifWsActive) return;
        // Close existing connection (will trigger reconnect with fresh token)
        if (this._notifWs) {
            this._notifWs.close(1000, "Token refreshed — reconnecting");
        }
        this._notifReconnectAttempt = 0;
        this._connectNotifWs();
    }
    _connectNotifWs() {
        if (("TURBOPACK compile-time value", "object") === "undefined" || !this._notifWsActive) return;
        // Cleanup any existing connection/timers
        this._cleanupNotifWs();
        const url = this._buildNotifWsUrl();
        if (!url) return;
        try {
            const ws = new WebSocket(url);
            this._notifWs = ws;
            ws.onopen = ()=>{
                console.log("[NotifWS] Connected");
                this._notifReconnectAttempt = 0;
                // Start heartbeat ping (exactly like Slack: ping every 25s)
                this._notifPingTimer = setInterval(()=>{
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: "ping"
                        }));
                    }
                }, 25_000);
            };
            ws.onmessage = (event)=>{
                try {
                    const data = JSON.parse(event.data);
                    // Dispatch to all listeners
                    for (const listener of this._notifListeners){
                        try {
                            listener(data);
                        } catch  {}
                    }
                } catch  {
                // Malformed message — skip
                }
            };
            ws.onclose = (event)=>{
                console.log(`[NotifWS] Closed: code=${event.code}, reason=${event.reason}`);
                this._clearNotifTimers();
                // Reconnect with exponential backoff (capped at 30s)
                if (this._notifWsActive && event.code !== 1000) {
                    this._scheduleNotifReconnect();
                }
            };
            ws.onerror = ()=>{
                // onclose will fire after onerror — reconnect handled there
                console.log("[NotifWS] Connection error");
            };
        } catch  {
            // WebSocket constructor failed — schedule reconnect
            this._scheduleNotifReconnect();
        }
    }
    _scheduleNotifReconnect() {
        if (!this._notifWsActive) return;
        if (this._notifReconnectTimer) return; // Already scheduled
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
        const delaySec = Math.min(30, Math.pow(2, this._notifReconnectAttempt));
        this._notifReconnectAttempt++;
        console.log(`[NotifWS] Reconnecting in ${delaySec}s (attempt ${this._notifReconnectAttempt})`);
        this._notifReconnectTimer = setTimeout(()=>{
            this._notifReconnectTimer = null;
            this._connectNotifWs();
        }, delaySec * 1000);
    }
    _clearNotifTimers() {
        if (this._notifPingTimer) {
            clearInterval(this._notifPingTimer);
            this._notifPingTimer = null;
        }
    }
    _cleanupNotifWs() {
        this._clearNotifTimers();
        if (this._notifReconnectTimer) {
            clearTimeout(this._notifReconnectTimer);
            this._notifReconnectTimer = null;
        }
        if (this._notifWs) {
            this._notifWs.onclose = null; // Prevent reconnect loop
            this._notifWs.onerror = null;
            this._notifWs.onmessage = null;
            if (this._notifWs.readyState === WebSocket.OPEN || this._notifWs.readyState === WebSocket.CONNECTING) {
                this._notifWs.close(1000, "Cleanup");
            }
            this._notifWs = null;
        }
    }
}
const apiClient = new ApiClient();
;
const __TURBOPACK__default__export__ = ApiClient;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/stores/auth-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuthStore",
    ()=>useAuthStore
]);
// ============================================================================
// Sphere AI — Auth Store (Zustand)
// Port of account_provider.dart + UserNotifier
// ============================================================================
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api-client.ts [app-client] (ecmascript)");
;
;
;
const useAuthStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        _hasHydrated: false,
        user: null,
        accounts: [],
        activeAccount: null,
        isLoading: false,
        error: null,
        login: async (username, password)=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                const data = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].login(username, password);
                const token = data.access_token;
                // Fetch profile to get full user info
                const profile = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getProfile();
                // Read the server URL from what the gateway/user configured
                const serverUrl = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getServerUrl() || "local";
                const account = {
                    id: `${username}@${serverUrl}`,
                    username,
                    email: profile.email || "",
                    serverUrl,
                    token,
                    refreshToken: data.refresh_token || undefined
                };
                // Store the refresh token in the API client for silent refresh
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(data.refresh_token || null);
                const { accounts } = get();
                const updatedAccounts = [
                    ...accounts.filter((a)=>a.id !== account.id),
                    account
                ];
                set({
                    user: profile,
                    activeAccount: account,
                    accounts: updatedAccounts,
                    isLoading: false
                });
                // Start the background refresh timer now that we have a valid token
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].scheduleTokenRefresh();
                // Start real-time notification WebSocket (Google/Slack pattern)
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].connectNotificationWebSocket();
            } catch (err) {
                set({
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Login failed"
                });
                throw err;
            }
        },
        register: async (username, email, password)=>{
            set({
                isLoading: true,
                error: null
            });
            try {
                const data = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].register(username, email, password);
                const token = data.access_token;
                const serverUrl = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getServerUrl() || "local";
                const account = {
                    id: `${username}@${serverUrl}`,
                    username,
                    email,
                    serverUrl,
                    token,
                    refreshToken: data.refresh_token || undefined
                };
                // Store the refresh token in the API client for silent refresh
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(data.refresh_token || null);
                const { accounts } = get();
                const updatedAccounts = [
                    ...accounts.filter((a)=>a.id !== account.id),
                    account
                ];
                set({
                    user: {
                        id: "new",
                        username,
                        email
                    },
                    activeAccount: account,
                    accounts: updatedAccounts,
                    isLoading: false
                });
                // Start the background refresh timer
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].scheduleTokenRefresh();
                // Start real-time notification WebSocket
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].connectNotificationWebSocket();
            } catch (err) {
                set({
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Registration failed"
                });
                throw err;
            }
        },
        logout: async ()=>{
            try {
                await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].logout();
            } catch  {
            // Server logout failed — still clear local state
            }
            // Stop the background refresh timer
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].cancelTokenRefreshTimer();
            // Stop notification WebSocket
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].disconnectNotificationWebSocket();
            const { accounts, activeAccount } = get();
            const remaining = accounts.filter((a)=>a.id !== activeAccount?.id);
            if (remaining.length > 0) {
                // Switch to next account
                const next = remaining[0];
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(next.token);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(next.refreshToken || null);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(next.serverUrl);
                set({
                    activeAccount: next,
                    accounts: remaining,
                    user: {
                        id: "cached",
                        username: next.username,
                        email: next.email
                    }
                });
                // Restart the timer for the newly active account
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].scheduleTokenRefresh();
            } else {
                set({
                    user: null,
                    activeAccount: null,
                    accounts: []
                });
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(null);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(null);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(null);
            }
        },
        logoutAll: async ()=>{
            const { accounts } = get();
            for (const account of accounts){
                try {
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(account.token);
                    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].logout();
                } catch  {
                // Best-effort
                }
            }
            // Stop the background refresh timer
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].cancelTokenRefreshTimer();
            // Stop notification WebSocket
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].disconnectNotificationWebSocket();
            set({
                user: null,
                activeAccount: null,
                accounts: []
            });
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(null);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(null);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(null);
        },
        fetchProfile: async ()=>{
            try {
                const profile = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getProfile();
                set({
                    user: profile
                });
            } catch  {
            // Profile fetch failed — keep existing user data
            }
        },
        switchAccount: (account)=>{
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(account.token);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(account.refreshToken || null);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(account.serverUrl);
            set({
                activeAccount: account,
                user: {
                    id: "cached",
                    username: account.username,
                    email: account.email
                }
            });
        },
        removeAccount: (accountId)=>{
            const { accounts, activeAccount } = get();
            const remaining = accounts.filter((a)=>a.id !== accountId);
            if (activeAccount?.id === accountId) {
                if (remaining.length > 0) {
                    const next = remaining[0];
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(next.token);
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(next.serverUrl);
                    set({
                        accounts: remaining,
                        activeAccount: next,
                        user: {
                            id: "cached",
                            username: next.username,
                            email: next.email
                        }
                    });
                } else {
                    set({
                        accounts: [],
                        activeAccount: null,
                        user: null
                    });
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(null);
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(null);
                }
            } else {
                set({
                    accounts: remaining
                });
            }
        },
        setError: (error)=>set({
                error
            }),
        clearAuth: ()=>{
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(null);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(null);
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(null);
            // Stop the background refresh timer
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].cancelTokenRefreshTimer();
            // Stop notification WebSocket
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].disconnectNotificationWebSocket();
            set({
                user: null,
                activeAccount: null,
                accounts: [],
                error: null
            });
        },
        hydrateFromStorage: ()=>{
            const { activeAccount } = get();
            if (activeAccount?.token) {
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(activeAccount.token);
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(activeAccount.serverUrl);
            }
        }
    }), {
    name: "sphere-auth",
    partialize: (state)=>({
            accounts: state.accounts,
            activeAccount: state.activeAccount,
            user: state.user
        }),
    onRehydrateStorage: ()=>(state, error)=>{
            // Restore API client token + server URL from persisted state
            if (state?.activeAccount) {
                if (state.activeAccount.token) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setToken(state.activeAccount.token);
                }
                if (state.activeAccount.refreshToken) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setRefreshToken(state.activeAccount.refreshToken);
                }
                if (state.activeAccount.serverUrl) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(state.activeAccount.serverUrl);
                }
            }
            // Signal that hydration is complete — safe to make routing decisions.
            // queueMicrotask defers until after useAuthStore is fully assigned,
            // avoiding a TDZ ReferenceError during the create() call.
            // We set it regardless of errors so the UI never stays frozen.
            queueMicrotask(()=>{
                useAuthStore.setState({
                    _hasHydrated: true
                });
                // Register the force-logout callback so the API client can
                // clear auth state and redirect on unrecoverable 401.
                // This is the Google pattern: API layer signals auth death → UI
                // clears state and redirects without user action.
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].registerForceLogout(()=>{
                    useAuthStore.getState().clearAuth();
                    if ("TURBOPACK compile-time truthy", 1) {
                        window.location.replace("/login");
                    }
                });
                // Initialize BroadcastChannel for cross-tab token sync (Google pattern)
                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].initTokenBroadcast();
                // Start proactive token refresh now that we have the token from storage.
                // This is exactly what Google does on page load: check JWT exp and
                // schedule a silent refresh before it expires.
                if (state?.activeAccount?.token) {
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].scheduleTokenRefresh();
                    // Start real-time notification WebSocket
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].connectNotificationWebSocket();
                }
            });
            void error; // suppress unused-var lint
        }
}));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/ds-logo.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ============================================================================
// DS Logo Component — SVG from DS.svg (DysoSphere lettermark)
// ============================================================================
__turbopack_context__.s([
    "DSLogo",
    ()=>DSLogo
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function DSLogo({ className = "", size = 28 }) {
    // SVG viewBox: 0 0 164 96
    const aspectRatio = 164 / 96;
    const width = size * aspectRatio;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        width: width,
        height: size,
        viewBox: "0 0 164 96",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        className: className,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            d: "M33 94.3636H-2.86102e-06V1.27274H33.2727C42.6364 1.27274 50.697 3.13637 57.4545 6.86365C64.2121 10.5606 69.4091 15.8788 73.0455 22.8182C76.7121 29.7576 78.5455 38.0606 78.5455 47.7273C78.5455 57.4243 76.7121 65.7576 73.0455 72.7273C69.4091 79.697 64.1818 85.0455 57.3636 88.7727C50.5758 92.5 42.4545 94.3636 33 94.3636ZM19.6818 77.5H32.1818C38 77.5 42.8939 76.4697 46.8636 74.4091C50.8636 72.3182 53.8636 69.0909 55.8636 64.7273C57.8939 60.3333 58.9091 54.6667 58.9091 47.7273C58.9091 40.8485 57.8939 35.2273 55.8636 30.8636C53.8636 26.5 50.8788 23.2879 46.9091 21.2273C42.9394 19.1667 38.0455 18.1364 32.2273 18.1364H19.6818V77.5ZM143.625 28.0455C143.261 24.3788 141.701 21.5303 138.943 19.5C136.186 17.4697 132.443 16.4546 127.716 16.4546C124.504 16.4546 121.792 16.9091 119.58 17.8182C117.367 18.697 115.67 19.9243 114.489 21.5C113.337 23.0758 112.761 24.8636 112.761 26.8636C112.701 28.5303 113.049 29.9849 113.807 31.2273C114.595 32.4697 115.67 33.5455 117.034 34.4546C118.398 35.3333 119.973 36.1061 121.761 36.7727C123.549 37.4091 125.458 37.9546 127.489 38.4091L135.852 40.4091C139.913 41.3182 143.64 42.5303 147.034 44.0455C150.428 45.5606 153.367 47.4243 155.852 49.6364C158.337 51.8485 160.261 54.4546 161.625 57.4546C163.019 60.4546 163.731 63.8939 163.761 67.7727C163.731 73.4697 162.277 78.4091 159.398 82.5909C156.549 86.7424 152.428 89.9697 147.034 92.2727C141.67 94.5455 135.201 95.6818 127.625 95.6818C120.11 95.6818 113.564 94.5303 107.989 92.2273C102.443 89.9243 98.1098 86.5152 94.9886 82C91.8977 77.4546 90.2765 71.8333 90.125 65.1364H109.17C109.383 68.2576 110.277 70.8636 111.852 72.9546C113.458 75.0152 115.595 76.5758 118.261 77.6364C120.958 78.6667 124.004 79.1818 127.398 79.1818C130.731 79.1818 133.625 78.697 136.08 77.7273C138.564 76.7576 140.489 75.4091 141.852 73.6818C143.216 71.9546 143.898 69.9697 143.898 67.7273C143.898 65.6364 143.277 63.8788 142.034 62.4546C140.822 61.0303 139.034 59.8182 136.67 58.8182C134.337 57.8182 131.473 56.9091 128.08 56.0909L117.943 53.5455C110.095 51.6364 103.898 48.6515 99.3523 44.5909C94.8068 40.5303 92.5492 35.0606 92.5795 28.1818C92.5492 22.5455 94.0492 17.6212 97.0795 13.4091C100.14 9.19698 104.337 5.9091 109.67 3.54546C115.004 1.18183 121.064 7.62939e-06 127.852 7.62939e-06C134.761 7.62939e-06 140.792 1.18183 145.943 3.54546C151.125 5.9091 155.155 9.19698 158.034 13.4091C160.913 17.6212 162.398 22.5 162.489 28.0455H143.625Z",
            fill: "currentColor"
        }, void 0, false, {
            fileName: "[project]/src/components/ui/ds-logo.tsx",
            lineNumber: 25,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/ds-logo.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
_c = DSLogo;
var _c;
__turbopack_context__.k.register(_c, "DSLogo");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/app/(auth)/login/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>LoginPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ============================================================================
// Login Page — Port of login_screen.dart
// Premium dark glass card design with gradient accent button
//
// Supports two entry points:
//   1. Via Gateway — serverUrl already in localStorage, skip server input
//   2. Direct visit — user enters server URL here (like the mobile app)
// ============================================================================
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eye.mjs [app-client] (ecmascript) <export default as Eye>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2d$off$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__EyeOff$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eye-off.mjs [app-client] (ecmascript) <export default as EyeOff>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.mjs [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.mjs [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.mjs [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.mjs [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.mjs [app-client] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$auth$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/auth-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ds$2d$logo$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/ds-logo.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
function LoginPageInner() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const { login, isLoading, error, setError, user, _hasHydrated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$auth$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthStore"])();
    // Determine post-auth redirect based on ?service= param from gateway
    const service = searchParams.get("service");
    const redirectPath = service === "nas" ? "/nas" : "/chat";
    const [serverUrl, setServerUrlInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [username, setUsername] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [showPassword, setShowPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [serverConnected, setServerConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [checkingServer, setCheckingServer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // On mount, check if a server URL is already configured (e.g. via gateway)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LoginPageInner.useEffect": ()=>{
            const stored = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getServerUrl();
            if (stored) {
                setServerUrlInput(stored.replace(/^https?:\/\//, ""));
                setServerConnected(true);
            }
        }
    }["LoginPageInner.useEffect"], []);
    // If user is already authenticated (e.g. via gateway), redirect to chat
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LoginPageInner.useEffect": ()=>{
            if (_hasHydrated && user) {
                router.push(redirectPath);
            }
        }
    }["LoginPageInner.useEffect"], [
        _hasHydrated,
        user,
        router
    ]);
    const handleServerConnect = async ()=>{
        const raw = serverUrl.trim();
        if (!raw) {
            setError("Please enter your SphereX server address");
            return;
        }
        // Normalize URL
        let normalized = raw;
        if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            normalized = `https://${raw}`;
        }
        normalized = normalized.replace(/\/+$/, "");
        setCheckingServer(true);
        setError(null);
        try {
            // Health check through Nginx: GET /api/ai/health
            const controller = new AbortController();
            const timeoutId = setTimeout(()=>controller.abort(), 8000);
            const res = await fetch(`${normalized}/api/ai/health`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error("Server returned an error");
            // Store and configure
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].setServerUrl(normalized);
            try {
                localStorage.setItem("spherex_server", normalized);
            } catch  {}
            setServerConnected(true);
            setCheckingServer(false);
        } catch (err) {
            setCheckingServer(false);
            if (err.name === "AbortError") {
                setError("Server did not respond — check the address and try again.");
            } else {
                setError("Cannot connect. If using HTTPS with a self-signed certificate, " + "visit your server URL directly first to accept the certificate.");
            }
        }
    };
    const handleSubmit = async (e)=>{
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError("Please fill in all fields");
            return;
        }
        try {
            await login(username.trim(), password.trim());
            router.push(redirectPath);
        } catch  {
        // Error already set by store
        }
    };
    const inputClass = "w-full pl-12 pr-4 py-4 bg-white/[0.06] border border-[var(--color-border-default)] rounded-[14px] text-[var(--color-text-primary)] text-[15px] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none transition-colors disabled:opacity-50";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] px-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-3 mb-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ds$2d$logo$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DSLogo"], {
                        size: 30,
                        className: "text-[var(--color-accent-blue)]"
                    }, void 0, false, {
                        fileName: "[project]/src/app/(auth)/login/page.tsx",
                        lineNumber: 125,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "text-white text-xl font-bold tracking-tight leading-tight",
                            children: "Sphere AI"
                        }, void 0, false, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 127,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/app/(auth)/login/page.tsx",
                        lineNumber: 126,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/(auth)/login/page.tsx",
                lineNumber: 124,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full max-w-md glass-card p-8",
                children: !serverConnected ? /* ── Step 1: Server Connection ────────────────────────────── */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-center mb-2",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white/40 text-sm",
                                children: "Connect to your SphereX server"
                            }, void 0, false, {
                                fileName: "[project]/src/app/(auth)/login/page.tsx",
                                lineNumber: 139,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 138,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "relative",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"], {
                                    className: "absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]",
                                    size: 18
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 146,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: "login-server-url",
                                    type: "text",
                                    placeholder: "e.g. 192.168.1.100 or spherex.company.com",
                                    value: serverUrl,
                                    onChange: (e)=>setServerUrlInput(e.target.value),
                                    disabled: checkingServer,
                                    autoComplete: "url",
                                    spellCheck: false,
                                    onKeyDown: (e)=>e.key === "Enter" && handleServerConnect(),
                                    className: inputClass
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 150,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 145,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-white/15 text-xs px-1",
                            children: "Your SphereX appliance IP or domain address"
                        }, void 0, false, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 164,
                            columnNumber: 13
                        }, this),
                        error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-start gap-3 p-3 rounded-[10px] bg-red-500/10 border border-red-500/20",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                    className: "text-red-400 shrink-0 mt-0.5",
                                    size: 16
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 171,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-red-400 text-[13px] leading-relaxed",
                                    children: error
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 172,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 170,
                            columnNumber: 15
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            id: "login-connect",
                            onClick: handleServerConnect,
                            disabled: checkingServer,
                            className: "w-full h-[52px] rounded-[14px] bg-[var(--color-accent-blue)] text-white font-semibold text-base tracking-wide hover:bg-[var(--color-accent-blue-hover)] active:brightness-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center",
                            children: checkingServer ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                className: "animate-spin",
                                size: 22
                            }, void 0, false, {
                                fileName: "[project]/src/app/(auth)/login/page.tsx",
                                lineNumber: 186,
                                columnNumber: 17
                            }, this) : "Connect"
                        }, void 0, false, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 179,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                    lineNumber: 137,
                    columnNumber: 11
                }, this) : /* ── Step 2: Credentials ──────────────────────────────────── */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-2 mb-5 px-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 197,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[var(--color-text-muted)] text-xs",
                                    children: [
                                        "Connected to",
                                        " ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-white/50 font-medium",
                                            children: serverUrl.replace(/^https?:\/\//, "")
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 200,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 198,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>{
                                        setServerConnected(false);
                                        setError(null);
                                    },
                                    className: "ml-auto text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text-tertiary)] transition-colors",
                                    children: "Change"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 204,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 196,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                            onSubmit: handleSubmit,
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                            className: "absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]",
                                            size: 18
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 218,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            id: "login-username",
                                            type: "text",
                                            placeholder: "Username",
                                            value: username,
                                            onChange: (e)=>setUsername(e.target.value),
                                            disabled: isLoading,
                                            autoComplete: "username",
                                            className: inputClass
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 222,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 217,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                            className: "absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]",
                                            size: 18
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 236,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                            id: "login-password",
                                            type: showPassword ? "text" : "password",
                                            placeholder: "Password",
                                            value: password,
                                            onChange: (e)=>setPassword(e.target.value),
                                            disabled: isLoading,
                                            autoComplete: "current-password",
                                            onKeyDown: (e)=>e.key === "Enter" && handleSubmit(e),
                                            className: "w-full pl-12 pr-12 py-4 bg-white/[0.06] border border-[var(--color-border-default)] rounded-[14px] text-[var(--color-text-primary)] text-[15px] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none transition-colors disabled:opacity-50"
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 240,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            type: "button",
                                            onClick: ()=>setShowPassword(!showPassword),
                                            className: "absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors",
                                            tabIndex: -1,
                                            children: showPassword ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__["Eye"], {
                                                size: 18
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/(auth)/login/page.tsx",
                                                lineNumber: 257,
                                                columnNumber: 35
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2d$off$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__EyeOff$3e$__["EyeOff"], {
                                                size: 18
                                            }, void 0, false, {
                                                fileName: "[project]/src/app/(auth)/login/page.tsx",
                                                lineNumber: 257,
                                                columnNumber: 55
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 251,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 235,
                                    columnNumber: 15
                                }, this),
                                error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-start gap-3 p-3 rounded-[10px] bg-red-500/10 border border-red-500/20",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                            className: "text-red-400 shrink-0 mt-0.5",
                                            size: 16
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 264,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-red-400 text-[13px] leading-relaxed",
                                            children: error
                                        }, void 0, false, {
                                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                                            lineNumber: 265,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 263,
                                    columnNumber: 17
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    id: "login-submit",
                                    type: "submit",
                                    disabled: isLoading,
                                    className: "w-full h-[52px] rounded-[14px] bg-[var(--color-accent-blue)] text-white font-semibold text-base tracking-wide hover:bg-[var(--color-accent-blue-hover)] active:brightness-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center",
                                    children: isLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                                        className: "animate-spin",
                                        size: 22
                                    }, void 0, false, {
                                        fileName: "[project]/src/app/(auth)/login/page.tsx",
                                        lineNumber: 279,
                                        columnNumber: 19
                                    }, this) : "Sign in"
                                }, void 0, false, {
                                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                                    lineNumber: 272,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/app/(auth)/login/page.tsx",
                            lineNumber: 215,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/app/(auth)/login/page.tsx",
                    lineNumber: 194,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/app/(auth)/login/page.tsx",
                lineNumber: 134,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-7 text-[var(--color-text-muted)] text-[13px]",
                children: [
                    "Don't have an account?",
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: service ? `/register?service=${service}` : "/register",
                        className: "text-[var(--color-accent-blue)] font-semibold hover:underline",
                        children: "Sign up"
                    }, void 0, false, {
                        fileName: "[project]/src/app/(auth)/login/page.tsx",
                        lineNumber: 292,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/app/(auth)/login/page.tsx",
                lineNumber: 290,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: "/",
                className: "mt-3 text-[var(--color-text-muted)] text-[12px] hover:text-[var(--color-text-tertiary)] transition-colors inline-flex items-center gap-1.5",
                children: "← Back to Services"
            }, void 0, false, {
                fileName: "[project]/src/app/(auth)/login/page.tsx",
                lineNumber: 301,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/app/(auth)/login/page.tsx",
        lineNumber: 122,
        columnNumber: 5
    }, this);
}
_s(LoginPageInner, "9y31w8f77QlQbMscx5f6cgb216E=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$auth$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuthStore"]
    ];
});
_c = LoginPageInner;
function LoginPage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Suspense"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoginPageInner, {}, void 0, false, {
            fileName: "[project]/src/app/(auth)/login/page.tsx",
            lineNumber: 314,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/app/(auth)/login/page.tsx",
        lineNumber: 313,
        columnNumber: 5
    }, this);
}
_c1 = LoginPage;
var _c, _c1;
__turbopack_context__.k.register(_c, "LoginPageInner");
__turbopack_context__.k.register(_c1, "LoginPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_0_pajsr._.js.map