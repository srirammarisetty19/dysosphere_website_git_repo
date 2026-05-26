"use client";

// ============================================================================
// File Thumbnail — Google Drive style thumbnail with authenticated fetch
// Fetches thumbnails as blobs with Authorization header (img tags can't send JWT)
// ============================================================================

import { useState, useEffect } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import {
  File,
  FileText,
  Image,
  Film,
  Music,
  Table,
  FileCode,
  Archive,
  Folder,
} from "lucide-react";

interface FileThumbnailProps {
  fileId: string;
  mimeType: string | null;
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function getIconAndColor(
  mimeType: string | null
): { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string } {
  if (!mimeType) return { icon: File, color: "#6B7280" };
  if (mimeType === "application/pdf")
    return { icon: FileText, color: "#EF4444" };
  if (mimeType.startsWith("image/")) return { icon: Image, color: "#8B5CF6" };
  if (mimeType.startsWith("video/")) return { icon: Film, color: "#DC2626" };
  if (mimeType.startsWith("audio/"))
    return { icon: Music, color: "#F59E0B" };
  if (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv")
  )
    return { icon: Table, color: "#16A34A" };
  if (mimeType.includes("word") || mimeType.includes("document"))
    return { icon: FileText, color: "#2563EB" };
  if (mimeType.includes("text")) return { icon: FileCode, color: "#64748B" };
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("rar")
  )
    return { icon: Archive, color: "#D97706" };
  return { icon: File, color: "#6B7280" };
}

export function FileThumbnail({
  fileId,
  mimeType,
  name,
  className = "",
  size = "md",
}: FileThumbnailProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const isImage = mimeType?.startsWith("image/");
  const isVideo = mimeType?.startsWith("video/");
  const hasThumbnail = (isImage || isVideo) && !imgError;

  const { icon: Icon, color } = getIconAndColor(mimeType);

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-full w-full",
    lg: "h-full w-full",
  };

  // Fetch thumbnail as blob with auth header
  // (img src= can't send Authorization: Bearer headers)
  useEffect(() => {
    if (!hasThumbnail) return;

    let cancelled = false;
    const url = nasApiClient.thumbnailUrl(fileId);
    const token = nasApiClient.getToken();

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!cancelled) {
          setBlobUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        if (!cancelled) setImgError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId, hasThumbnail]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (hasThumbnail && blobUrl) {
    return (
      <div
        className={`relative overflow-hidden bg-white/5 ${sizeClasses[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
        {/* Video play badge */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/60 p-2">
              <Film className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading state for thumbnails
  if (hasThumbnail && !blobUrl && !imgError) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 animate-pulse ${sizeClasses[size]} ${className}`}
      >
        <Icon className={`${size === "sm" ? "h-5 w-5" : "h-10 w-10"} opacity-30`} style={{ color }} />
      </div>
    );
  }

  // Fallback icon
  return (
    <div
      className={`flex items-center justify-center bg-white/5 ${sizeClasses[size]} ${className}`}
    >
      <Icon
        className={`${size === "sm" ? "h-5 w-5" : "h-10 w-10"}`}
        style={{ color }}
      />
    </div>
  );
}

// ── Folder Icon ─────────────────────────────────────────────────────────

interface FolderIconProps {
  color?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FolderIcon({
  color,
  size = "md",
  className = "",
}: FolderIconProps) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-10 w-10",
    lg: "h-10 w-10",
  };

  return (
    <Folder
      className={`${sizeClasses[size]} ${className}`}
      style={{ color: color || "#3B82F6" }}
      fill={color || "#3B82F6"}
      fillOpacity={0.2}
    />
  );
}
