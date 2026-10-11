"use client";

// ============================================================================
// LiveCanvas — paints live browser frames onto a <canvas> through a ref.
// Frames bypass React entirely; only low-frequency status/meta changes
// (connect, page navigation, ended) become state.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  drawLetterboxed,
  subscribeLive,
  type LiveMeta,
  type LiveStatus,
} from "@/components/browser/frame-source";

export interface LiveFeedState {
  status: LiveStatus;
  meta: LiveMeta;
  endedSnapshotId: string | null;
  hasFrame: boolean;
}

interface LiveCanvasProps {
  itemId: string;
  className?: string;
  /** Called on status/meta/ended changes (not per frame). */
  onState?: (s: LiveFeedState) => void;
}

export function LiveCanvas({ itemId, className = "", onState }: LiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastBmp = useRef<ImageBitmap | null>(null);
  const onStateRef = useRef(onState);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useEffect(() => {
    const state: LiveFeedState = { status: "connecting", meta: {}, endedSnapshotId: null, hasFrame: false };
    const emit = () => onStateRef.current?.({ ...state });
    let gotFirst = false;

    const unsubscribe = subscribeLive(itemId, {
      onFrame: (bmp) => {
        lastBmp.current = bmp;
        const c = canvasRef.current;
        if (c) drawLetterboxed(c, bmp);
        if (!gotFirst) {
          gotFirst = true;
          state.hasFrame = true;
          setHasFrame(true);
          emit();
        }
      },
      onStatus: (s) => {
        state.status = s;
        emit();
      },
      onMeta: (m) => {
        state.meta = m;
        emit();
      },
      onEnded: (snap) => {
        state.endedSnapshotId = snap;
        state.status = "ended";
        emit();
      },
    });

    // Repaint on resize (canvas backing store follows CSS size × DPR).
    const c = canvasRef.current;
    const ro =
      c && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (canvasRef.current && lastBmp.current) drawLetterboxed(canvasRef.current, lastBmp.current);
          })
        : null;
    if (c && ro) ro.observe(c);

    return () => {
      ro?.disconnect();
      unsubscribe();
      lastBmp.current = null;
    };
  }, [itemId]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Live view of the agent's browser"
      role="img"
      className={`block h-full w-full transition-opacity duration-500 ${hasFrame ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
