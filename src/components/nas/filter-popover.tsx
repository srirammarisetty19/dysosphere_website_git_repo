"use client";

// ============================================================================
// Filter Popover — Multi-select file type filter (Google Drive-style)
// ============================================================================

import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Check, X } from "lucide-react";
import type { FileTypeFilter } from "@/lib/nas-types";

const FILTER_OPTIONS: { value: FileTypeFilter; label: string; icon: string }[] = [
  { value: "folders", label: "Folders", icon: "📁" },
  { value: "images", label: "Images", icon: "🖼️" },
  { value: "videos", label: "Videos", icon: "🎬" },
  { value: "audio", label: "Audio", icon: "🎵" },
  { value: "documents", label: "Documents", icon: "📄" },
];

interface FilterPopoverProps {
  activeFilters: Set<FileTypeFilter>;
  onToggle: (filter: FileTypeFilter) => void;
  onClear: () => void;
}

export function FilterPopover({
  activeFilters,
  onToggle,
  onClear,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = activeFilters.size > 0;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-150
          ${
            hasActiveFilters
              ? "bg-accent-blue/12 text-accent-blue border border-accent-blue/25"
              : "text-text-secondary hover:bg-white/5 border border-transparent"
          }
        `}
        title="Filter by type"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Filter</span>
        {hasActiveFilters && (
          <span className="flex items-center justify-center h-4 min-w-[16px] rounded-full bg-accent-blue text-white text-[10px] font-bold px-1">
            {activeFilters.size}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl animate-popover-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              File type
            </span>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  onClear();
                }}
                className="text-[11px] text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Options */}
          <div className="py-1">
            {FILTER_OPTIONS.map(({ value, label, icon }) => {
              const isActive = activeFilters.has(value);
              return (
                <button
                  key={value}
                  onClick={() => onToggle(value)}
                  className={`
                    flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors
                    ${
                      isActive
                        ? "text-accent-blue bg-accent-blue/5"
                        : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                    }
                  `}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className="flex-1 text-left">{label}</span>
                  <div
                    className={`
                      h-4.5 w-4.5 rounded flex items-center justify-center transition-all duration-150
                      ${
                        isActive
                          ? "bg-accent-blue"
                          : "border border-white/20"
                      }
                    `}
                    style={{ width: 18, height: 18 }}
                  >
                    {isActive && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
