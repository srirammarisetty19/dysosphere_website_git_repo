"use client";

// ============================================================================
// File Grid View — Google Drive card layout
// Uses CSS Grid auto-fill for responsive column sizing
// Includes hover-to-prefetch for instant folder navigation
// ============================================================================

import { useRef, useCallback } from "react";

import type { DisplayItem } from "@/lib/nas-types";
import { FileThumbnail, FolderIcon } from "./file-thumbnail";
import { MoreVertical, Check } from "lucide-react";

interface FileGridViewProps {
  items: DisplayItem[];
  selectedIds: Set<string>;
  isSelecting: boolean;
  onFolderTap: (item: DisplayItem) => void;
  onFileTap: (item: DisplayItem) => void;
  onContextMenu: (item: DisplayItem, e: React.MouseEvent) => void;
  onToggleSelect: (id: string) => void;
  onLongPress: (item: DisplayItem) => void;
  onPrefetchFolder?: (directoryId: string) => void;
}

export function FileGridView({
  items,
  selectedIds,
  isSelecting,
  onFolderTap,
  onFileTap,
  onContextMenu,
  onToggleSelect,
  onLongPress,
  onPrefetchFolder,
}: FileGridViewProps) {
  // Hover-to-prefetch debounce timer (Google Drive pattern)
  const prefetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFolderMouseEnter = useCallback(
    (folderId: string) => {
      if (!onPrefetchFolder) return;
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        onPrefetchFolder(folderId);
      }, 200); // 200ms debounce — most users hover 200-500ms before clicking
    },
    [onPrefetchFolder]
  );

  const handleFolderMouseLeave = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
  }, []);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-tertiary">
        <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-[var(--color-border-default)] flex items-center justify-center mb-5">
          <svg className="h-9 w-9 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">No files here yet</p>
        <p className="text-xs mt-1.5 text-[var(--color-text-tertiary)]">Drop files or click &ldquo;New&rdquo; to get started</p>
      </div>
    );
  }

  return (
    <div
      className="p-4 grid gap-3"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
      }}
    >
      {items.map((item, index) => {
        const id = item.kind === "directory" ? item.item.id : item.item.id;
        const name =
          item.kind === "directory" ? item.item.name : item.item.name;
        const isSelected = selectedIds.has(id);
        const folderColor =
          item.kind === "directory" ? item.item.color : null;

        return (
          <div
            key={id}
            className={`
              group relative rounded-xl border transition-all duration-200 cursor-pointer
              animate-grid-item
              ${
                isSelected
                  ? "border-[var(--color-accent-blue)] bg-[var(--color-accent-blue-subtle)] ring-1 ring-[var(--color-accent-blue)]/30"
                  : "border-[var(--color-border-subtle)] bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-elevated)] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
              }
            `}
            style={{ animationDelay: `${Math.min(index, 15) * 30}ms` }}
            onClick={() => {
              if (isSelecting) {
                onToggleSelect(id);
              } else if (item.kind === "directory") {
                onFolderTap(item);
              } else {
                onFileTap(item);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu(item, e);
            }}
            onDoubleClick={() => {
              if (item.kind === "directory") onFolderTap(item);
              else onFileTap(item);
            }}
            onMouseEnter={
              item.kind === "directory"
                ? () => handleFolderMouseEnter(item.item.id)
                : undefined
            }
            onMouseLeave={
              item.kind === "directory" ? handleFolderMouseLeave : undefined
            }
          >
            {/* Thumbnail area */}
            <div className="relative aspect-[4/3] rounded-t-xl overflow-hidden">
              {item.kind === "directory" ? (
                <div
                  className="h-full w-full flex items-center justify-center transition-colors duration-200"
                  style={{
                    background: folderColor
                      ? `linear-gradient(135deg, ${folderColor}08, ${folderColor}15)`
                      : "rgba(255,255,255,0.02)",
                  }}
                >
                  <FolderIcon
                    color={folderColor}
                    size="md"
                  />
                </div>
              ) : (
                <FileThumbnail
                  fileId={item.item.id}
                  mimeType={item.item.mime_type}
                  name={item.item.name}
                  size="md"
                />
              )}

              {/* Selection checkbox (shown on hover or when selecting) */}
              <div
                className={`
                  absolute top-2 left-2 h-6 w-6 rounded-md border-2 flex items-center justify-center
                  transition-all duration-150
                  ${
                    isSelecting || isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }
                  ${
                    isSelected
                      ? "bg-accent-blue border-accent-blue animate-selection-pulse"
                      : "bg-black/40 border-white/40 backdrop-blur-sm"
                  }
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(id);
                }}
              >
                {isSelected && <Check className="h-4 w-4 text-white" />}
              </div>

              {/* Three-dot menu */}
              <button
                className="absolute top-2 right-2 p-1 rounded-md bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
                onClick={(e) => {
                  e.stopPropagation();
                  onContextMenu(item, e);
                }}
              >
                <MoreVertical className="h-4 w-4 text-white" />
              </button>

              {/* Star badge */}
              {(item.kind === "file"
                ? item.item.is_starred
                : item.item.is_starred) && (
                <div className="absolute bottom-2 right-2 p-0.5">
                  <svg
                    className="h-4 w-4 text-yellow-400 drop-shadow"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* File name */}
            <div className="px-3 py-2.5">
              <p className="text-sm text-[var(--color-text-primary)] truncate font-medium">
                {name}
              </p>
              {item.kind === "file" && (
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">
                  {new Date(item.item.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
