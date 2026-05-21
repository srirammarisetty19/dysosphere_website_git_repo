"use client";

// ============================================================================
// NAS Home — File Browser (Google Drive-style)
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import { useNasFilesStore } from "@/stores/nas-files-store";
import { nasApiClient } from "@/lib/nas-api-client";
import type { DisplayItem, FileTypeFilter } from "@/lib/nas-types";
import { matchesFilter } from "@/lib/nas-types";
import { BreadcrumbNav } from "@/components/nas/breadcrumb-nav";
import { FileGridView } from "@/components/nas/file-grid-view";
import { FileListView } from "@/components/nas/file-list-view";
import { FileContextMenu } from "@/components/nas/file-context-menu";
import { UploadZone } from "@/components/nas/upload-zone";
import { FileViewerModal } from "@/components/nas/file-viewer-modal";
import { FileDetailsPanel } from "@/components/nas/file-details-panel";
import {
  Grid3X3,
  List,
  Plus,
  Upload,
  FolderPlus,
  ArrowUpDown,
  Loader2,
  Search,
  Menu,
  ChevronDown,
  Trash2,
  Download,
  Star,
  Share2,
  Move,
  X,
  Check,
} from "lucide-react";

const FILTER_OPTIONS: { value: FileTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "folders", label: "Folders" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "documents", label: "Documents" },
];

export default function NasHomePage() {
  const {
    breadcrumbs,
    listing,
    isLoading,
    error,
    viewType,
    sortBy,
    sortOrder,
    typeFilter,
    isSelecting,
    selectedIds,
    loadDirectory,
    navigateToFolder,
    goBack,
    goToRoot,
    setViewType,
    setSortBy,
    setSortOrder,
    setTypeFilter,
    toggleSelection,
    selectAll,
    clearSelection,
    uploadFiles,
    currentDirectoryId,
  } = useNasFilesStore();

  const [contextMenu, setContextMenu] = useState<{
    item: DisplayItem;
    position: { x: number; y: number };
  } | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [viewerItem, setViewerItem] = useState<DisplayItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<DisplayItem | null>(null);
  const [renameItem, setRenameItem] = useState<DisplayItem | null>(null);
  const [renameName, setRenameName] = useState("");

  // Load initial directory
  useEffect(() => {
    loadDirectory(null);
  }, [loadDirectory]);

  // ── Build display items ─────────────────────────────────────────────
  const buildItems = useCallback((): DisplayItem[] => {
    if (!listing) return [];
    const items: DisplayItem[] = [
      ...listing.subdirectories.map(
        (d) => ({ kind: "directory", item: d } as DisplayItem)
      ),
      ...listing.files.map(
        (f) => ({ kind: "file", item: f } as DisplayItem)
      ),
    ];

    // Filter
    const filtered = items.filter((i) => matchesFilter(i, typeFilter));

    // Sort
    filtered.sort((a, b) => {
      // Directories always first
      if (a.kind === "directory" && b.kind === "file") return -1;
      if (a.kind === "file" && b.kind === "directory") return 1;

      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.item.name
            .toLowerCase()
            .localeCompare(b.item.name.toLowerCase());
          break;
        case "date":
          cmp =
            new Date(b.item.updated_at).getTime() -
            new Date(a.item.updated_at).getTime();
          break;
        case "size":
          cmp =
            (b.kind === "file" ? b.item.size : 0) -
            (a.kind === "file" ? a.item.size : 0);
          break;
        case "type":
          const extA = a.item.name.includes(".")
            ? a.item.name.slice(a.item.name.lastIndexOf("."))
            : "";
          const extB = b.item.name.includes(".")
            ? b.item.name.slice(b.item.name.lastIndexOf("."))
            : "";
          cmp = extA.localeCompare(extB);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [listing, typeFilter, sortBy, sortOrder]);

  const displayItems = buildItems();

  // ── Actions ─────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const dirId = listing?.directory?.id;
    if (!dirId) return;
    try {
      await nasApiClient.createDirectory(newFolderName.trim(), dirId);
      setShowNewFolderDialog(false);
      setNewFolderName("");
      loadDirectory(currentDirectoryId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  const handleDownload = async (item: DisplayItem) => {
    if (item.kind !== "file") return;
    try {
      const blob = await nasApiClient.downloadFile(item.item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed");
    }
  };

  const handleToggleStar = async (item: DisplayItem) => {
    try {
      const isStarred = item.item.is_starred;
      if (item.kind === "file") {
        await nasApiClient.starFile(item.item.id, !isStarred);
      } else {
        await nasApiClient.starDirectory(item.item.id, !isStarred);
      }
      loadDirectory(currentDirectoryId);
    } catch {
      alert("Failed to update star");
    }
  };

  const handleTrash = async (item: DisplayItem) => {
    try {
      await nasApiClient.moveToTrash([item.item.id]);
      loadDirectory(currentDirectoryId);
    } catch {
      alert("Failed to move to trash");
    }
  };

  const handleRename = async () => {
    if (!renameItem || !renameName.trim()) return;
    try {
      const srcPath = renameItem.item.path;
      const destPath = srcPath.includes("/")
        ? srcPath.substring(0, srcPath.lastIndexOf("/")) || "/"
        : "/";
      await nasApiClient.moveOrRename(srcPath, destPath, renameName.trim());
      setRenameItem(null);
      setRenameName("");
      loadDirectory(currentDirectoryId);
    } catch {
      alert("Rename failed");
    }
  };

  const handleBatchTrash = async () => {
    try {
      await nasApiClient.moveToTrash(Array.from(selectedIds));
      clearSelection();
      loadDirectory(currentDirectoryId);
    } catch {
      alert("Failed to trash selected items");
    }
  };

  const handleBatchDownload = async () => {
    const items = displayItems.filter(
      (i) => i.kind === "file" && selectedIds.has(i.item.id)
    );
    for (const item of items) {
      await handleDownload(item);
    }
    clearSelection();
  };

  const handleBreadcrumbNav = (index: number) => {
    if (index === 0) {
      goToRoot();
    } else {
      const target = breadcrumbs[index];
      if (target.id) {
        // Trim breadcrumbs and navigate
        const store = useNasFilesStore.getState();
        const newCrumbs = breadcrumbs.slice(0, index + 1);
        useNasFilesStore.setState({
          breadcrumbs: newCrumbs,
          currentDirectoryId: target.id,
        });
        loadDirectory(target.id);
      }
    }
  };

  const handleFileUpload = () => {
    const input = document.getElementById("nas-file-upload");
    if (input) input.click();
  };

  return (
    <UploadZone directoryId={currentDirectoryId}>
      <div className="flex flex-col h-full">
        {/* Top Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          {/* Mobile menu button */}
          <button className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
            <Menu className="h-5 w-5 text-text-secondary" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex-1 min-w-0">
            <BreadcrumbNav
              breadcrumbs={breadcrumbs}
              onNavigate={handleBreadcrumbNav}
            />
          </div>

          {/* Search */}
          <button
            onClick={() => (window.location.href = "/nas/search")}
            className="p-2 rounded-lg hover:bg-white/5 text-text-secondary"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* View toggle */}
          <button
            onClick={() =>
              setViewType(viewType === "grid" ? "list" : "grid")
            }
            className="p-2 rounded-lg hover:bg-white/5 text-text-secondary"
            title={viewType === "grid" ? "Switch to list" : "Switch to grid"}
          >
            {viewType === "grid" ? (
              <List className="h-5 w-5" />
            ) : (
              <Grid3X3 className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Selection bar (when items selected) */}
        {isSelecting && selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-accent-blue/8 border-b border-accent-blue/20">
            <button
              onClick={clearSelection}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <X className="h-4 w-4 text-text-primary" />
            </button>
            <span className="text-sm font-medium text-text-primary">
              {selectedIds.size} selected
            </span>
            <div className="flex-1" />

            <button
              onClick={() => selectAll(displayItems)}
              className="px-3 py-1.5 rounded-lg text-xs hover:bg-white/5 text-text-secondary"
            >
              Select all
            </button>
            <button
              onClick={handleBatchDownload}
              className="p-1.5 rounded-lg hover:bg-white/10 text-text-secondary"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleBatchTrash}
              className="p-1.5 rounded-lg hover:bg-white/10 text-red-400"
              title="Move to trash"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Filter Bar + Sort */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle overflow-x-auto scrollbar-none">
          {/* Type filters */}
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                ${
                  typeFilter === value
                    ? "bg-accent-blue/15 text-accent-blue border border-accent-blue/30"
                    : "bg-white/5 text-text-secondary hover:bg-white/10 border border-transparent"
                }
              `}
            >
              {label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-white/5"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="capitalize">{sortBy}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-border-subtle bg-bg-secondary shadow-xl py-1">
                {(["name", "date", "size", "type"] as const).map((sb) => (
                  <button
                    key={sb}
                    onClick={() => {
                      if (sortBy === sb) {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy(sb);
                      }
                      setShowSortMenu(false);
                    }}
                    className={`
                      flex items-center justify-between w-full px-4 py-2 text-sm
                      ${
                        sortBy === sb
                          ? "text-accent-blue"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                      }
                    `}
                  >
                    <span className="capitalize">{sb}</span>
                    {sortBy === sb && (
                      <span className="text-xs">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-400">
              <p className="text-sm">{error}</p>
              <button
                onClick={() => loadDirectory(currentDirectoryId)}
                className="mt-3 px-4 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10"
              >
                Retry
              </button>
            </div>
          ) : viewType === "grid" ? (
            <FileGridView
              items={displayItems}
              selectedIds={selectedIds}
              isSelecting={isSelecting}
              onFolderTap={(item) => {
                if (item.kind === "directory") navigateToFolder(item.item);
              }}
              onFileTap={(item) => setViewerItem(item)}
              onContextMenu={(item, e) =>
                setContextMenu({ item, position: { x: e.clientX, y: e.clientY } })
              }
              onToggleSelect={(id) => toggleSelection(id)}
              onLongPress={(item) => {
                toggleSelection(item.item.id);
              }}
            />
          ) : (
            <FileListView
              items={displayItems}
              selectedIds={selectedIds}
              isSelecting={isSelecting}
              onFolderTap={(item) => {
                if (item.kind === "directory") navigateToFolder(item.item);
              }}
              onFileTap={(item) => setViewerItem(item)}
              onContextMenu={(item, e) =>
                setContextMenu({ item, position: { x: e.clientX, y: e.clientY } })
              }
              onToggleSelect={(id) => toggleSelection(id)}
            />
          )}
        </div>

        {/* FAB — New button (Google Drive pattern) */}
        <div className="fixed bottom-6 right-6 z-20">
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent-blue text-white shadow-lg shadow-accent-blue/30 hover:bg-accent-blue/90 transition-all hover:shadow-xl"
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium text-sm">New</span>
            </button>

            {showNewMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNewMenu(false)}
                />
                <div className="absolute bottom-14 right-0 z-20 w-48 rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl py-1.5">
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      setShowNewFolderDialog(true);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>New folder</span>
                  </button>
                  <div className="my-1 border-t border-border-subtle mx-2" />
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      handleFileUpload();
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload files</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          item={contextMenu.item}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onOpen={() => {
            if (contextMenu.item.kind === "directory") {
              navigateToFolder(contextMenu.item.item);
            } else {
              setViewerItem(contextMenu.item);
            }
          }}
          onDownload={
            contextMenu.item.kind === "file"
              ? () => handleDownload(contextMenu.item)
              : undefined
          }
          onToggleStar={() => handleToggleStar(contextMenu.item)}
          onShare={() => {
            // TODO: Share dialog
            alert("Share dialog coming soon");
          }}
          onRename={() => {
            setRenameItem(contextMenu.item);
            setRenameName(contextMenu.item.item.name);
          }}
          onMove={() => {
            // TODO: Move dialog
            alert("Move dialog coming soon");
          }}
          onChangeColor={
            contextMenu.item.kind === "directory"
              ? () => {
                  // TODO: Color picker
                  alert("Color picker coming soon");
                }
              : undefined
          }
          onShowInfo={() => setDetailsItem(contextMenu.item)}
          onTrash={() => handleTrash(contextMenu.item)}
        />
      )}

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              New folder
            </h3>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              placeholder="Untitled folder"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-blue"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setShowNewFolderDialog(false);
                  setNewFolderName("");
                }}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 rounded-lg text-sm bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renameItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Rename
            </h3>
            <input
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-blue"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setRenameItem(null);
                  setRenameName("");
                }}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 rounded-lg text-sm bg-accent-blue text-white hover:bg-accent-blue/90"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewerItem && (
        <FileViewerModal
          item={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      )}

      {/* File Details Panel */}
      {detailsItem && (
        <FileDetailsPanel
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
        />
      )}
    </UploadZone>
  );
}
