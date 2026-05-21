"use client";

// ============================================================================
// File List View — Google Drive row layout
// ============================================================================

import type { DisplayItem } from "@/lib/nas-types";
import { formatBytes } from "@/lib/nas-types";
import { FileThumbnail, FolderIcon } from "./file-thumbnail";
import { MoreVertical, Check, Star } from "lucide-react";

interface FileListViewProps {
  items: DisplayItem[];
  selectedIds: Set<string>;
  isSelecting: boolean;
  onFolderTap: (item: DisplayItem) => void;
  onFileTap: (item: DisplayItem) => void;
  onContextMenu: (item: DisplayItem, e: React.MouseEvent) => void;
  onToggleSelect: (id: string) => void;
}

export function FileListView({
  items,
  selectedIds,
  isSelecting,
  onFolderTap,
  onFileTap,
  onContextMenu,
  onToggleSelect,
}: FileListViewProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <p className="text-sm">No files found</p>
      </div>
    );
  }

  return (
    <div className="px-4">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_120px_100px_40px] gap-4 px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wider border-b border-border-subtle">
        <span>Name</span>
        <span className="hidden sm:block">Modified</span>
        <span className="hidden sm:block text-right">Size</span>
        <span />
      </div>

      {/* File rows */}
      {items.map((item) => {
        const id = item.kind === "directory" ? item.item.id : item.item.id;
        const name = item.kind === "directory" ? item.item.name : item.item.name;
        const isSelected = selectedIds.has(id);
        const isStarred =
          item.kind === "directory"
            ? item.item.is_starred
            : item.item.is_starred;

        return (
          <div
            key={id}
            className={`
              group grid grid-cols-[1fr_120px_100px_40px] gap-4 items-center px-4 py-2.5
              rounded-lg transition-colors cursor-pointer
              ${
                isSelected
                  ? "bg-accent-blue/8"
                  : "hover:bg-white/[0.03]"
              }
            `}
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
          >
            {/* Name + icon */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Checkbox */}
              <div
                className={`
                  h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-opacity
                  ${
                    isSelecting || isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }
                  ${
                    isSelected
                      ? "bg-accent-blue border-accent-blue"
                      : "border-white/30"
                  }
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(id);
                }}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>

              {/* Icon */}
              <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden">
                {item.kind === "directory" ? (
                  <FolderIcon color={item.item.color} size="sm" />
                ) : (
                  <FileThumbnail
                    fileId={item.item.id}
                    mimeType={item.item.mime_type}
                    name={item.item.name}
                    size="sm"
                    className="rounded-lg"
                  />
                )}
              </div>

              {/* Name */}
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-sm text-text-primary truncate">
                  {name}
                </span>
                {isStarred && (
                  <Star className="h-3.5 w-3.5 text-yellow-400 shrink-0" fill="currentColor" />
                )}
              </div>
            </div>

            {/* Modified date */}
            <span className="hidden sm:block text-xs text-text-tertiary">
              {new Date(item.item.updated_at).toLocaleDateString()}
            </span>

            {/* Size */}
            <span className="hidden sm:block text-xs text-text-tertiary text-right">
              {item.kind === "file"
                ? formatBytes(item.item.size)
                : `${item.kind === "directory" ? "—" : ""}`}
            </span>

            {/* Actions */}
            <button
              className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                onContextMenu(item, e);
              }}
            >
              <MoreVertical className="h-4 w-4 text-text-tertiary" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
