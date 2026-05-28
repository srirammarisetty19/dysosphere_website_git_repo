"use client";

// ============================================================================
// File Details Panel — Slide-over info panel (Google Drive style)
// ============================================================================

import type { DisplayItem } from "@/lib/nas-types";
import { formatBytes } from "@/lib/nas-types";
import { X, Star, Share2, Calendar, HardDrive, FileType, MapPin, Sparkles } from "lucide-react";
import { FileThumbnail, FolderIcon } from "./file-thumbnail";

interface FileDetailsPanelProps {
  item: DisplayItem;
  onClose: () => void;
  onAskAI?: () => void;
}

export function FileDetailsPanel({ item, onClose, onAskAI }: FileDetailsPanelProps) {
  const isFile = item.kind === "file";
  const data = item.item;

  const detailRows = [
    {
      icon: FileType,
      label: "Type",
      value: isFile
        ? (item.item as any).mime_type || "Unknown"
        : "Folder",
    },
    ...(isFile
      ? [
          {
            icon: HardDrive,
            label: "Size",
            value: formatBytes((item.item as any).size || 0),
          },
        ]
      : []),
    {
      icon: Calendar,
      label: "Modified",
      value: new Date(data.updated_at).toLocaleString(),
    },
    {
      icon: Calendar,
      label: "Created",
      value: new Date(data.created_at).toLocaleString(),
    },
    {
      icon: MapPin,
      label: "Location",
      value: data.path,
    },
    {
      icon: Star,
      label: "Starred",
      value: data.is_starred ? "Yes" : "No",
    },
    {
      icon: Share2,
      label: "Shared",
      value: data.is_shared ? "Yes" : "No",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-bg-secondary border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5"
          >
            <X className="h-5 w-5 text-text-tertiary" />
          </button>
        </div>

        {/* Thumbnail + Name */}
        <div className="px-6 py-6 border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl overflow-hidden shrink-0">
              {isFile ? (
                <FileThumbnail
                  fileId={data.id}
                  mimeType={(data as any).mime_type}
                  name={data.name}
                  size="md"
                  className="rounded-xl"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-white/5 rounded-xl">
                  <FolderIcon color={(data as any).color} size="sm" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {data.name}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {isFile ? formatBytes((data as any).size || 0) : "Folder"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Ask AI Button (files only) ─────────────────────────── */}
        {isFile && onAskAI && (
          <div className="px-6 pb-4 border-b border-border-subtle">
            <button
              onClick={onAskAI}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-accent-blue/25 bg-accent-blue/5 text-sm font-medium text-accent-blue hover:bg-accent-blue/10 hover:border-accent-blue/40 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Ask AI about this file</span>
            </button>
          </div>
        )}

        {/* Details */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {detailRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-text-tertiary">{label}</p>
                <p className="text-sm text-text-primary break-all mt-0.5">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
