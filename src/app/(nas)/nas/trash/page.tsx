"use client";

// ============================================================================
// Trash Page — Google Drive trash management
// ============================================================================

import { useEffect, useState } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { TrashItem } from "@/lib/nas-types";
import { formatBytes } from "@/lib/nas-types";
import {
  Loader2,
  Trash2,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  FileText,
  Folder,
} from "lucide-react";
import Link from "next/link";

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  useEffect(() => {
    loadTrash();
  }, []);

  async function loadTrash() {
    setIsLoading(true);
    try {
      const data = await nasApiClient.listTrash();
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRestore(itemId: string) {
    try {
      await nasApiClient.restoreFromTrash([itemId]);
      loadTrash();
    } catch {
      alert("Restore failed");
    }
  }

  async function handlePermanentDelete(itemId: string) {
    if (!confirm("Permanently delete this item? This cannot be undone.")) return;
    try {
      await nasApiClient.permanentDelete(itemId);
      loadTrash();
    } catch {
      alert("Delete failed");
    }
  }

  async function handleEmptyTrash() {
    try {
      await nasApiClient.emptyTrash();
      setShowEmptyConfirm(false);
      loadTrash();
    } catch {
      alert("Failed to empty trash");
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <Trash2 className="h-5 w-5 text-text-tertiary" />
        <h1 className="text-lg font-semibold text-text-primary">Trash</h1>
        <div className="flex-1" />
        {items.length > 0 && (
          <button
            onClick={() => setShowEmptyConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Empty trash
          </button>
        )}
      </div>

      {/* Info banner */}
      {items.length > 0 && (
        <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-500/80">
            Items in trash will be automatically deleted after 30 days
          </p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Trash2 className="h-12 w-12 mb-4" />
            <p className="text-sm">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors group"
              >
                <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  {item.item_type === "directory" ? (
                    <Folder className="h-5 w-5 text-blue-400" fill="currentColor" fillOpacity={0.2} />
                  ) : (
                    <FileText className="h-5 w-5 text-text-tertiary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Trashed{" "}
                    {new Date(item.trashed_at).toLocaleDateString()}
                    {item.size ? ` · ${formatBytes(item.size)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-text-secondary"
                    title="Restore"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
                    title="Delete forever"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty Trash Confirmation */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 rounded-2xl border border-border-subtle bg-bg-secondary p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <h3 className="text-lg font-semibold text-text-primary">
                Empty trash?
              </h3>
            </div>
            <p className="text-sm text-text-secondary mb-6">
              All {items.length} item{items.length !== 1 ? "s" : ""} in trash
              will be permanently deleted. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEmptyConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyTrash}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600"
              >
                Empty trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
