"use client";

// ============================================================================
// Person Photos Page — Grid of photos for a specific face cluster
// Features: Photo grid, split mode (select & move to new person), rename
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { nasApiClient } from "@/lib/nas-api-client";
import type { FileItem } from "@/lib/nas-types";
import { FileThumbnail } from "@/components/nas/file-thumbnail";
import { FileViewerModal } from "@/components/nas/file-viewer-modal";
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Split,
  Check,
  X,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export default function PersonPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const clusterId = params.clusterId as string;

  const [photos, setPhotos] = useState<FileItem[]>([]);
  const [label, setLabel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [viewerItem, setViewerItem] = useState<{
    kind: "file";
    item: FileItem;
  } | null>(null);

  // ── Split mode state ──
  const [splitMode, setSplitMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSplitting, setIsSplitting] = useState(false);

  // ── Rename state ──
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await nasApiClient.getClusterPhotos(clusterId);
      setPhotos(data.photos || []);
      setLabel(data.label || "Unknown");
    } catch {
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [clusterId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  function toggleSelection(fileId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  async function handleSplit() {
    if (selectedIds.size === 0) return;
    setIsSplitting(true);
    try {
      const result = await nasApiClient.splitCluster(
        clusterId,
        Array.from(selectedIds)
      );
      const newLabel =
        (result as Record<string, string>).new_label || "New person";
      alert(`Moved ${selectedIds.size} photos to "${newLabel}"`);
      setSplitMode(false);
      setSelectedIds(new Set());
      loadPhotos();
    } catch {
      alert("Split failed");
    } finally {
      setIsSplitting(false);
    }
  }

  async function handleRename() {
    if (!renameValue.trim()) return;
    try {
      await nasApiClient.labelCluster(clusterId, renameValue.trim());
      setLabel(renameValue.trim());
      setIsRenaming(false);
    } catch {
      alert("Rename failed");
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        {splitMode ? (
          <button
            onClick={() => {
              setSplitMode(false);
              setSelectedIds(new Set());
            }}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        ) : (
          <Link href="/nas/people" className="p-2 rounded-lg hover:bg-white/5">
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </Link>
        )}

        {splitMode ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-accent-purple">
              {selectedIds.size} selected
            </span>
            <span className="text-xs text-text-tertiary">
              Select photos of a different person
            </span>
          </div>
        ) : isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="text-lg font-semibold bg-transparent text-text-primary border-b border-accent-blue focus:outline-none"
          />
        ) : (
          <h1 className="text-lg font-semibold text-text-primary">{label}</h1>
        )}

        <span className="text-sm text-text-tertiary">
          {splitMode
            ? ""
            : `${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
        </span>
        <div className="flex-1" />

        {/* Action buttons */}
        {!splitMode && !isRenaming && (
          <>
            <button
              onClick={() => {
                setRenameValue(label);
                setIsRenaming(true);
              }}
              className="p-2 rounded-lg hover:bg-white/5"
              title="Rename"
            >
              <Pencil className="h-4 w-4 text-text-tertiary" />
            </button>
            {photos.length > 1 && (
              <button
                onClick={() => setSplitMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/5"
                title="Split into new person"
              >
                <Split className="h-4 w-4" />
                Split
              </button>
            )}
          </>
        )}
        {isRenaming && (
          <button
            onClick={handleRename}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <Check className="h-4 w-4 text-accent-blue" />
          </button>
        )}
        {splitMode && (
          <button
            onClick={() => setSplitMode(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-purple hover:bg-accent-purple/10"
          >
            <Check className="h-4 w-4" />
            Done
          </button>
        )}
      </div>

      {/* Photos Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-text-tertiary">
            <p className="text-sm">No photos found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {photos.map((photo) => {
              const isSelected = selectedIds.has(photo.id);
              return (
                <button
                  key={photo.id}
                  onClick={() => {
                    if (splitMode) {
                      toggleSelection(photo.id);
                    } else {
                      setViewerItem({ kind: "file", item: photo });
                    }
                  }}
                  className={`relative aspect-square rounded-xl overflow-hidden group transition-all ${
                    splitMode
                      ? isSelected
                        ? "ring-3 ring-accent-purple"
                        : "opacity-60 hover:opacity-80"
                      : "hover:ring-2 ring-accent-blue"
                  }`}
                >
                  <FileThumbnail
                    fileId={photo.id}
                    mimeType={photo.mime_type}
                    name={photo.name}
                    size="md"
                  />

                  {/* Selection overlay */}
                  {splitMode && (
                    <div className="absolute top-2 right-2">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center border-2 border-white transition-colors ${
                          isSelected
                            ? "bg-accent-purple"
                            : "bg-black/30"
                        }`}
                      >
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-white" />
                        )}
                      </div>
                    </div>
                  )}

                  {!splitMode && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Split action bar */}
      {splitMode && selectedIds.size > 0 && (
        <div className="px-6 py-4 border-t border-border-subtle">
          <button
            onClick={handleSplit}
            disabled={isSplitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent-purple text-white font-semibold text-sm hover:bg-accent-purple/90 disabled:opacity-50 transition-colors"
          >
            {isSplitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Split className="h-4 w-4" />
            )}
            Move {selectedIds.size} to new person
          </button>
        </div>
      )}

      {viewerItem && (
        <FileViewerModal
          item={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      )}
    </div>
  );
}
