// ============================================================================
// Sphere AI — API Client
// TypeScript port of api_service.dart
//
// Architecture (industry standard — same pattern as Plex, Figma, Slack):
//   The web app runs on any host (localhost, dysosphere.com, etc.) and calls
//   the user's SphereX server DIRECTLY cross-origin. Nginx on the SphereX
//   appliance has full CORS headers enabled for this exact pattern.
//
//   Flow:
//     1. Gateway (static site) authenticates → stores serverUrl + token
//     2. This client reads serverUrl → calls https://<server>/api/ai/<path>
//     3. Nginx strips /api/ai/ → forwards to AI FastAPI on :8001
//
//   This eliminates the need for a local BFF proxy. The server URL is
//   per-user (each user has their own SphereX appliance), so a fixed
//   proxy target doesn't work — direct calls are the correct pattern.
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
      throw new ApiClientError("Session expired. Please sign in again.", 401);
    }

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || response.statusText;
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
    try {
      const token = this.getToken();
      if (!token) return false;

      const url = this.resolveUrl("/api/auth/refresh");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: AuthResponse = await response.json();
        this.setToken(data.access_token);
        return true;
      }
    } catch {
      // Refresh failed
    }
    return false;
  }

  // ── Auth Endpoints ──────────────────────────────────────────────────

  async login(username: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.access_token);
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
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/api/auth/logout", { method: "POST" });
    } finally {
      this.setToken(null);
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
      }>;
    }>(`/api/history/${sessionId}`);

    return {
      session_id: raw.session_id,
      title: raw.title,
      messages: (raw.messages || []).map((m) => ({
        role: m.role as Message["role"],
        content: m.content || "",
        created_at: m.timestamp || new Date().toISOString(),
        steps: (m.metadata?.steps as string[]) || [],
        thinking_duration_sec: (m.metadata?.thinking_duration_sec as number) || 0,
        image_urls: m.images || [],
        attachments: [],
        nas_files: [],
        name: m.name || undefined, // Tool name for tool_use messages
      })),
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

  // ── Streaming ───────────────────────────────────────────────────────

  async *streamMessage(
    message: string,
    sessionId?: string,
    options?: {
      agent?: string;
      model?: string;
      images?: string[];
      isTemporary?: boolean;
      description?: string;
    }
  ): AsyncGenerator<StreamEvent> {
    const token = this.getToken();
    const url = this.resolveUrl("/api/agents/stream");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        agent: options?.agent,
        model: options?.model,
        images: options?.images,
        is_temporary: options?.isTemporary,
        description: options?.description,
      }),
    });

    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
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

  // ── Health Check ────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      await this.request("/api/health");
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const apiClient = new ApiClient();

export { ApiClientError };
export default ApiClient;
