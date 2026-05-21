"use client";

// ============================================================================
// File Thumbnail — Google Drive style thumbnail with proxy-based auth
// Uses BFF proxy for authenticated image loading (industry standard)
// ============================================================================

import { useState } from "react";
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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  file: File,
  "file-text": FileText,
  image: Image,
  film: Film,
  music: Music,
  table: Table,
  "file-code": FileCode,
  archive: Archive,
};

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

  if (hasThumbnail) {
    const token = nasApiClient.getToken();
    const thumbUrl = nasApiClient.thumbnailUrl(fileId);

    return (
      <div
        className={`relative overflow-hidden bg-white/5 ${sizeClasses[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
          // For cross-origin requests, auth header is sent via fetch interceptor
          // For same-origin (BFF proxy), cookie/header is auto-forwarded
          {...(token
            ? { crossOrigin: "use-credentials" }
            : {})}
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
    lg: "h-12 w-12",
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
