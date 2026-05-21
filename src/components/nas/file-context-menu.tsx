"use client";

// ============================================================================
// File Context Menu — Google Drive right-click / three-dot menu
// ============================================================================

import { useEffect, useRef } from "react";
import type { DisplayItem } from "@/lib/nas-types";
import {
  Download,
  Star,
  StarOff,
  Share2,
  Pencil,
  Move,
  Palette,
  Info,
  Trash2,
  FolderInput,
  Copy,
  ExternalLink,
} from "lucide-react";

interface FileContextMenuProps {
  item: DisplayItem;
  position: { x: number; y: number };
  onClose: () => void;
  onOpen: () => void;
  onDownload?: () => void;
  onToggleStar: () => void;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onChangeColor?: () => void;
  onShowInfo: () => void;
  onTrash: () => void;
  onCopy?: () => void;
}

export function FileContextMenu({
  item,
  position,
  onClose,
  onOpen,
  onDownload,
  onToggleStar,
  onShare,
  onRename,
  onMove,
  onChangeColor,
  onShowInfo,
  onTrash,
  onCopy,
}: FileContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  const isStarred =
    item.kind === "directory" ? item.item.is_starred : item.item.is_starred;
  const isDirectory = item.kind === "directory";

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Position adjustment to keep menu in viewport
  const adjustedX = Math.min(position.x, window.innerWidth - 220);
  const adjustedY = Math.min(position.y, window.innerHeight - 400);

  const menuItems = [
    {
      icon: ExternalLink,
      label: "Open",
      action: onOpen,
    },
    ...(onDownload && !isDirectory
      ? [{ icon: Download, label: "Download", action: onDownload }]
      : []),
    { divider: true },
    {
      icon: isStarred ? StarOff : Star,
      label: isStarred ? "Remove from Starred" : "Add to Starred",
      action: onToggleStar,
    },
    { icon: Share2, label: "Share", action: onShare },
    { divider: true },
    { icon: Pencil, label: "Rename", action: onRename },
    {
      icon: FolderInput,
      label: "Move to",
      action: onMove,
    },
    ...(onCopy
      ? [{ icon: Copy, label: "Make a copy", action: onCopy }]
      : []),
    ...(isDirectory && onChangeColor
      ? [
          {
            icon: Palette,
            label: "Change color",
            action: onChangeColor,
          },
        ]
      : []),
    { divider: true },
    { icon: Info, label: "File information", action: onShowInfo },
    { divider: true },
    {
      icon: Trash2,
      label: "Move to trash",
      action: onTrash,
      danger: true,
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl shadow-black/40 py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {menuItems.map((menuItem, index) => {
        if ("divider" in menuItem && menuItem.divider) {
          return (
            <div
              key={`div-${index}`}
              className="my-1 border-t border-border-subtle mx-2"
            />
          );
        }

        const { icon: Icon, label, action, danger } =
          menuItem as {
            icon: React.ComponentType<{ className?: string }>;
            label: string;
            action: () => void;
            danger?: boolean;
          };

        return (
          <button
            key={label}
            onClick={() => {
              action();
              onClose();
            }}
            className={`
              flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors
              ${
                danger
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              }
            `}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
