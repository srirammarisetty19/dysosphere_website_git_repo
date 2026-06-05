"use client";

// ============================================================================
// Skeleton Grid — Shimmer placeholder during folder transitions
// Industry pattern: Google Drive, Dropbox, iCloud Drive all show skeleton cards
// with identical dimensions to real content for zero layout shift.
// ============================================================================

export function SkeletonGrid() {
  return (
    <div
      className="p-4 grid gap-3"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border-subtle bg-bg-tertiary overflow-hidden"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {/* Thumbnail area — matches FileGridView aspect ratio */}
          <div className="aspect-[4/3] bg-white/[0.03] animate-skeleton-pulse" />

          {/* Text lines — matches real card layout */}
          <div className="px-3 py-2.5 space-y-2">
            <div
              className="h-3.5 rounded-md bg-white/[0.06] animate-skeleton-pulse"
              style={{ width: `${60 + Math.random() * 30}%`, animationDelay: `${i * 40 + 100}ms` }}
            />
            <div
              className="h-2.5 rounded-md bg-white/[0.04] animate-skeleton-pulse"
              style={{ width: "40%", animationDelay: `${i * 40 + 200}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="px-4 py-2 space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{ animationDelay: `${i * 30}ms` }}
        >
          {/* Icon placeholder */}
          <div className="h-10 w-10 rounded-lg bg-white/[0.04] animate-skeleton-pulse shrink-0" />

          {/* Text lines */}
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded-md bg-white/[0.06] animate-skeleton-pulse"
              style={{ width: `${40 + Math.random() * 40}%`, animationDelay: `${i * 30 + 80}ms` }}
            />
            <div
              className="h-2.5 rounded-md bg-white/[0.04] animate-skeleton-pulse"
              style={{ width: "25%", animationDelay: `${i * 30 + 160}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
