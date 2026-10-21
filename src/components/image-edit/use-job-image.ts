"use client";

// ============================================================================
// useJobImage — authenticated job image → object URL (auto-revoked)
// <img> can't send Bearer tokens, so job images are fetched as blobs.
// ============================================================================

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type Kind = "result" | "input" | "mask" | "thumb";

export function useJobImage(
  jobId: string | null | undefined,
  kind: Kind,
  enabled = true,
  versionKey?: string | number | null
): { url: string | null; error: boolean } {
  const [state, setState] = useState<{ key: string; url: string | null; error: boolean }>({
    key: "",
    url: null,
    error: false,
  });
  const key = jobId && enabled ? `${jobId}:${kind}:${versionKey ?? ""}` : "";

  useEffect(() => {
    if (!key || !jobId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    apiClient
      .fetchImageJobBlob(jobId, kind, versionKey ?? undefined)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ key, url: objectUrl, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, url: null, error: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key, jobId, kind, versionKey]);

  if (!key || state.key !== key) return { url: null, error: false };
  return { url: state.url, error: state.error };
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
