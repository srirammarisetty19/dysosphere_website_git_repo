"use client";

// ============================================================================
// Person Photos Page — Grid of photos for a specific face cluster
// ============================================================================

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { nasApiClient } from "@/lib/nas-api-client";
import type { FileItem } from "@/lib/nas-types";
import { FileThumbnail } from "@/components/nas/file-thumbnail";
import { FileViewerModal } from "@/components/nas/file-viewer-modal";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PersonPhotosPage() {
  const params = useParams();
  const clusterId = params.clusterId as string;
  const [photos, setPhotos] = useState<FileItem[]>([]);
  const [label, setLabel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [viewerItem, setViewerItem] = useState<{
    kind: "file";
    item: FileItem;
  } | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [clusterId]);

  async function loadPhotos() {
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
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link
          href="/nas/people"
          className="p-2 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <h1 className="text-lg font-semibold text-text-primary">{label}</h1>
        <span className="text-sm text-text-tertiary">
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </span>
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
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() =>
                  setViewerItem({ kind: "file", item: photo })
                }
                className="relative aspect-square rounded-xl overflow-hidden group hover:ring-2 ring-accent-blue transition-all"
              >
                <FileThumbnail
                  fileId={photo.id}
                  mimeType={photo.mime_type}
                  name={photo.name}
                  size="md"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {viewerItem && (
        <FileViewerModal
          item={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      )}
    </div>
  );
}
