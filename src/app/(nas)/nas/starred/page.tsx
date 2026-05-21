"use client";

// ============================================================================
// Starred Files Page
// ============================================================================

import { useEffect, useState } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { DisplayItem } from "@/lib/nas-types";
import { FileGridView } from "@/components/nas/file-grid-view";
import { FileViewerModal } from "@/components/nas/file-viewer-modal";
import { Loader2, Star, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function StarredPage() {
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerItem, setViewerItem] = useState<DisplayItem | null>(null);

  useEffect(() => {
    loadStarred();
  }, []);

  async function loadStarred() {
    setIsLoading(true);
    try {
      const data = await nasApiClient.listStarred();
      const display: DisplayItem[] = data.map((raw: any) => {
        const isDir = raw.parent_id !== undefined && raw.mime_type === undefined;
        return isDir
          ? { kind: "directory" as const, item: raw }
          : { kind: "file" as const, item: raw };
      });
      setItems(display);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnstar(item: DisplayItem) {
    try {
      if (item.kind === "file") {
        await nasApiClient.starFile(item.item.id, false);
      } else {
        await nasApiClient.starDirectory(item.item.id, false);
      }
      loadStarred();
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <Star className="h-5 w-5 text-yellow-400" fill="currentColor" />
        <h1 className="text-lg font-semibold text-text-primary">Starred</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Star className="h-12 w-12 mb-4" />
            <p className="text-sm">No starred files yet</p>
            <p className="text-xs mt-1">Star files to quickly find them here</p>
          </div>
        ) : (
          <FileGridView
            items={items}
            selectedIds={new Set()}
            isSelecting={false}
            onFolderTap={() => {}}
            onFileTap={(item) => setViewerItem(item)}
            onContextMenu={() => {}}
            onToggleSelect={() => {}}
            onLongPress={() => {}}
          />
        )}
      </div>

      {viewerItem && (
        <FileViewerModal item={viewerItem} onClose={() => setViewerItem(null)} />
      )}
    </div>
  );
}
