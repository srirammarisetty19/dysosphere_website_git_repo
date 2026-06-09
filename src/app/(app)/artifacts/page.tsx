"use client";

// ============================================================================
// Artifacts Page — AI-generated files (charts, graphs, screenshots)
// Mirrors the mobile app's Artifacts screen
// Uses authenticated blob URLs for image thumbnails (server requires auth)
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText,
  Image as ImageIcon,
  BarChart3,
  Trash2,
  Download,
  Loader2,
  RefreshCw,
  Menu,
  Filter,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { AuthImage } from "@/components/ui/auth-image";

interface ArtifactFile {
  id: string;
  name: string;
  url_path: string;
  file_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  session_id: string | null;
  created_at: string | null;
  stored_path: string;
}



export default function ArtifactsPage() {
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getArtifacts(50, 0, filter || undefined);
      setFiles(data.files || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this artifact? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await apiClient.deleteArtifact(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (file: ArtifactFile) => {
    try {
      const blobUrl = await apiClient.fetchAuthenticatedBlob(file.stored_path);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      // Fallback: try direct URL
      const url = apiClient.getArtifactFileUrl(file.stored_path);
      window.open(url, "_blank");
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getTypeIcon = (fileType: string, mimeType: string | null) => {
    if (fileType === "graph" || mimeType?.startsWith("image/"))
      return <BarChart3 size={18} className="text-[var(--color-accent-teal)]" />;
    if (fileType === "screenshot")
      return <ImageIcon size={18} className="text-purple-400" />;
    return <FileText size={18} className="text-sky-400" />;
  };

  const getTypeBadge = (fileType: string) => {
    const colors: Record<string, string> = {
      graph: "bg-[var(--color-accent-teal)]/10 text-[var(--color-accent-teal)]",
      upload: "bg-sky-400/10 text-sky-400",
      screenshot: "bg-purple-400/10 text-purple-400",
      document: "bg-amber-400/10 text-amber-400",
    };
    return colors[fileType] || "bg-white/5 text-white/40";
  };

  const FILTERS = [
    { label: "All", value: null },
    { label: "Graphs", value: "graph" },
    { label: "Uploads", value: "upload" },
    { label: "Screenshots", value: "screenshot" },
  ];

  return (
    <>
      {/* Header */}
      <header className="flex items-center h-14 px-3 border-b border-white/[0.04] bg-[var(--color-bg-primary)] shrink-0">
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("toggle-sidebar"))
          }
          className="lg:hidden p-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={22} />
        </button>

        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          <FileText size={18} className="text-white/30 mr-2" />
          <span className="text-white/60 text-[15px] font-medium">
            Artifacts
          </span>
        </div>

        <button
          onClick={loadArtifacts}
          disabled={loading}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
        <Filter size={14} className="text-white/20 mr-1" />
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-white/[0.08] text-white/70 border border-white/[0.1]"
                : "text-white/30 hover:text-white/50 hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-white/15" size={28} />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
              <FileText size={28} className="text-white/10" />
            </div>
            <p className="text-white/30 text-sm font-medium mb-1">
              No artifacts yet
            </p>
            <p className="text-white/15 text-xs text-center max-w-xs">
              AI-generated files like charts, graphs, and screenshots will
              appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {files.map((file) => {
              const isImage =
                file.mime_type?.startsWith("image/") ||
                file.file_type === "graph" ||
                file.file_type === "screenshot";
              const isDeleting = deletingId === file.id;

              return (
                <div
                  key={file.id}
                  className="group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all overflow-hidden"
                >
                  {/* Preview */}
                  {isImage ? (
                    <div className="relative aspect-video bg-black/30 overflow-hidden cursor-pointer"
                      onClick={() => handleDownload(file)}
                    >
                      <AuthImage
                        src={file.stored_path}
                        alt={file.name}
                        className="w-full h-full object-contain"
                        clickToOpen
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-white/[0.02] flex items-center justify-center">
                      {getTypeIcon(file.file_type, file.mime_type)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/60 text-[13px] font-medium truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getTypeBadge(
                              file.file_type
                            )}`}
                          >
                            {file.file_type}
                          </span>
                          {file.size_bytes && (
                            <span className="text-white/15 text-[10px]">
                              {formatSize(file.size_bytes)}
                            </span>
                          )}
                          <span className="text-white/15 text-[10px]">
                            {formatDate(file.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-white/20 hover:text-red-400/70 hover:bg-red-500/5 transition-colors disabled:opacity-30"
                          title="Delete"
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
