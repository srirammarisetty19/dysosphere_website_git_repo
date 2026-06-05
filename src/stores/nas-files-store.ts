// ============================================================================
// NAS Files Store — Zustand store for file browsing state
// Mirrors Flutter providers: directory_listing, current_directory, transfer
// ============================================================================

import { create } from "zustand";
import { nasApiClient } from "@/lib/nas-api-client";
import type {
  DirectoryItem,
  FileItem,
  DirectoryListing,
  DisplayItem,
  SortBy,
  SortOrder,
  FileTypeFilter,
} from "@/lib/nas-types";

interface UploadTask {
  id: string;
  file: File;
  progress: number; // 0–100
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

// Prefetch cache for hover-to-prefetch (Google Drive pattern)
const _prefetchCache = new Map<string, { data: DirectoryListing; ts: number }>();
const PREFETCH_TTL = 15_000; // 15s — stale after this

interface NasFilesState {
  // Directory browsing
  currentDirectoryId: string | null;
  breadcrumbs: Array<{ name: string; id: string | null }>;
  listing: DirectoryListing | null;
  isLoading: boolean;
  error: string | null;

  // Navigation direction for directional slide transitions
  // "forward" = right-to-left, "back" = left-to-right, "none" = no animation
  navigationDirection: "forward" | "back" | "none";

  // View preferences
  viewType: "grid" | "list";
  sortBy: SortBy;
  sortOrder: SortOrder;
  typeFilter: FileTypeFilter;
  typeFilters: Set<FileTypeFilter>;

  // Selection (multi-select like Google Drive)
  isSelecting: boolean;
  selectedIds: Set<string>;

  // Uploads
  uploads: UploadTask[];

  // Actions
  loadDirectory: (directoryId?: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  navigateToFolder: (folder: DirectoryItem) => void;
  navigateToFolderById: (id: string, name: string) => void;
  goBack: () => void;
  goToRoot: () => void;
  prefetchDirectory: (directoryId: string) => void;

  setViewType: (vt: "grid" | "list") => void;
  setSortBy: (sb: SortBy) => void;
  setSortOrder: (so: SortOrder) => void;
  setTypeFilter: (tf: FileTypeFilter) => void;
  toggleTypeFilter: (tf: FileTypeFilter) => void;
  clearTypeFilters: () => void;

  toggleSelection: (id: string) => void;
  selectAll: (items: DisplayItem[]) => void;
  clearSelection: () => void;
  setIsSelecting: (v: boolean) => void;

  uploadFiles: (
    files: File[],
    directoryId?: string | null
  ) => Promise<void>;
  removeUpload: (id: string) => void;
  clearFinishedUploads: () => void;
}

export const useNasFilesStore = create<NasFilesState>()((set, get) => ({
  currentDirectoryId: null,
  breadcrumbs: [{ name: "My NAS", id: null }],
  listing: null,
  isLoading: false,
  error: null,
  navigationDirection: "none",

  viewType: "grid",
  sortBy: "name",
  sortOrder: "asc",
  typeFilter: "all",
  typeFilters: new Set<FileTypeFilter>(),

  isSelecting: false,
  selectedIds: new Set(),

  uploads: [],

  // ── Directory Loading ───────────────────────────────────────────────

  loadDirectory: async (directoryId) => {
    set({ isLoading: true, error: null });
    try {
      // Check prefetch cache first (hover-to-prefetch, Google Drive pattern)
      const cacheKey = directoryId ?? "__root__";
      const cached = _prefetchCache.get(cacheKey);
      let listing: DirectoryListing;

      if (cached && Date.now() - cached.ts < PREFETCH_TTL) {
        listing = cached.data;
        _prefetchCache.delete(cacheKey);
      } else {
        listing = await nasApiClient.listFiles(directoryId);
      }

      // Apply server preferences
      const dir = listing.directory;
      const vt = dir.view_type === "list" ? "list" : "grid";
      let sb: SortBy = "name";
      let so: SortOrder = "asc";
      const parts = dir.sort_order.split("_");
      if (parts.length === 2) {
        sb = parts[0] as SortBy;
        so = parts[1] as SortOrder;
      }
      set({
        listing,
        isLoading: false,
        navigationDirection: "none",
        viewType: vt,
        sortBy: sb,
        sortOrder: so,
        currentDirectoryId: directoryId || null,
      });
    } catch (err) {
      set({
        isLoading: false,
        navigationDirection: "none",
        error: err instanceof Error ? err.message : "Failed to load files",
      });
    }
  },

  refresh: async () => {
    const { currentDirectoryId } = get();
    await get().loadDirectory(currentDirectoryId);
  },

  navigateToFolder: (folder) => {
    const { breadcrumbs } = get();
    // Clear listing immediately to prevent stale-data flash (Google Drive pattern)
    set({
      breadcrumbs: [...breadcrumbs, { name: folder.name, id: folder.id }],
      currentDirectoryId: folder.id,
      listing: null,
      navigationDirection: "forward",
      selectedIds: new Set(),
      isSelecting: false,
    });
    get().loadDirectory(folder.id);
  },

  navigateToFolderById: (id, name) => {
    set({
      breadcrumbs: [
        { name: "My NAS", id: null },
        { name, id },
      ],
      currentDirectoryId: id,
      listing: null,
      navigationDirection: "forward",
      selectedIds: new Set(),
      isSelecting: false,
    });
    get().loadDirectory(id);
  },

  goBack: () => {
    const { breadcrumbs } = get();
    if (breadcrumbs.length <= 1) return;
    const newCrumbs = breadcrumbs.slice(0, -1);
    const parentId = newCrumbs[newCrumbs.length - 1].id;
    set({
      breadcrumbs: newCrumbs,
      currentDirectoryId: parentId,
      listing: null,
      navigationDirection: "back",
      selectedIds: new Set(),
      isSelecting: false,
    });
    get().loadDirectory(parentId);
  },

  goToRoot: () => {
    set({
      breadcrumbs: [{ name: "My NAS", id: null }],
      currentDirectoryId: null,
      listing: null,
      navigationDirection: "back",
      selectedIds: new Set(),
      isSelecting: false,
    });
    get().loadDirectory(null);
  },

  // Hover-to-prefetch: load directory data on hover, cache for instant navigation
  // Industry pattern: Google Drive, Notion, Figma all prefetch on hover
  prefetchDirectory: (directoryId) => {
    if (_prefetchCache.has(directoryId)) return;
    nasApiClient.listFiles(directoryId).then((listing) => {
      _prefetchCache.set(directoryId, { data: listing, ts: Date.now() });
    }).catch(() => {
      // Non-critical — prefetch failure is silent
    });
  },

  // ── View Preferences ────────────────────────────────────────────────

  setViewType: (vt) => {
    set({ viewType: vt });
    // Sync to server
    const { listing } = get();
    if (listing) {
      nasApiClient
        .updateDirectoryPrefs(listing.directory.id, {
          view_type: vt,
        })
        .catch(() => {});
    }
  },

  setSortBy: (sb) => {
    set({ sortBy: sb });
    const { listing, sortOrder } = get();
    if (listing) {
      nasApiClient
        .updateDirectoryPrefs(listing.directory.id, {
          sort_order: `${sb}_${sortOrder}`,
        })
        .catch(() => {});
    }
  },

  setSortOrder: (so) => {
    set({ sortOrder: so });
    const { listing, sortBy } = get();
    if (listing) {
      nasApiClient
        .updateDirectoryPrefs(listing.directory.id, {
          sort_order: `${sortBy}_${so}`,
        })
        .catch(() => {});
    }
  },

  setTypeFilter: (tf) => set({ typeFilter: tf }),

  toggleTypeFilter: (tf) => {
    const { typeFilters } = get();
    const next = new Set(typeFilters);
    if (next.has(tf)) {
      next.delete(tf);
    } else {
      next.add(tf);
    }
    set({ typeFilters: next });
  },

  clearTypeFilters: () => set({ typeFilters: new Set() }),

  // ── Selection ───────────────────────────────────────────────────────

  toggleSelection: (id) => {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({
      selectedIds: next,
      isSelecting: next.size > 0,
    });
  },

  selectAll: (items) => {
    set({
      selectedIds: new Set(
        items.map((i) =>
          i.kind === "directory" ? i.item.id : i.item.id
        )
      ),
      isSelecting: true,
    });
  },

  clearSelection: () => {
    set({ selectedIds: new Set(), isSelecting: false });
  },

  setIsSelecting: (v) => {
    if (!v) {
      set({ isSelecting: false, selectedIds: new Set() });
    } else {
      set({ isSelecting: true });
    }
  },

  // ── Uploads ─────────────────────────────────────────────────────────

  uploadFiles: async (files, directoryId) => {
    const tasks: UploadTask[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: "pending" as const,
    }));

    set({ uploads: [...get().uploads, ...tasks] });

    for (const task of tasks) {
      set({
        uploads: get().uploads.map((u) =>
          u.id === task.id ? { ...u, status: "uploading" as const } : u
        ),
      });

      try {
        await nasApiClient.uploadFile(
          task.file,
          directoryId,
          (loaded, total) => {
            const pct = Math.round((loaded / total) * 100);
            set({
              uploads: get().uploads.map((u) =>
                u.id === task.id ? { ...u, progress: pct } : u
              ),
            });
          }
        );

        set({
          uploads: get().uploads.map((u) =>
            u.id === task.id
              ? { ...u, status: "done" as const, progress: 100 }
              : u
          ),
        });
      } catch (err) {
        set({
          uploads: get().uploads.map((u) =>
            u.id === task.id
              ? {
                  ...u,
                  status: "error" as const,
                  error:
                    err instanceof Error ? err.message : "Upload failed",
                }
              : u
          ),
        });
      }
    }

    // Refresh directory after all uploads
    await get().refresh();
  },

  removeUpload: (id) => {
    set({ uploads: get().uploads.filter((u) => u.id !== id) });
  },

  clearFinishedUploads: () => {
    set({
      uploads: get().uploads.filter(
        (u) => u.status !== "done" && u.status !== "error"
      ),
    });
  },
}));
