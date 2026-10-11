"use client";

// Static step/final snapshot of a browser task, fetched with auth as a blob
// object URL (revoked on change/unmount).

import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface FinalSnapshotProps {
  snapshotId: string | null | undefined;
  alt: string;
  className?: string;
}

export function FinalSnapshot({ snapshotId, alt, className = "" }: FinalSnapshotProps) {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!snapshotId) return;
    const ctrl = new AbortController();
    let objectUrl: string | null = null;
    apiClient.fetchBrowserSnapshot(snapshotId, ctrl.signal).then((u) => {
      if (ctrl.signal.aborted) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setLoaded({ id: snapshotId, url: u });
    });
    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [snapshotId]);

  const current = loaded && loaded.id === snapshotId ? loaded : null;

  if (!snapshotId || (current && !current.url)) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 text-white/25 ${className}`}>
        <ImageIcon size={22} strokeWidth={1.5} />
        <span className="text-[11px]">Snapshot not available</span>
      </div>
    );
  }

  if (!current) {
    return <div className={`h-full w-full animate-pulse bg-white/[0.03] ${className}`} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth-fetched blob URL
    <img
      src={current.url!}
      alt={alt}
      className={`h-full w-full object-contain animate-content-in ${className}`}
      draggable={false}
    />
  );
}
