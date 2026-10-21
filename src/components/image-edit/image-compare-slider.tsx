"use client";

// ============================================================================
// Image Compare Slider — before/after drag reveal (pointer + keyboard)
// ============================================================================

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronsLeftRight } from "lucide-react";

interface ImageCompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  alt?: string;
  className?: string;
  /** Aspect ratio (w / h) to reserve space before images load */
  aspectRatio?: number;
  /** Show checkerboard behind the result (transparent PNGs) */
  checker?: boolean;
}

export function ImageCompareSlider({
  beforeSrc,
  afterSrc,
  alt = "Edited image",
  className = "",
  aspectRatio,
  checker = false,
}: ImageCompareSliderProps) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    update(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) update(e.clientX);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
    else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      className={`relative select-none overflow-hidden touch-none ${checker ? "img-edit-checker" : "bg-black/40"} ${className}`}
      style={aspectRatio ? { aspectRatio: String(aspectRatio) } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* After (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt={alt} draggable={false} className="block w-full h-full object-contain pointer-events-none" />
      {/* Before (clipped) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt="Original"
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-[#111]"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      {/* Labels */}
      <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/55 text-white/80 backdrop-blur-sm pointer-events-none">
        Before
      </span>
      <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/55 text-white/80 backdrop-blur-sm pointer-events-none">
        After
      </span>
      {/* Handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)] pointer-events-none"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare original and edited image"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKeyDown}
        className={`absolute top-1/2 h-9 w-9 -translate-y-1/2 -translate-x-1/2 rounded-full img-edit-gradient flex items-center justify-center shadow-lg shadow-black/40 ring-2 ring-white/80 cursor-ew-resize focus:outline-none focus-visible:ring-4 transition-transform ${dragging ? "scale-110" : "hover:scale-105"}`}
        style={{ left: `${pos}%` }}
      >
        <ChevronsLeftRight size={16} className="text-white" />
      </div>
    </div>
  );
}
