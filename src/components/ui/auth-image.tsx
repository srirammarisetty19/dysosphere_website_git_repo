"use client";

// ============================================================================
// Authenticated Image — Industry-standard authenticated image component
//
// Browser <img> tags cannot send Authorization headers. This component
// fetches images using the API client's auth token, converts to blob URLs,
// and renders those. This is the same pattern used by Google Workspace,
// Notion, and Slack for authenticated media.
//
// Features:
// - Fetches with Bearer token via fetch()
// - Creates ephemeral blob URLs for rendering
// - Lifecycle cleanup: revokes blob URLs on unmount
// - Loading shimmer + error fallback
// - Click-to-open: opens authenticated blob in new tab
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ImageIcon } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface AuthImageProps {
  /** Server path (e.g. /files/user123/image.jpg or stored_path for artifacts) */
  src: string;
  alt?: string;
  className?: string;
  /** If true, clicking opens the image in a new tab (via authenticated blob) */
  clickToOpen?: boolean;
  /** Optional onClick override (e.g. for lightbox) */
  onClick?: () => void;
}

/**
 * Authenticated image component.
 *
 * Usage:
 *   <AuthImage src="/files/user123/upload.png" alt="Screenshot" clickToOpen />
 *   <AuthImage src={artifact.stored_path} alt={artifact.name} />
 */
export function AuthImage({
  src,
  alt = "",
  className = "",
  clickToOpen = false,
  onClick,
}: AuthImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const currentSrcRef = useRef(src);

  useEffect(() => {
    mountedRef.current = true;
    currentSrcRef.current = src;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(false);
    setBlobUrl(null);

    if (!src) {
      setError(true);
      setLoading(false);
      return;
    }

    apiClient
      .fetchAuthenticatedFileBlob(src)
      .then((url) => {
        // Only apply if this is still the current src
        if (mountedRef.current && currentSrcRef.current === src) {
          objectUrl = url;
          setBlobUrl(url);
          setLoading(false);
        } else {
          // Stale — revoke immediately
          URL.revokeObjectURL(url);
        }
      })
      .catch(() => {
        if (mountedRef.current && currentSrcRef.current === src) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const handleClick = useCallback(async () => {
    if (onClick) {
      onClick();
      return;
    }
    if (!clickToOpen) return;

    try {
      // Fetch a fresh blob for the new tab (separate from the displayed one)
      const newBlobUrl = await apiClient.fetchAuthenticatedFileBlob(src);
      window.open(newBlobUrl, "_blank");
      // Revoke after a delay (give the new tab time to load)
      setTimeout(() => URL.revokeObjectURL(newBlobUrl), 30000);
    } catch {
      // Fallback: try direct URL (will fail with auth error but better than nothing)
      window.open(apiClient.resolveFileUrl(src), "_blank");
    }
  }, [src, clickToOpen, onClick]);

  // ── Error state ──
  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.02] ${className}`}
      >
        <ImageIcon size={24} className="text-white/10" />
      </div>
    );
  }

  // ── Loading state (shimmer) ──
  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.02] animate-pulse ${className}`}
        style={{ minHeight: 120 }}
      >
        <Loader2 size={20} className="animate-spin text-white/10" />
      </div>
    );
  }

  // ── Loaded ──
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl!}
      alt={alt}
      className={`${className} ${clickToOpen || onClick ? "cursor-pointer" : ""}`}
      loading="lazy"
      onClick={clickToOpen || onClick ? handleClick : undefined}
    />
  );
}
