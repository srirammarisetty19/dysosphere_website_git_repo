"use client";

// ============================================================================
// LiveCanvas — paints live browser frames onto a <canvas> through a ref.
// Frames bypass React entirely; only low-frequency status/meta changes
// (connect, page navigation, ended) become state.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  drawLetterboxed,
  sendLive,
  setLiveMode,
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
  /** Enable interactive mouse/wheel/keyboard forwarding (control-mode takeover). */
  interactive?: boolean;
  /** Called on status/meta/ended changes (not per frame). */
  onState?: (s: LiveFeedState) => void;
}

function mapCanvasPointToViewport(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  bmp: ImageBitmap | null,
  viewport?: { width: number; height: number },
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const vw = viewport?.width || bmp?.width || 1280;
  const vh = viewport?.height || bmp?.height || 800;
  const imgW = bmp?.width || vw;
  const imgH = bmp?.height || vh;

  const scale = Math.min(rect.width / imgW, rect.height / imgH);
  if (!Number.isFinite(scale) || scale <= 0) return null;

  const dw = imgW * scale;
  const dh = imgH * scale;
  const ox = (rect.width - dw) / 2;
  const oy = (rect.height - dh) / 2;

  const relX = (clientX - rect.left - ox) / dw;
  const relY = (clientY - rect.top - oy) / dh;
  if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;

  return {
    x: Math.round(relX * vw),
    y: Math.round(relY * vh),
  };
}

function modifiersMask(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): number {
  return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

export function LiveCanvas({ itemId, className = "", interactive = false, onState }: LiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastBmp = useRef<ImageBitmap | null>(null);
  const metaRef = useRef<LiveMeta>({});
  const onStateRef = useRef(onState);
  const [hasFrame, setHasFrame] = useState(false);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useEffect(() => {
    if (interactive) {
      setLiveMode(itemId, "control");
      canvasRef.current?.focus();
    }
  }, [itemId, interactive]);

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
        metaRef.current = m;
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
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Interactive remote browser view" : "Live view of the agent's browser"}
      role={interactive ? "application" : "img"}
      onMouseDown={
        interactive
          ? (e) => {
              canvasRef.current?.focus();
              const pt = canvasRef.current
                ? mapCanvasPointToViewport(canvasRef.current, e.clientX, e.clientY, lastBmp.current, metaRef.current.viewport)
                : null;
              if (!pt) return;
              const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
              sendLive(itemId, {
                type: "mouse",
                eventType: "mousePressed",
                x: pt.x,
                y: pt.y,
                button,
                clickCount: 1,
                modifiers: modifiersMask(e),
              });
            }
          : undefined
      }
      onMouseUp={
        interactive
          ? (e) => {
              const pt = canvasRef.current
                ? mapCanvasPointToViewport(canvasRef.current, e.clientX, e.clientY, lastBmp.current, metaRef.current.viewport)
                : null;
              if (!pt) return;
              const button = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
              sendLive(itemId, {
                type: "mouse",
                eventType: "mouseReleased",
                x: pt.x,
                y: pt.y,
                button,
                clickCount: 1,
                modifiers: modifiersMask(e),
              });
            }
          : undefined
      }
      onMouseMove={
        interactive
          ? (e) => {
              const pt = canvasRef.current
                ? mapCanvasPointToViewport(canvasRef.current, e.clientX, e.clientY, lastBmp.current, metaRef.current.viewport)
                : null;
              if (!pt) return;
              sendLive(itemId, {
                type: "mouse",
                eventType: "mouseMoved",
                x: pt.x,
                y: pt.y,
                button: e.buttons & 1 ? "left" : "none",
                modifiers: modifiersMask(e),
              });
            }
          : undefined
      }
      onWheel={
        interactive
          ? (e) => {
              const pt = canvasRef.current
                ? mapCanvasPointToViewport(canvasRef.current, e.clientX, e.clientY, lastBmp.current, metaRef.current.viewport)
                : null;
              if (!pt) return;
              sendLive(itemId, {
                type: "mouse",
                eventType: "mouseWheel",
                x: pt.x,
                y: pt.y,
                deltaX: e.deltaX,
                deltaY: e.deltaY,
                modifiers: modifiersMask(e),
              });
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              e.stopPropagation();
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                sendLive(itemId, { type: "insert_text", text: e.key });
                return;
              }
              if (["Tab", "Backspace", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();
              }
              sendLive(itemId, {
                type: "key",
                eventType: "keyDown",
                key: e.key,
                code: e.code,
                keyCode: e.keyCode,
                modifiers: modifiersMask(e),
              });
            }
          : undefined
      }
      onKeyUp={
        interactive
          ? (e) => {
              e.stopPropagation();
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) return;
              sendLive(itemId, {
                type: "key",
                eventType: "keyUp",
                key: e.key,
                code: e.code,
                keyCode: e.keyCode,
                modifiers: modifiersMask(e),
              });
            }
          : undefined
      }
      onPaste={
        interactive
          ? (e) => {
              const pasted = e.clipboardData?.getData("text");
              if (pasted) {
                e.preventDefault();
                sendLive(itemId, { type: "insert_text", text: pasted.slice(0, 1024) });
              }
            }
          : undefined
      }
      className={`block h-full w-full transition-opacity duration-500 outline-none ${
        interactive ? "cursor-pointer" : ""
      } ${hasFrame ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
