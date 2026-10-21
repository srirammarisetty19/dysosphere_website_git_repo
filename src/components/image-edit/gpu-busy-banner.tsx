"use client";

// ============================================================================
// GPU Busy Banner — "🎨 AI is busy creating an image · chat resumes in ~12 s"
//
// Shown while an AI image edit owns the GPU. Sources (first wins):
//   1. Live `gpu_wait` SSE event for the reply being generated (chat-store)
//   2. GET /gpu/status polling (gpu-store) — image_busy + eta_seconds
// The ETA counts down locally every second between server updates.
// ============================================================================

import { Palette } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { isImageBusy, useEtaCountdown, useGpuStatus, useGpuStore } from "@/stores/gpu-store";

interface GpuBusyBannerProps {
  /** "bar" = above the input, "inline" = inside the assistant bubble */
  variant?: "bar" | "inline";
  /** Only show while a chat reply is actually waiting (gpu_wait) */
  onlyWhenWaiting?: boolean;
  className?: string;
}

export function GpuBusyBanner({ variant = "bar", onlyWhenWaiting = false, className = "" }: GpuBusyBannerProps) {
  const gpuWait = useChatStore((s) => s.gpuWait);
  const status = useGpuStatus();
  const lastUpdated = useGpuStore((s) => s.lastUpdated);
  const busy = isImageBusy(status);

  const fromStream = variant === "inline" && gpuWait != null;
  const eta = fromStream ? gpuWait.etaSeconds : status?.eta_seconds ?? null;
  const receivedAt = fromStream ? gpuWait.receivedAt : lastUpdated;
  const remaining = useEtaCountdown(eta, receivedAt);

  // The bar yields to the inline banner while a reply is actively waiting
  if (variant === "bar" && gpuWait != null) return null;
  if (!fromStream && (onlyWhenWaiting || !busy)) return null;

  const queue = status?.image_queue_length ?? 0;
  const etaText =
    remaining == null
      ? "chat resumes shortly"
      : remaining <= 1
        ? "chat resumes any moment"
        : `chat resumes in ~${remaining < 60 ? `${remaining} s` : `${Math.ceil(remaining / 60)} min`}`;

  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`img-edit-glow inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.03] ${className}`}
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-lg img-edit-gradient shrink-0">
          <Palette size={13} className="text-white" />
          <span className="absolute inset-0 rounded-lg img-edit-gradient opacity-60 animate-ping" />
        </span>
        <span className="text-[13px] text-white/80">
          AI is busy creating an image
          <span className="text-white/45"> · {etaText}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`img-edit-glow mb-2.5 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#7C4DFF]/[0.06] animate-in ${className}`}
    >
      <span className="relative flex h-5 w-5 items-center justify-center rounded-md img-edit-gradient shrink-0">
        <Palette size={11} className="text-white" />
      </span>
      <span className="text-xs text-white/75 flex-1 min-w-0 truncate">
        🎨 AI is busy creating an image · <span className="text-white/50">{etaText}</span>
      </span>
      {queue > 1 && (
        <span className="text-[10px] text-white/40 font-mono shrink-0">{queue} in queue</span>
      )}
    </div>
  );
}
