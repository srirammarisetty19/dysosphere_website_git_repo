// ============================================================================
// SphereX NAS — API Client
// TypeScript port of Flutter api_service.dart
//
// Architecture:
//   Shares the same serverUrl + JWT token as the AI client.
//   Routes to /api/nas/* instead of /api/ai/*.
//   For local dev: BFF proxy maps /api/nas-files/* → /api/nas/files/*
//   For production: direct cross-origin calls to {server}/api/nas/*
// ============================================================================

import type {
  DirectoryListing,
  FileItem,
  DirectoryItem,
  PersonCluster,
  ClusterPhotosResponse,
  NasNotification,
  StorageStats,
  ShareItem,
  ItemAccess,
  TrashItem,
  SyncFolder,
  SyncFolderStatus,
  SyncDirection,
  SyncDeletePolicy,
} from "./nas-types";
import { apiClient } from "./api-client";

class NasApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NasApiClientError";
    this.status = status;
  }
}

class NasApiClient {
  // ── Shared Auth ─────────────────────────────────────────────────────
  // Token and serverUrl are read from the shared auth-store (same JWT).
  // They are set via setToken/setServerUrl called by the auth store on
  // hydration, login, and account switching.

  private token: string | null = null;
  private serverUrl: string | null = null;

  setToken(t: string | null) {
    this.token = t;
  }
  setServerUrl(url: string | null) {
    this.serverUrl = url ? url.replace(/\/+$/, "") : null;
  }
  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      return localStorage.getItem("sphere_token");
    }
    return null;
  }
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

  // ── URL Resolution ──────────────────────────────────────────────────
  // Production: {server}/api/nas/files/list
  // Dev BFF:    /api/nas-files/list (proxy rewrites to /api/nas/files/list)

  private resolveUrl(path: string): string {
    const server = this.getServerUrl();
    if (!server) return path; // BFF proxy fallback

    // path comes in as "/api/nas-files/list"
    // → strip /api/ → "nas-files/list"
    // → rewrite "nas-files" → "api/nas/files"
    const stripped = path.replace(/^\/api\//, "");
    const segments = stripped.split("/");
    const prefix = segments[0]; // "nas-files"
    const rest = segments.slice(1).join("/");

    // Map BFF prefix to actual server path
    const NAS_ROUTE_MAP: Record<string, string> = {
      "nas-auth": "api/nas/auth",
      "nas-files": "api/nas/files",
      "nas-share": "api/nas/share",
      "nas-notifications": "api/nas/notifications",
      "nas-people": "api/nas/people",
      "nas-health": "api/nas/health",
      "nas-sync": "api/nas/sync",
      "nas-thumb": "api/nas/files/thumbnail",
      "nas-face-thumb": "api/nas/people/face-thumbnail",
    };

    const mapped = NAS_ROUTE_MAP[prefix] || prefix;
    const serverPath = rest ? `${mapped}/${rest}` : mapped;
    return `${server}/${serverPath}`;
  }

  // ── Core Fetch ──────────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const url = this.resolveUrl(path);

    const response = await fetch(url, { ...options, headers });

    // ── 401 Handling — delegate to AI client's centralized refresh ────
    // The AI client owns the token lifecycle (refresh, rotation, cross-tab
    // sync, force-logout). On 401 we ask it to refresh, then retry once.
    if (response.status === 401) {
      const refreshed = await apiClient.tryRefreshToken();
      if (refreshed) {
        // AI client refreshed the token — sync it to our instance
        this.token = apiClient.getToken();
        headers["Authorization"] = `Bearer ${this.token}`;
        const retryResponse = await fetch(url, { ...options, headers });
        if (!retryResponse.ok) {
          let message = `Server error (${retryResponse.status})`;
          try {
            const data = await retryResponse.json();
            if (typeof data.detail === "string") message = data.detail;
            else if (data.message) message = data.message;
          } catch { /* non-JSON */ }
          throw new NasApiClientError(message, retryResponse.status);
        }
        const ct = retryResponse.headers.get("content-type") || "";
        if (ct.includes("application/json")) return retryResponse.json();
        return retryResponse.text() as unknown as T;
      }
      // Refresh failed — session is dead, force logout
      apiClient.forceLogout();
      throw new NasApiClientError("Session expired. Please sign in again.", 401);
    }

    if (!response.ok) {
      let message = `Server error (${response.status})`;
      try {
        const data = await response.json();
        const detail = data.detail;
        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          // FastAPI 422 validation error: detail is [{loc, msg, type}]
          const msg = detail[0]?.msg ?? "Validation error";
          message = msg.replace(/^Value error,\s*/i, "");
        } else {
          message = data.message ?? message;
        }
      } catch {
        // non-JSON error
      }
      throw new NasApiClientError(message, response.status);
    }

    // Debug logging for search-related requests
    if (path.includes('/search')) {
      console.log('[NAS API] Request OK:', path, '→', response.status);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text() as unknown as T;
  }

  // ── Auth (same DB, different endpoint path) ─────────────────────────

  async login(
    username: string,
    password: string
  ): Promise<{
    token: string;
    refresh_token: string;
    user: { id: string; username: string; email: string; theme?: string };
  }> {
    return this.request("/api/nas-auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<{ message: string; user_id: string; username: string }> {
    return this.request("/api/nas-auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request("/api/nas-auth/logout", { method: "POST" });
  }

  async getProfile(): Promise<Record<string, unknown>> {
    return this.request("/api/nas-auth/profile");
  }

  async updateProfile(data: Record<string, unknown>): Promise<void> {
    await this.request("/api/nas-auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ── File Management ─────────────────────────────────────────────────

  async listFiles(
    directoryId?: string | null,
    limit = 200,
    offset = 0
  ): Promise<DirectoryListing> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (directoryId) params.set("directory_id", directoryId);
    return this.request(`/api/nas-files/list?${params}`);
  }

  async createDirectory(
    name: string,
    parentId?: string
  ): Promise<DirectoryItem> {
    const formData = new FormData();
    formData.append("directory_name", name);
    if (parentId) formData.append("parent_id", parentId);
    return this.request("/api/nas-files/directories", {
      method: "POST",
      body: formData,
    });
  }

  async uploadFile(
    file: File,
    directoryId?: string | null,
    onProgress?: (loaded: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<unknown> {
    // directory_id is required by the server (Form(...))
    // If null (root), we must resolve it first
    let resolvedDirId = directoryId;
    if (!resolvedDirId) {
      // Fetch root directory ID
      const listing = await this.listFiles(null, 1, 0);
      resolvedDirId = listing.directory.id;
    }

    const formData = new FormData();
    formData.append("directory_id", resolvedDirId);
    formData.append("files", file);

    // Use XMLHttpRequest for progress tracking (fetch doesn't support upload progress)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = this.resolveUrl("/api/nas-files/upload");

      xhr.open("POST", url);

      const token = this.getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      if (signal) {
        signal.addEventListener("abort", () => xhr.abort());
      }

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded, e.total);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(
            new NasApiClientError(
              `Upload failed (${xhr.status})`,
              xhr.status
            )
          );
        }
      });

      xhr.addEventListener("error", () =>
        reject(new NasApiClientError("Upload network error", 0))
      );
      xhr.addEventListener("abort", () =>
        reject(new NasApiClientError("Upload cancelled", 0))
      );

      xhr.send(formData);
    });
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const url = this.resolveUrl(`/api/nas-files/download?file_id=${fileId}`);
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new NasApiClientError(`Download failed (${response.status})`, response.status);
    }
    return response.blob();
  }

  async searchFiles(
    query: string
  ): Promise<Array<Record<string, unknown>>> {
    // Server returns FileSearchResponse { files, directories, total_results }
    // — flatten into a single array for consumer compatibility
    const data = await this.request<{
      files: Array<Record<string, unknown>>;
      directories: Array<Record<string, unknown>>;
      total_results: number;
    }>(`/api/nas-files/search?q=${encodeURIComponent(query)}`);
    return [...(data.directories || []), ...(data.files || [])];
  }

  async searchSemantic(
    query: string
  ): Promise<{ media?: FileItem[]; documents?: FileItem[] }> {
    const url = this.resolveUrl(`/api/nas-files/search/semantic?q=${encodeURIComponent(query)}`);
    console.log('[NAS API] searchSemantic → URL:', url);
    return this.request(
      `/api/nas-files/search/semantic?q=${encodeURIComponent(query)}`
    );
  }

  async getRecentFiles(): Promise<FileItem[]> {
    return this.request("/api/nas-files/recent");
  }

  async getRecentUploads(): Promise<FileItem[]> {
    return this.request("/api/nas-files/uploads");
  }

  async getStorageStats(): Promise<StorageStats> {
    return this.request("/api/nas-files/stats");
  }

  async moveOrRename(
    sourcePath: string,
    destinationPath: string,
    newName?: string
  ): Promise<void> {
    const body: Record<string, string> = {
      source_path: sourcePath,
      destination_path: destinationPath,
    };
    if (newName) body.new_name = newName;
    await this.request("/api/nas-files/move", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async copyItem(itemId: string, isFile: boolean): Promise<void> {
    const formData = new FormData();
    formData.append("item_id", itemId);
    formData.append("item_type", isFile ? "file" : "directory");
    await this.request("/api/nas-files/copy", {
      method: "POST",
      body: formData,
    });
  }

  async updateDirectoryPrefs(
    directoryId: string,
    prefs: { color?: string; view_type?: string; sort_order?: string }
  ): Promise<void> {
    await this.request(`/api/nas-files/directories/${directoryId}`, {
      method: "PUT",
      body: JSON.stringify(prefs),
    });
  }

  // ── Thumbnails (Google Drive pattern — server-side auth injection) ──

  thumbnailUrl(fileId: string): string {
    const server = this.getServerUrl();
    if (server) {
      return `${server}/api/nas/files/thumbnail/${fileId}`;
    }
    return `/api/nas-thumb/${fileId}`;
  }

  faceThumbnailUrl(fileId: string, size = 128): string {
    const server = this.getServerUrl();
    if (server) {
      return `${server}/api/nas/people/face-thumbnail/${fileId}?size=${size}`;
    }
    return `/api/nas-face-thumb/${fileId}?size=${size}`;
  }

  /** Auth header for <img> requests (same-origin via BFF) */
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Star ─────────────────────────────────────────────────────────────

  async starFile(fileId: string, isStarred: boolean): Promise<void> {
    await this.request(`/api/nas-files/files/${fileId}/star`, {
      method: "PUT",
      body: JSON.stringify({ is_starred: isStarred }),
    });
  }

  async starDirectory(
    directoryId: string,
    isStarred: boolean
  ): Promise<void> {
    await this.request(`/api/nas-files/directories/${directoryId}/star`, {
      method: "PUT",
      body: JSON.stringify({ is_starred: isStarred }),
    });
  }

  async listStarred(): Promise<Array<Record<string, unknown>>> {
    return this.request("/api/nas-files/starred");
  }

  // ── Trash ───────────────────────────────────────────────────────────

  async moveToTrash(itemIds: string[]): Promise<void> {
    const formData = new FormData();
    for (const id of itemIds) {
      formData.append("trash_ids", id);
    }
    await this.request("/api/nas-files/trash", {
      method: "POST",
      body: formData,
    });
  }

  async listTrash(): Promise<{ items: TrashItem[] }> {
    return this.request("/api/nas-files/trash");
  }

  async restoreFromTrash(itemIds: string[]): Promise<void> {
    const formData = new FormData();
    for (const id of itemIds) {
      formData.append("restore_ids", id);
    }
    await this.request("/api/nas-files/restore", {
      method: "POST",
      body: formData,
    });
  }

  async permanentDelete(itemId: string): Promise<void> {
    const formData = new FormData();
    formData.append("permanent_delete_id", itemId);
    await this.request("/api/nas-files/trash/permanent", {
      method: "DELETE",
      body: formData,
    });
  }

  async emptyTrash(): Promise<void> {
    await this.request("/api/nas-files/trash/empty", { method: "DELETE" });
  }

  // ── Sharing ─────────────────────────────────────────────────────────

  async shareItem(
    email: string,
    itemId: string,
    itemType: string,
    permission: string
  ): Promise<void> {
    await this.request("/api/nas-share/add", {
      method: "POST",
      body: JSON.stringify({
        email,
        item_id: itemId,
        item_type: itemType,
        permission,
      }),
    });
  }

  async listShared(): Promise<{
    shared_with_me: ShareItem[];
    shared_by_me: ShareItem[];
  }> {
    return this.request("/api/nas-share/list");
  }

  async getItemAccess(
    itemId: string,
    itemType: string
  ): Promise<ItemAccess> {
    return this.request(`/api/nas-share/access/${itemType}/${itemId}`);
  }

  async updateSharePermission(
    userId: string,
    itemId: string,
    itemType: string,
    permission: string
  ): Promise<void> {
    await this.request("/api/nas-share/permission", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        permission,
      }),
    });
  }

  async removeShare(shareId: string): Promise<void> {
    await this.request(`/api/nas-share/${shareId}`, { method: "DELETE" });
  }

  async revokeAccess(itemId: string, isFile: boolean): Promise<void> {
    const type = isFile ? "file" : "directory";
    await this.request(`/api/nas-share/revoke/${type}/${itemId}`, {
      method: "DELETE",
    });
  }

  // ── Notifications ───────────────────────────────────────────────────

  async getNotifications(limit = 100): Promise<NasNotification[]> {
    const data = await this.request<unknown>(
      `/api/nas-notifications/?limit=${limit}`
    );
    // Server may return list or { notifications, unread_count }
    if (Array.isArray(data)) return data as NasNotification[];
    return (
      (data as Record<string, unknown>).notifications as NasNotification[]
    ) || [];
  }

  async getUnreadCount(): Promise<number> {
    const data = await this.request<{ count: number }>(
      "/api/nas-notifications/unread-count"
    );
    return data.count;
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/api/nas-notifications/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_read: true }),
    });
  }

  async markAllRead(): Promise<void> {
    await this.request("/api/nas-notifications/read-all", { method: "PUT" });
  }

  async deleteNotification(id: string): Promise<void> {
    await this.request(`/api/nas-notifications/${id}`, { method: "DELETE" });
  }

  async clearAllNotifications(): Promise<void> {
    await this.request("/api/nas-notifications/clear-all", {
      method: "DELETE",
    });
  }

  // ── People / Face Clusters ──────────────────────────────────────────

  async getClusters(): Promise<PersonCluster[]> {
    const data = await this.request<{
      clusters: PersonCluster[];
      unclustered_count?: number;
    }>("/api/nas-people/clusters");
    return data.clusters || [];
  }

  /** Returns full clusters response including unclustered_count */
  async getClustersWithMeta(): Promise<{
    clusters: PersonCluster[];
    unclustered_count: number;
  }> {
    return this.request("/api/nas-people/clusters");
  }

  async getClusterPhotos(
    clusterId: string,
    limit = 50,
    offset = 0
  ): Promise<ClusterPhotosResponse> {
    return this.request(
      `/api/nas-people/clusters/${clusterId}?limit=${limit}&offset=${offset}`
    );
  }

  async labelCluster(
    clusterId: string,
    label: string
  ): Promise<void> {
    await this.request(`/api/nas-people/clusters/${clusterId}/label`, {
      method: "PUT",
      body: JSON.stringify({ label }),
    });
  }

  async mergeClusters(
    targetClusterId: string,
    sourceClusterId: string
  ): Promise<Record<string, unknown>> {
    return this.request(
      `/api/nas-people/clusters/${targetClusterId}/merge`,
      {
        method: "POST",
        body: JSON.stringify({ source_cluster_id: sourceClusterId }),
      }
    );
  }

  async triggerRecluster(): Promise<Record<string, unknown>> {
    return this.request("/api/nas-people/recluster", { method: "POST" });
  }

  async hideCluster(clusterId: string): Promise<void> {
    await this.request(`/api/nas-people/clusters/${clusterId}/hide`, {
      method: "POST",
    });
  }

  async unhideCluster(clusterId: string): Promise<void> {
    await this.request(`/api/nas-people/clusters/${clusterId}/unhide`, {
      method: "POST",
    });
  }

  // ── Unclustered Faces ("Others" Section) ────────────────────────────

  async getUnclusteredFaces(
    limit = 30,
    offset = 0
  ): Promise<{ faces: Record<string, unknown>[]; total: number }> {
    return this.request(
      `/api/nas-people/clusters/unclustered?limit=${limit}&offset=${offset}`
    );
  }

  async assignFaceToCluster(
    fileId: string,
    clusterId: string
  ): Promise<Record<string, unknown>> {
    return this.request("/api/nas-people/clusters/assign", {
      method: "POST",
      body: JSON.stringify({ file_id: fileId, cluster_id: clusterId }),
    });
  }

  // ── Cluster Split ──────────────────────────────────────────────────

  async splitCluster(
    clusterId: string,
    fileIds: string[]
  ): Promise<Record<string, unknown>> {
    return this.request(`/api/nas-people/clusters/${clusterId}/split`, {
      method: "POST",
      body: JSON.stringify({ file_ids: fileIds }),
    });
  }

  // ── Merge Suggestions ──────────────────────────────────────────────

  async getMergeSuggestions(): Promise<{
    suggestions: Array<{
      cluster_a: string;
      cluster_b: string;
      similarity: number;
      cluster_a_label: string;
      cluster_b_label: string;
    }>;
    total: number;
  }> {
    return this.request("/api/nas-people/suggestions");
  }

  async acceptSuggestion(
    clusterA: string,
    clusterB: string
  ): Promise<Record<string, unknown>> {
    return this.request("/api/nas-people/suggestions/accept", {
      method: "POST",
      body: JSON.stringify({ cluster_a: clusterA, cluster_b: clusterB }),
    });
  }

  async rejectSuggestion(
    clusterA: string,
    clusterB: string
  ): Promise<Record<string, unknown>> {
    return this.request("/api/nas-people/suggestions/reject", {
      method: "POST",
      body: JSON.stringify({ cluster_a: clusterA, cluster_b: clusterB }),
    });
  }

  // ── Folder Sync ────────────────────────────────────────────────

  async listSyncFolders(deviceId?: string): Promise<{ sync_folders: SyncFolder[]; count: number }> {
    const params = new URLSearchParams();
    if (deviceId) params.set("device_id", deviceId);
    const qs = params.toString();
    return this.request(`/api/nas-sync/folders${qs ? `?${qs}` : ""}`);
  }

  async updateSyncFolder(
    folderId: string,
    settings: {
      sync_enabled?: boolean;
      sync_direction?: SyncDirection;
      wifi_only?: boolean;
      sync_frequency?: string;
      delete_policy?: SyncDeletePolicy;
    }
  ): Promise<void> {
    const formData = new FormData();
    if (settings.sync_enabled !== undefined)
      formData.append("sync_enabled", String(settings.sync_enabled));
    if (settings.sync_direction)
      formData.append("sync_direction", settings.sync_direction);
    if (settings.wifi_only !== undefined)
      formData.append("wifi_only", String(settings.wifi_only));
    if (settings.sync_frequency)
      formData.append("sync_frequency", settings.sync_frequency);
    if (settings.delete_policy)
      formData.append("delete_policy", settings.delete_policy);
    await this.request(`/api/nas-sync/folders/${folderId}`, {
      method: "PUT",
      body: formData,
    });
  }

  async deleteSyncFolder(folderId: string): Promise<void> {
    await this.request(`/api/nas-sync/folders/${folderId}`, {
      method: "DELETE",
    });
  }

  async getSyncStatus(deviceId?: string): Promise<{ folders: SyncFolderStatus[] }> {
    const params = new URLSearchParams();
    if (deviceId) params.set("device_id", deviceId);
    const qs = params.toString();
    return this.request(`/api/nas-sync/status${qs ? `?${qs}` : ""}`);
  }

  async getSyncChanges(
    cursor = 0,
    limit = 500,
    directoryId?: string,
    deviceId?: string
  ): Promise<{ changes: unknown[]; cursor: number; has_more: boolean; count: number }> {
    const params = new URLSearchParams({
      cursor: String(cursor),
      limit: String(limit),
    });
    if (directoryId) params.set("directory_id", directoryId);
    if (deviceId) params.set("device_id", deviceId);
    return this.request(`/api/nas-sync/changes?${params}`);
  }

  // ── Health ──────────────────────────────────────────────────────────

  async healthCheck(): Promise<{
    status: string;
    service: string;
    version: string;
  }> {
    return this.request("/api/nas-health");
  }
}

// Singleton instance
export const nasApiClient = new NasApiClient();
