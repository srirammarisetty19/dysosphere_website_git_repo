// ============================================================================
// SphereX NAS — TypeScript Type Definitions
// Mirrors Flutter models: FileItem, DirectoryItem, PersonCluster, etc.
// ============================================================================

// ── File & Directory Models ─────────────────────────────────────────────

export interface DirectoryItem {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
  size: number;
  color: string | null;
  view_type: string;    // "grid" | "list"
  sort_order: string;   // "name_asc" | "name_desc" | "date_asc" | "date_desc"
  is_starred: boolean;
  is_shared: boolean;
  permission: string;   // "owner" | "editor" | "viewer"
  created_at: string;
  updated_at: string;
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  directory_id: string;
  size: number;
  mime_type: string | null;
  is_starred: boolean;
  is_shared: boolean;
  permission: string;
  created_at: string;
  updated_at: string;
}

export interface DirectoryListing {
  directory: DirectoryItem;
  subdirectories: DirectoryItem[];
  files: FileItem[];
}

/** Union type for grid/list rendering */
export type DisplayItem =
  | { kind: "directory"; item: DirectoryItem }
  | { kind: "file"; item: FileItem };

// ── Person / Face Cluster ───────────────────────────────────────────────

export interface PersonCluster {
  cluster_id: string;
  label: string;
  face_count: number;
  representative_file_id: string | null;
  thumbnail_url: string | null;
}

export interface ClusterPhotosResponse {
  cluster_id: string;
  label: string;
  photos: FileItem[];
  total: number;
}

// ── Notifications ───────────────────────────────────────────────────────

export interface NasNotification {
  id: string;
  type: string;         // "share" | "alert" | "system" | "task_complete"
  title: string;
  message: string;
  is_read: boolean;
  action_url?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ── Sharing ─────────────────────────────────────────────────────────────

export interface ShareItem {
  id: string;
  item_id: string;
  item_type: string;    // "file" | "directory"
  item_name: string;
  owner_username: string;
  shared_with_username: string;
  permission: string;   // "viewer" | "editor"
  created_at: string;
}

export interface ItemAccess {
  owner: { id: string; username: string };
  shares: Array<{
    id: string;
    user_id: string;
    username: string;
    permission: string;
  }>;
}

// ── Trash ───────────────────────────────────────────────────────────────

export interface TrashItem {
  id: string;
  name: string;
  path: string;
  item_type: string;    // "file" | "directory"
  mime_type?: string;
  size?: number;
  trashed_at: string;
}

// ── Storage ─────────────────────────────────────────────────────────────

export interface StorageStats {
  used: number;
  limit: number;
  breakdown?: Array<{
    username: string;
    bytes: number;
  }>;
}

// ── Folder Sync ─────────────────────────────────────────────────────────

export type SyncDirection = "upload" | "download" | "bidirectional";
export type SyncDeviceType = "android" | "ios" | "macos" | "windows" | "linux";
export type SyncDeletePolicy = "propagate" | "keep_remote";

export interface SyncFolder {
  id: string;
  local_path: string;
  device_id: string;
  device_name: string | null;
  device_type: SyncDeviceType;
  directory_id: string;
  directory_name?: string;
  directory_path?: string;
  sync_enabled: boolean;
  sync_direction: SyncDirection;
  wifi_only: boolean;
  sync_frequency: string;       // "realtime" | "hourly" | "daily"
  delete_policy: SyncDeletePolicy;
  last_synced_at: string | null;
  last_cursor: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncFolderStatus {
  sync_folder_id: string;
  local_path: string;
  device_name: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  pending_changes: number;
  synced_files: number;
  status: "synced" | "pending" | "disabled";
}

// ── Sort / Filter Enums ─────────────────────────────────────────────────

export type SortBy = "name" | "date" | "size" | "type";
export type SortOrder = "asc" | "desc";
export type FileTypeFilter =
  | "all"
  | "folders"
  | "images"
  | "videos"
  | "audio"
  | "documents";

// ── Helpers ─────────────────────────────────────────────────────────────

/** Convert bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Get a display-friendly MIME type icon class */
export function getMimeIcon(
  mimeType: string | null
): { icon: string; color: string } {
  if (!mimeType) return { icon: "file", color: "#6B7280" };

  if (mimeType === "application/pdf")
    return { icon: "file-text", color: "#EF4444" };
  if (mimeType.startsWith("image/"))
    return { icon: "image", color: "#8B5CF6" };
  if (mimeType.startsWith("video/"))
    return { icon: "film", color: "#DC2626" };
  if (mimeType.startsWith("audio/"))
    return { icon: "music", color: "#F59E0B" };
  if (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv")
  )
    return { icon: "table", color: "#16A34A" };
  if (mimeType.includes("word") || mimeType.includes("document"))
    return { icon: "file-text", color: "#2563EB" };
  if (mimeType.includes("text"))
    return { icon: "file-code", color: "#64748B" };
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("rar")
  )
    return { icon: "archive", color: "#D97706" };

  return { icon: "file", color: "#6B7280" };
}

/** Check if a MIME type is previewable in-browser */
export function isPreviewable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  );
}

/** Match file type filter */
export function matchesFilter(
  item: DisplayItem,
  filter: FileTypeFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "folders") return item.kind === "directory";
  if (item.kind === "directory") return false;

  const mime = item.item.mime_type || "";
  switch (filter) {
    case "images":
      return mime.startsWith("image/");
    case "videos":
      return mime.startsWith("video/");
    case "audio":
      return mime.startsWith("audio/");
    case "documents":
      return (
        mime.includes("pdf") ||
        mime.includes("word") ||
        mime.includes("document") ||
        mime.includes("excel") ||
        mime.includes("spreadsheet") ||
        mime.includes("text") ||
        mime.includes("csv")
      );
    default:
      return true;
  }
}
