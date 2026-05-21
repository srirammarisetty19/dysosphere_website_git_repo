"use client";

// ============================================================================
// File Viewer Modal — Full-screen preview (Google Drive pattern)
// Supports: images, video, audio, PDF, text
// ============================================================================

import { useEffect, useState } from "react";
import type { DisplayItem } from "@/lib/nas-types";
import { nasApiClient } from "@/lib/nas-api-client";
import {
  X,
  Download,
  Share2,
  Info,
  Star,
  MoreVertical,
  Loader2,
  FileText,
} from "lucide-react";

interface FileViewerModalProps {
  item: DisplayItem;
  onClose: () => void;
}

export function FileViewerModal({ item, onClose }: FileViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  if (item.kind !== "file") return null;

  const file = item.item;
  const mime = file.mime_type || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isPdf = mime === "application/pdf";
  const isText =
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("javascript") ||
    mime.includes("css");

  // Load file content
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        if (isImage) {
          // Use thumbnail URL for images (proxy handles auth)
          const url = nasApiClient.thumbnailUrl(file.id);
          setBlobUrl(url);
        } else if (isVideo || isAudio || isPdf) {
          const blob = await nasApiClient.downloadFile(file.id);
          if (!cancelled) {
            setBlobUrl(URL.createObjectURL(blob));
          }
        } else if (isText) {
          const blob = await nasApiClient.downloadFile(file.id);
          const text = await blob.text();
          if (!cancelled) {
            setTextContent(text);
          }
        }
      } catch {
        // Failed to load
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (blobUrl && !isImage) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const blob = await nasApiClient.downloadFile(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {file.name}
            </p>
            <p className="text-xs text-white/50">
              {mime || "Unknown type"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-4">
        {isLoading ? (
          <Loader2 className="h-10 w-10 animate-spin text-white/40" />
        ) : isImage && blobUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={blobUrl}
            alt={file.name}
            className="max-h-full max-w-full object-contain rounded-lg"
          />
        ) : isVideo && blobUrl ? (
          <video
            src={blobUrl}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg"
          >
            Your browser does not support video playback.
          </video>
        ) : isAudio && blobUrl ? (
          <div className="flex flex-col items-center gap-6">
            <div className="h-32 w-32 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg
                className="h-16 w-16 text-accent-blue"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <p className="text-white font-medium">{file.name}</p>
            <audio src={blobUrl} controls autoPlay className="w-80">
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : isPdf && blobUrl ? (
          <iframe
            src={blobUrl}
            className="w-full h-full max-w-4xl rounded-lg"
            title={file.name}
          />
        ) : isText && textContent !== null ? (
          <div className="w-full max-w-4xl max-h-full overflow-auto rounded-xl bg-bg-secondary border border-border-subtle p-6">
            <pre className="text-sm text-text-secondary font-mono whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          </div>
        ) : (
          /* Unsupported — download prompt */
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="h-16 w-16 text-white/20" />
            <p className="text-white/70 text-lg">{file.name}</p>
            <p className="text-white/40 text-sm">
              Preview not available for this file type
            </p>
            <button
              onClick={handleDownload}
              className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
