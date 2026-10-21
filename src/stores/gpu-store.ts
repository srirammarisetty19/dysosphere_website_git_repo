// ============================================================================
// Sphere AI — GPU Status Store (Zustand)
// Server: GET /gpu/status → { llama_loaded, nas_processing, active_sessions, gpu_state }
//
// One shared poller for every consumer (sidebar badge, chat warm-up banner).
// - Ref-counted: polling runs only while at least one component is subscribed
// - Pauses while the tab is hidden, refreshes immediately when it returns
// - Polls faster while the model is warming up so the banner clears promptly
// - Polls every 3 s while an AI image edit owns the GPU (chat ETA banner)
// ============================================================================

import { useEffect, useState } from "react";
import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { GpuStatus } from "@/lib/types";

const NORMAL_INTERVAL_MS = 15_000;
const WARMING_INTERVAL_MS = 4_000;
const IMAGE_BUSY_INTERVAL_MS = 3_000;

const IMAGE_GPU_STATES = new Set(["draining_for_image", "swapping_to_image", "image_ready"]);

/** True only while an AI image edit is actually queued / running / loading. */
export function isImageBusy(status: GpuStatus | null | undefined): boolean {
  if (!status) return false;
  // Server sends image_busy=false while the image engine merely lingers idle
  // after an edit — that must not show "AI is busy creating an image".
  if (typeof status.image_busy === "boolean") return status.image_busy;
  return IMAGE_GPU_STATES.has(String(status.gpu_state)); // older servers
}

interface GpuStoreState {
  status: GpuStatus | null; // null = unknown / endpoint unavailable
  lastUpdated: number | null;
  refresh: () => Promise<void>;
  /** Start polling for a consumer. Returns an unsubscribe function. */
  subscribe: () => () => void;
}

let subscribers = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let visibilityHandler: (() => void) | null = null;
let inFlight = false;

export const useGpuStore = create<GpuStoreState>()((set, get) => {
  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (subscribers === 0) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const status = get().status;
    const warming = status?.gpu_state === "swapping_to_ai";
    const delay = isImageBusy(status)
      ? IMAGE_BUSY_INTERVAL_MS
      : warming
        ? WARMING_INTERVAL_MS
        : NORMAL_INTERVAL_MS;
    timer = setTimeout(async () => {
      await get().refresh();
      schedule();
    }, delay);
  };

  return {
    status: null,
    lastUpdated: null,

    refresh: async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const status = await apiClient.getGpuStatus();
        set({ status, lastUpdated: Date.now() });
      } catch {
        // Endpoint unavailable → hide GPU UI rather than show stale state
        set({ status: null, lastUpdated: Date.now() });
      } finally {
        inFlight = false;
      }
    },

    subscribe: () => {
      subscribers += 1;
      if (subscribers === 1) {
        get().refresh().then(schedule);
        if (typeof document !== "undefined") {
          visibilityHandler = () => {
            if (document.visibilityState === "visible") {
              get().refresh().then(schedule);
            } else if (timer) {
              clearTimeout(timer);
              timer = null;
            }
          };
          document.addEventListener("visibilitychange", visibilityHandler);
        }
      }
      return () => {
        subscribers = Math.max(0, subscribers - 1);
        if (subscribers === 0) {
          if (timer) clearTimeout(timer);
          timer = null;
          if (visibilityHandler && typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", visibilityHandler);
          }
          visibilityHandler = null;
        }
      };
    },
  };
});

/** Subscribe a component to GPU status polling and return the latest status. */
export function useGpuStatus(): GpuStatus | null {
  const status = useGpuStore((s) => s.status);
  const subscribe = useGpuStore((s) => s.subscribe);
  useEffect(() => subscribe(), [subscribe]);
  return status;
}

/** True only when the server reports AI image editing is enabled (hidden on older servers). */
export function useImageEditEnabled(): boolean {
  const status = useGpuStatus();
  return status?.image_edit_enabled === true;
}

/**
 * Smooth 1 s countdown from a server ETA. Returns null when there is no ETA.
 * `receivedAt` should change whenever a fresh ETA arrives.
 */
export function useEtaCountdown(etaSeconds: number | null | undefined, receivedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  const active = etaSeconds != null && receivedAt != null;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  const elapsed = Math.max(0, (now - receivedAt!) / 1000);
  return Math.max(0, Math.round(etaSeconds! - elapsed));
}
