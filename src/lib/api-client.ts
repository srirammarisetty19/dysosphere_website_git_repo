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

import type {
  AuthResponse,
  User,
  Conversation,
  Message,
  Session,
  AgentMetadata,
  Heartbeat,
  GpuStatus,
  UploadResult,
  StreamEvent,
} from "./types";

class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

// ── Route Mapping ──────────────────────────────────────────────────────
// Maps logical API namespaces to actual AI server path prefixes.
// Nginx strips /api/ai/ and forwards to the AI backend.
// Example: /api/auth/login → resolveUrl → {server}/api/ai/users/login
const ROUTE_MAP: Record<string, string> = {
  auth: "users",         // /api/auth/login → /users/login
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
  scheduler: "scheduler",
};

class ApiClient {
  private token: string | null = null;
  private serverUrl: string | null = null;
  private refreshToken_: string | null = null;

  // ── Force Logout Callback ────────────────────────────────────────────
  // Registered by the auth store. Invoked when auth is irrecoverably dead
  // (401 after refresh failure). Clears Zustand state and redirects.
  private forceLogoutCallback: (() => void) | null = null;

  // ── Cross-Tab Token Sync (Google BroadcastChannel pattern) ───────────
  // When one tab refreshes the token, all other tabs receive the new
  // access + refresh tokens via BroadcastChannel. This prevents the
  // "refresh token rotation race" where Tab B uses a revoked refresh
  // token because Tab A already rotated it.
  private tokenChannel: BroadcastChannel | null = null;

  // ── Proactive Token Refresh (Google-style) ───────────────────────────
  // Uses a 60-second interval instead of a single long setTimeout.
  // Browsers throttle/suspend timers in background tabs, making long
  // setTimeout unreliable (it may fire hours late). A short interval
  // that checks "is token expiring soon?" is immune to this.
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  // Guard to prevent concurrent refresh attempts across handlers
  private isRefreshing = false;

  // ── Server URL Management ───────────────────────────────────────────

  /**
   * Set the target SphereX server URL.
   * Called by the auth store on hydration, login, and account switching.
   */
  setServerUrl(url: string | null) {
    this.serverUrl = url ? url.replace(/\/+$/, "") : null;
  }

  /**
   * Get the current server URL. Falls back to localStorage.
   */
  getServerUrl(): string | null {
    if (this.serverUrl) return this.serverUrl;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("spherex_server");
      if (stored) {
        this.serverUrl = stored.replace(/\/+$/, "");
        return this.serverUrl;
      }
    }
    return null;
  }

  // ── Token Management ────────────────────────────────────────────────

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      if (typeof window !== "undefined") {
        localStorage.setItem("sphere_token", token);
      }
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sphere_token");
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      return localStorage.getItem("sphere_token");
    }
    return null;
  }

  // ── Refresh Token Management ────────────────────────────────────────

  setRefreshToken(token: string | null) {
    this.refreshToken_ = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("sphere_refresh_token", token);
      } else {
        localStorage.removeItem("sphere_refresh_token");
      }
    }
  }

  getRefreshToken(): string | null {
    if (this.refreshToken_) return this.refreshToken_;
    if (typeof window !== "undefined") {
      return localStorage.getItem("sphere_refresh_token");
    }
    return null;
  }

  // ── Force Logout Registration ────────────────────────────────────────
  // Called by the auth store during hydration to wire up the
  // "unrecoverable 401 → clear state → redirect" circuit.
  registerForceLogout(callback: () => void): void {
    this.forceLogoutCallback = callback;
  }

  // ── BroadcastChannel: Cross-Tab Token Sync (Google pattern) ──────────
  // Google Workspace apps use BroadcastChannel to synchronize auth state
  // across all open tabs. When one tab refreshes tokens, it broadcasts
  // the new pair so other tabs don't race with the (now-revoked) old
  // refresh token.

  initTokenBroadcast(): void {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    if (this.tokenChannel) return; // Already initialized

    this.tokenChannel = new BroadcastChannel("sphere-auth-sync");
    this.tokenChannel.onmessage = (event) => {
      const { type, accessToken, refreshToken: rt } = event.data || {};

      if (type === "token-refresh" && accessToken) {
        // Another tab refreshed — adopt the new tokens silently
        this.token = accessToken;
        if (typeof window !== "undefined") {
          localStorage.setItem("sphere_token", accessToken);
        }
        if (rt) {
          this.refreshToken_ = rt;
          if (typeof window !== "undefined") {
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

  private broadcastTokenRefresh(accessToken: string, refreshToken: string | null): void {
    try {
      this.tokenChannel?.postMessage({
        type: "token-refresh",
        accessToken,
        refreshToken,
      });
    } catch {
      // BroadcastChannel closed or unavailable — non-critical
    }
  }

  private broadcastForceLogout(): void {
    try {
      this.tokenChannel?.postMessage({ type: "force-logout" });
    } catch {
      // Non-critical
    }
  }

  // ── JWT Expiry Helpers ───────────────────────────────────────────────

  /**
   * Decode the `exp` claim from a JWT without verifying the signature.
   * Returns the expiry as a Unix timestamp (seconds), or null if unparseable.
   */
  private parseTokenExpiry(token: string): number | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      // base64url → base64 → JSON
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const json = JSON.parse(atob(payload));
      return typeof json.exp === "number" ? json.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Returns true if the current token is expired (or expires within the
   * next `bufferSec` seconds). Used for pre-flight checks before SSE streams.
   */
  isTokenExpiredOrExpiringSoon(bufferSec = 30): boolean {
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
   */
  scheduleTokenRefresh(): void {
    if (typeof window === "undefined") return;

    // Cancel any existing timer
    this.cancelTokenRefreshTimer();

    const token = this.getToken();
    if (!token) return;

    // ── Interval: check every 60s if token needs refresh ────────────────
    this.refreshTimer = setInterval(async () => {
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
      this.visibilityHandler = async () => {
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
   */
  cancelTokenRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.visibilityHandler && typeof window !== "undefined") {
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

  private resolveUrl(path: string): string {
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
   */
  resolveFileUrl(path: string): string {
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

  private extractErrorMessage(
    errorData: Record<string, unknown>,
    fallback: string
  ): string {
    const detail = errorData.detail;

    // Case 1: detail is a plain string (most common for HTTPException)
    if (typeof detail === "string") {
      return detail;
    }

    // Case 2: detail is an array of validation errors (FastAPI 422)
    if (Array.isArray(detail) && detail.length > 0) {
      // Extract msg from each error, strip "Value error, " prefix, join with ". "
      const messages = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String(item.msg).replace(/^Value error,\s*/i, "");
          }
          return null;
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(". ");
      return "Validation error";
    }

    // Case 3: detail is a single object with msg (edge case)
    if (detail && typeof detail === "object" && "msg" in (detail as Record<string, unknown>)) {
      return String((detail as Record<string, unknown>).msg).replace(
        /^Value error,\s*/i,
        ""
      );
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

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
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
      headers,
    });

    if (response.status === 401) {
      // Try token refresh
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.getToken()}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });
        if (!retryResponse.ok) {
          throw new ApiClientError(
            await retryResponse.text(),
            retryResponse.status
          );
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
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = this.extractErrorMessage(errorData, response.statusText);
      } catch {
        errorMessage = response.statusText;
      }
      throw new ApiClientError(errorMessage, response.status);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private async tryRefreshToken(): Promise<boolean> {
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshTok }),
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
    } catch {
      // Refresh failed — network error or server down
    } finally {
      this.isRefreshing = false;
    }
    return false;
  }

  /**
   * Sync refreshed tokens back to the Zustand auth store so they persist
   * in localStorage via the `persist` middleware. Without this, a page
   * reload after a silent refresh would revert to the old (revoked) tokens.
   */
  private syncRefreshTokenToStore(accessToken: string, refreshToken: string | null): void {
    // Dynamically import to avoid circular dependency at module level.
    // This is the standard pattern for singletons that need store access.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useAuthStore } = require("@/stores/auth-store");
      const state = useAuthStore.getState();
      if (state.activeAccount) {
        useAuthStore.setState({
          activeAccount: {
            ...state.activeAccount,
            token: accessToken,
            refreshToken: refreshToken || undefined,
          },
          // Also update the account in the accounts list
          accounts: state.accounts.map((a: { id: string; token: string; refreshToken?: string }) =>
            a.id === state.activeAccount!.id
              ? { ...a, token: accessToken, refreshToken: refreshToken || undefined }
              : a
          ),
        });
      }
    } catch {
      // Store not available (SSR) — non-critical
    }
  }

  // ── Auth Endpoints ──────────────────────────────────────────────────

  async login(username: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.access_token);
    this.setRefreshToken(data.refresh_token || null);
    return data;
  }

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    this.setToken(data.access_token);
    this.setRefreshToken(data.refresh_token || null);
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } finally {
      this.setToken(null);
      this.setRefreshToken(null);
    }
  }

  // ── User Endpoints ──────────────────────────────────────────────────

  async getProfile(): Promise<User> {
    return this.request<User>("/api/users/me");
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>("/api/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.request("/api/users/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  async deleteAccount(): Promise<void> {
    await this.request("/api/users/me", { method: "DELETE" });
    this.setToken(null);
  }

  // ── Chat / History ──────────────────────────────────────────────────
  // Server returns session_id (not id) and timestamp (not created_at).
  // We normalize here so the rest of the app uses a consistent Conversation shape.

  async getConversations(
    limit = 50,
    page = 1
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const raw = await this.request<{
      conversations: Array<{
        session_id: string;
        title: string;
        created_at: string;
        updated_at: string;
        message_count: number;
        last_message_preview: string;
        metadata?: Record<string, unknown>;
      }>;
      total: number;
    }>(`/api/history?limit=${limit}&page=${page}`);

    return {
      conversations: (raw.conversations || []).map((c) => ({
        id: c.session_id,
        title: c.title,
        created_at: c.updated_at || c.created_at,
        message_count: c.message_count,
        last_message_preview: c.last_message_preview,
        metadata: c.metadata as Conversation["metadata"],
      })),
      total: raw.total,
    };
  }

  async getConversation(
    sessionId: string
  ): Promise<{ session_id: string; title: string; messages: Message[] }> {
    const raw = await this.request<{
      session_id: string;
      title: string;
      messages: Array<{
        role: string;
        content: string;
        timestamp: string;
        name?: string;
        metadata?: Record<string, unknown>;
        images?: string[];
        parts?: Array<{ type: string; content?: string; file_url?: string; filename?: string; mime_type?: string }>;
      }>;
    }>(`/api/history/${sessionId}`);

    return {
      session_id: raw.session_id,
      title: raw.title,
      messages: (raw.messages || []).map((m) => {
        const parts = m.parts || (m.metadata?.parts as typeof m.parts) || [];
        // Extract image URLs from parts (preferred) or flat images (legacy)
        const imageUrls = parts.length > 0
          ? parts.filter((p) => p.type === "image" && p.file_url).map((p) => p.file_url!)
          : m.images || [];
        return {
          role: m.role as Message["role"],
          content: m.content || "",
          created_at: m.timestamp || new Date().toISOString(),
          steps: (m.metadata?.steps as string[]) || [],
          thinking_duration_sec: (m.metadata?.thinking_duration_sec as number) || 0,
          image_urls: imageUrls,
          attachments: [],
          nas_files: [],
          parts: parts,
          name: m.name || undefined,
        };
      }),
    };
  }

  async deleteConversation(sessionId: string): Promise<void> {
    await this.request(`/api/history/${sessionId}`, { method: "DELETE" });
  }

  async searchHistory(
    query: string,
    limit = 20
  ): Promise<{ results: Array<{ session_id: string; session_title: string; content_snippet: string }> }> {
    return this.request(
      `/api/history/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  // ── Sessions ────────────────────────────────────────────────────────

  async createSession(title?: string): Promise<Session> {
    return this.request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  async getSessions(): Promise<Session[]> {
    const data = await this.request<{ sessions: Session[] }>("/api/sessions");
    return data.sessions;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/api/sessions/${sessionId}`, { method: "DELETE" });
  }

  // Note: Server-side session rename is not supported (no PATCH endpoint).
  // The title is auto-generated from the first message by the AI backend.
  // This method is a no-op to prevent 405 errors.
  async renameSession(_sessionId: string, _title: string): Promise<void> {
    // Server does not support session rename — title is auto-set from first message
  }

  /**
   * Cancel an active agent run on a session (v2 — registry-based).
   * Signals the engine to stop via cancel_event and persists partial results.
   */
  async cancelAgentRun(sessionId: string): Promise<void> {
    try {
      await this.request(`/api/sessions/${sessionId}/cancel`, {
        method: "POST",
      });
    } catch {
      // Non-critical — silent failure (run may have already completed)
    }
  }

  // ── Agents ──────────────────────────────────────────────────────────

  async getAgents(): Promise<AgentMetadata[]> {
    const data = await this.request<{ agents: AgentMetadata[] }>("/api/agents");
    return data.agents;
  }

  async getAvailableTools(): Promise<Array<{ name: string; description: string }>> {
    return this.request("/api/agents/tools");
  }

  async getModels(): Promise<string[]> {
    const data = await this.request<{ models: string[] }>("/api/agents/models");
    return data.models;
  }

  // ── Run Status (Gemini-style auto-resume) ────────────────────────────

  /**
   * Check if a session has an active agent generation in progress.
   * Used by loadConversation to detect mid-generation state and auto-resume.
   */
  async getRunStatus(sessionId: string): Promise<{ status: string; has_active_run: boolean; session_id: string }> {
    try {
      return await this.request(`/api/sessions/${sessionId}/run-status`);
    } catch {
      return { status: "idle", has_active_run: false, session_id: sessionId };
    }
  }

  // ── Streaming ───────────────────────────────────────────────────────

  async *streamMessage(
    message: string,
    sessionId?: string,
    options?: {
      agent?: string;
      model?: string;
      images?: string[];
      file_parts?: Array<{ file_url: string; filename: string; media_type: string; mime_type?: string }>;
      isTemporary?: boolean;
      description?: string;
      signal?: AbortSignal;
    }
  ): AsyncGenerator<StreamEvent> {
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
      description: options?.description,
    });

    let response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      signal: options?.signal,
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
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
          signal: options?.signal,
        });
      }
    }

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = this.extractErrorMessage(errorData, response.statusText);
      } catch {
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") return;
            try {
              const event: StreamEvent = JSON.parse(data);
              yield event;
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ── File Upload ─────────────────────────────────────────────────────

  async uploadFile(file: File): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    return this.request<UploadResult>("/api/upload", {
      method: "POST",
      body: formData,
    });
  }

  // ── Heartbeats / Reminders ──────────────────────────────────────────

  async getHeartbeats(): Promise<Heartbeat[]> {
    const data = await this.request<{ heartbeats: Heartbeat[] }>("/api/heartbeats");
    return data.heartbeats;
  }

  async createHeartbeat(data: Partial<Heartbeat>): Promise<Heartbeat> {
    return this.request("/api/heartbeats", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateHeartbeat(id: string, data: Partial<Heartbeat>): Promise<void> {
    await this.request(`/api/heartbeats/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteHeartbeat(id: string): Promise<void> {
    await this.request(`/api/heartbeats/${id}`, { method: "DELETE" });
  }

  // ── GPU Heartbeat ───────────────────────────────────────────────────

  async sendGpuHeartbeat(state: string = "active"): Promise<void> {
    try {
      await this.request("/api/gpu/heartbeat", {
        method: "POST",
        body: JSON.stringify({ state }),
      });
    } catch {
      // Non-critical — silent failure
    }
  }

  async getGpuStatus(): Promise<GpuStatus> {
    return this.request("/api/gpu/status");
  }

  // ── Notifications ───────────────────────────────────────────────────

  async getNotifications(limit = 50): Promise<{ notifications: Array<{ id: string; title: string; body: string; read: boolean; created_at: string }>; unread_count: number }> {
    return this.request(`/api/notifications?limit=${limit}`);
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.request("/api/notifications/read-all", { method: "POST" });
  }

  // ── Calendar ─────────────────────────────────────────────────────────
  // Server: GET /calendar?range=month&after=YYYY-MM-DD&before=YYYY-MM-DD

  async getCalendarEvents(year: number, month: number): Promise<{ events: Array<{ id: string; title: string; description: string; start: string; end: string | null; category: string; all_day: boolean; recurring: boolean; location: string; source: string }>; count: number }> {
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    return this.request(`/api/calendar?range=custom&after=${firstDay}&before=${lastDayStr}&type=all&limit=100`);
  }

  // ── Heartbeat Results ───────────────────────────────────────────────

  async getHeartbeatResults(id: string, limit = 20): Promise<{ results: Array<{ id: string; content: string; created_at: string }> }> {
    return this.request(`/api/heartbeats/${id}/results?limit=${limit}`);
  }

  // ── Email Integration ──────────────────────────────────────────────
  // Server: /integrations/email/*

  async getEmailStatus(): Promise<{ configured: boolean; email: string; provider: string }> {
    return this.request("/api/integrations/email/status");
  }

  async setupEmail(email: string, appPassword: string, provider: string): Promise<void> {
    await this.request("/api/integrations/email/setup", {
      method: "POST",
      body: JSON.stringify({ email, app_password: appPassword, provider }),
    });
  }

  async testEmail(action = "list_inbox"): Promise<unknown> {
    return this.request("/api/integrations/email/test", {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  }

  async disconnectEmail(): Promise<void> {
    await this.request("/api/integrations/email/setup", { method: "DELETE" });
  }

  // ── Telegram Integration ───────────────────────────────────────────
  // Server: /integrations/telegram/*

  async getTelegramStatus(): Promise<{ configured: boolean; bot_username?: string; webhook_url?: string }> {
    try {
      return await this.request("/api/integrations/telegram/status");
    } catch {
      return { configured: false };
    }
  }

  async setupTelegram(botToken: string, allowedUsers: number[] = []): Promise<unknown> {
    return this.request("/api/integrations/telegram/setup", {
      method: "POST",
      body: JSON.stringify({
        bot_token: botToken,
        ...(allowedUsers.length > 0 ? { allowed_users: allowedUsers } : {}),
      }),
    });
  }

  async testTelegram(): Promise<unknown> {
    return this.request("/api/integrations/telegram/test", { method: "POST" });
  }

  async disconnectTelegram(): Promise<void> {
    await this.request("/api/integrations/telegram/setup", { method: "DELETE" });
  }

  // ── Notifications (extended) ────────────────────────────────────────

  async deleteNotification(id: string): Promise<void> {
    await this.request(`/api/notifications/${id}`, { method: "DELETE" });
  }

  async clearAllNotifications(): Promise<void> {
    await this.request("/api/notifications", { method: "DELETE" });
  }

  async getUnreadCount(): Promise<number> {
    try {
      const data = await this.request<{ unread_count: number }>("/api/notifications/unread");
      return data.unread_count;
    } catch {
      return 0;
    }
  }

  // ── Artifacts ─────────────────────────────────────────────────────────

  async getArtifacts(
    limit = 50,
    offset = 0,
    fileType?: string
  ): Promise<{
    total: number;
    files: Array<{
      id: string;
      name: string;
      url_path: string;
      file_type: string;
      mime_type: string | null;
      size_bytes: number | null;
      session_id: string | null;
      created_at: string | null;
      stored_path: string;
    }>;
  }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (fileType) params.set("file_type", fileType);
    return this.request(`/api/artifacts?${params}`);
  }

  async deleteArtifact(id: string): Promise<void> {
    await this.request(`/api/artifacts/${id}`, { method: "DELETE" });
  }

  /**
   * Build a full URL for an artifact file.
   * Uses the stored_path from the artifacts API.
   */
  getArtifactFileUrl(storedPath: string): string {
    const server = this.getServerUrl();
    if (!server) return `/files/${storedPath}`;
    return `${server}/api/ai/files/${storedPath}`;
  }

  // ── Authenticated File Fetch ──────────────────────────────────────────
  // <img> tags can't send Authorization headers. This fetches the file
  // with auth and returns a blob URL that can be used as img src.

  async fetchAuthenticatedBlob(storedPath: string): Promise<string> {
    const url = this.getArtifactFileUrl(storedPath);
    const token = this.getToken();
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
   */
  async fetchAuthenticatedFileBlob(filePath: string): Promise<string> {
    let url: string;

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
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new Error(`Failed to fetch file: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }

  // ── Health Check ────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/api/health");
      return true;
    } catch {
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

  private _notifWs: WebSocket | null = null;
  private _notifReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _notifPingTimer: ReturnType<typeof setInterval> | null = null;
  private _notifReconnectAttempt = 0;
  private _notifListeners: Set<(event: { type: string; [key: string]: unknown }) => void> = new Set();
  private _notifWsActive = false; // true when the user wants the WS open

  /**
   * Build the WebSocket URL using the current (freshest) token.
   * Always called at connection time so token refreshes propagate automatically.
   */
  private _buildNotifWsUrl(): string | null {
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
   */
  connectNotificationWebSocket(): void {
    if (typeof window === "undefined") return;
    this._notifWsActive = true;
    this._connectNotifWs();

    // Also reconnect when tab becomes visible (matches Slack behavior)
    if (!this._notifVisibilityHandler) {
      this._notifVisibilityHandler = () => {
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

  private _notifVisibilityHandler: (() => void) | null = null;

  /**
   * Disconnect the notification WebSocket cleanly.
   * Call on logout / clearAuth.
   */
  disconnectNotificationWebSocket(): void {
    this._notifWsActive = false;
    this._cleanupNotifWs();
  }

  /**
   * Register a listener for notification events.
   * Returns an unsubscribe function (React useEffect pattern).
   */
  onNotification(callback: (event: { type: string; [key: string]: unknown }) => void): () => void {
    this._notifListeners.add(callback);
    return () => { this._notifListeners.delete(callback); };
  }

  /**
   * Called after a token refresh succeeds. Reconnects the notification WS
   * with the new token so it doesn't get rejected with 403.
   * This is exactly what Google and Slack do: reconnect WS after token rotation.
   */
  reconnectNotificationWebSocketAfterRefresh(): void {
    if (!this._notifWsActive) return;
    // Close existing connection (will trigger reconnect with fresh token)
    if (this._notifWs) {
      this._notifWs.close(1000, "Token refreshed — reconnecting");
    }
    this._notifReconnectAttempt = 0;
    this._connectNotifWs();
  }

  private _connectNotifWs(): void {
    if (typeof window === "undefined" || !this._notifWsActive) return;

    // Cleanup any existing connection/timers
    this._cleanupNotifWs();

    const url = this._buildNotifWsUrl();
    if (!url) return;

    try {
      const ws = new WebSocket(url);
      this._notifWs = ws;

      ws.onopen = () => {
        console.log("[NotifWS] Connected");
        this._notifReconnectAttempt = 0;

        // Start heartbeat ping (exactly like Slack: ping every 25s)
        this._notifPingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25_000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Dispatch to all listeners
          for (const listener of this._notifListeners) {
            try { listener(data); } catch { /* listener error — non-critical */ }
          }
        } catch {
          // Malformed message — skip
        }
      };

      ws.onclose = (event) => {
        console.log(`[NotifWS] Closed: code=${event.code}, reason=${event.reason}`);
        this._clearNotifTimers();

        // Reconnect with exponential backoff (capped at 30s)
        if (this._notifWsActive && event.code !== 1000) {
          this._scheduleNotifReconnect();
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror — reconnect handled there
        console.log("[NotifWS] Connection error");
      };
    } catch {
      // WebSocket constructor failed — schedule reconnect
      this._scheduleNotifReconnect();
    }
  }

  private _scheduleNotifReconnect(): void {
    if (!this._notifWsActive) return;
    if (this._notifReconnectTimer) return; // Already scheduled

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delaySec = Math.min(30, Math.pow(2, this._notifReconnectAttempt));
    this._notifReconnectAttempt++;

    console.log(`[NotifWS] Reconnecting in ${delaySec}s (attempt ${this._notifReconnectAttempt})`);
    this._notifReconnectTimer = setTimeout(() => {
      this._notifReconnectTimer = null;
      this._connectNotifWs();
    }, delaySec * 1000);
  }

  private _clearNotifTimers(): void {
    if (this._notifPingTimer) {
      clearInterval(this._notifPingTimer);
      this._notifPingTimer = null;
    }
  }

  private _cleanupNotifWs(): void {
    this._clearNotifTimers();
    if (this._notifReconnectTimer) {
      clearTimeout(this._notifReconnectTimer);
      this._notifReconnectTimer = null;
    }
    if (this._notifWs) {
      this._notifWs.onclose = null; // Prevent reconnect loop
      this._notifWs.onerror = null;
      this._notifWs.onmessage = null;
      if (this._notifWs.readyState === WebSocket.OPEN ||
          this._notifWs.readyState === WebSocket.CONNECTING) {
        this._notifWs.close(1000, "Cleanup");
      }
      this._notifWs = null;
    }
  }
}

// Singleton instance
export const apiClient = new ApiClient();

export { ApiClientError };
export default ApiClient;
