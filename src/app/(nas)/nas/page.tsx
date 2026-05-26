"use client";

// ============================================================================
// NAS Home — File Browser (Google Drive-style)
// ============================================================================

import { useEffect, useState, useCallback, useRef } from "react";
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
import { FilterPopover } from "@/components/nas/filter-popover";
import { AnimatePresence, motion } from "framer-motion";
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
  Palette,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

// Folder color palette — matches Flutter app's ColorPickerDialog
const FOLDER_COLORS = [
  "#757575", // grey 600
  "#795548", // brown
  "#F06292", // pink 300
  "#F44336", // red
  "#FF9800", // orange
  "#FDD835", // yellow 600
  "#8BC34A", // light green
  "#009688", // teal
  "#00BCD4", // cyan
  "#03A9F4", // light blue
  "#2196F3", // blue
  "#3F51B5", // indigo
  "#9C27B0", // purple
];

// FILTER_OPTIONS removed — now handled by FilterPopover component

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
    typeFilters,
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
    toggleTypeFilter,
    clearTypeFilters,
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
  const [colorPickerItem, setColorPickerItem] = useState<DisplayItem | null>(null);

  // ── Inline search state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DisplayItem[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load initial directory
  useEffect(() => {
    loadDirectory(null);
  }, [loadDirectory]);

  // ── Inline search handler ───────────────────────────────────────────
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (!value.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      searchDebounceRef.current = setTimeout(async () => {
        try {
          const data = await nasApiClient.searchFiles(value.trim());
          const items: DisplayItem[] = data.map((raw: any) => {
            const isDir = raw.parent_id !== undefined && !raw.mime_type;
            return isDir
              ? { kind: "directory" as const, item: raw }
              : { kind: "file" as const, item: raw };
          });
          setSearchResults(items);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 350);
    },
    []
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchFocused(false);
    setIsSearching(false);
  }, []);

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

    // Filter — use multi-select Set if any are active, else show all
    const activeFilter = typeFilters.size > 0 ? typeFilters : typeFilter;
    const filtered = items.filter((i) => matchesFilter(i, activeFilter));

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
  }, [listing, typeFilter, typeFilters, sortBy, sortOrder]);

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

  const handleChangeColor = async (color: string) => {
    if (!colorPickerItem || colorPickerItem.kind !== "directory") return;
    try {
      await nasApiClient.updateDirectoryPrefs(colorPickerItem.item.id, {
        color,
      });
      setColorPickerItem(null);
      loadDirectory(currentDirectoryId);
    } catch {
      alert("Failed to update color");
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
        {/* ── Google Drive-style Search Bar ─────────────────────────────── */}
        <div className="relative px-4 pt-3 pb-2">
          <div
            className={`
              relative flex items-center rounded-2xl transition-all duration-200
              ${
                isSearchFocused
                  ? "bg-bg-elevated border border-accent-blue/30 shadow-lg shadow-accent-blue/5"
                  : "bg-white/[0.06] border border-border-subtle hover:bg-white/[0.08] hover:shadow-md"
              }
            `}
          >
            <Search className="absolute left-4 h-5 w-5 text-text-tertiary pointer-events-none" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  clearSearch();
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Search in NAS"
              className="w-full pl-12 pr-24 py-3 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
            <div className="absolute right-3 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <Link
                href="/nas/search"
                title="AI Semantic Search"
                className="p-1.5 rounded-lg hover:bg-white/10 text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* ── Inline search results dropdown ───────────────────────── */}
          {isSearchFocused && searchQuery.trim() && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={clearSearch}
              />
              <div className="absolute left-4 right-4 top-full mt-1 z-40 max-h-[60vh] overflow-y-auto rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl animate-search-results">
                {isSearching ? (
                  <div className="flex items-center gap-3 px-5 py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-accent-blue" />
                    <span className="text-sm text-text-secondary">Searching...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-text-tertiary">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                    </div>
                    {searchResults.slice(0, 8).map((item) => (
                      <button
                        key={item.item.id}
                        onClick={() => {
                          if (item.kind === "directory") {
                            navigateToFolder(item.item as any);
                          } else {
                            setViewerItem(item);
                          }
                          clearSearch();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                          {item.kind === "directory" ? (
                            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                            </svg>
                          ) : (
                            <Search className="h-4 w-4 text-text-tertiary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text-primary truncate">{item.item.name}</p>
                          <p className="text-[11px] text-text-tertiary truncate">{item.item.path}</p>
                        </div>
                      </button>
                    ))}
                    {searchResults.length > 8 && (
                      <Link
                        href={`/nas/search?q=${encodeURIComponent(searchQuery)}`}
                        onClick={clearSearch}
                        className="flex items-center gap-2 px-4 py-3 text-sm text-accent-blue hover:bg-white/[0.04] border-t border-border-subtle"
                      >
                        <Search className="h-4 w-4" />
                        See all {searchResults.length} results
                      </Link>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Unified Toolbar: Breadcrumbs + Filter + Sort + View ───────── */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle">
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

          {/* Filter popover */}
          <FilterPopover
            activeFilters={typeFilters}
            onToggle={toggleTypeFilter}
            onClear={clearTypeFilters}
          />

          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-white/5 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="capitalize hidden sm:inline">{sortBy}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border-subtle bg-bg-secondary shadow-xl py-1 animate-popover-in">
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
                      flex items-center justify-between w-full px-4 py-2 text-sm transition-colors
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
              </>
            )}
          </div>

          {/* View toggle */}
          <button
            onClick={() =>
              setViewType(viewType === "grid" ? "list" : "grid")
            }
            className="p-2 rounded-lg hover:bg-white/5 text-text-secondary transition-colors"
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

        {/* Content — cross-fade via framer-motion, toolbar stays stable */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Loading overlay — shows on top of old content instead of replacing it */}
          {isLoading && (
            <div className="loading-overlay" />
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-400">
              <p className="text-sm">{error}</p>
              <button
                onClick={() => loadDirectory(currentDirectoryId)}
                className="mt-3 px-4 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDirectoryId ?? "__root__"}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {viewType === "grid" ? (
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
              </motion.div>
            </AnimatePresence>
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
                <div className="absolute bottom-14 right-0 z-20 w-48 rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl py-1.5 backdrop-blur-md animate-popover-in">
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
                  setColorPickerItem(contextMenu.item);
                  setContextMenu(null);
                }
              : undefined
          }
          onShowInfo={() => setDetailsItem(contextMenu.item)}
          onTrash={() => handleTrash(contextMenu.item)}
        />
      )}

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-modal-bg">
          <div className="w-96 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl animate-modal-content">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-modal-bg">
          <div className="w-96 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl animate-modal-content">
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

      {/* Color Picker Dialog */}
      {colorPickerItem && colorPickerItem.kind === "directory" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-modal-bg">
          <div className="w-80 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl animate-modal-content">
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              Select Color
            </h3>
            <p className="text-xs text-text-tertiary mb-5">
              {colorPickerItem.item.name}
            </p>
            <div className="grid grid-cols-5 gap-3 justify-items-center">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleChangeColor(color)}
                  className="h-10 w-10 rounded-full border-2 border-transparent hover:border-white/40 hover:scale-110 transition-all duration-150"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            {/* Reset to default */}
            <button
              onClick={() => handleChangeColor("#FFFFFF")}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs text-text-secondary hover:bg-white/5 border border-border-subtle"
            >
              <Palette className="h-3.5 w-3.5" />
              Reset to default
            </button>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setColorPickerItem(null)}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
              >
                Cancel
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
