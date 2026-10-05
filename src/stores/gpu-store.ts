// ============================================================================
// Sphere AI — GPU Status Store (Zustand)
// Server: GET /gpu/status → { llama_loaded, nas_processing, active_sessions, gpu_state }
//
// One shared poller for every consumer (sidebar badge, chat warm-up banner).
// - Ref-counted: polling runs only while at least one component is subscribed
// - Pauses while the tab is hidden, refreshes immediately when it returns
// - Polls faster while the model is warming up so the banner clears promptly
// ============================================================================

import { useEffect } from "react";
import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { GpuStatus } from "@/lib/types";

const NORMAL_INTERVAL_MS = 15_000;
const WARMING_INTERVAL_MS = 4_000;

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
    const warming = get().status?.gpu_state === "swapping_to_ai";
    timer = setTimeout(async () => {
      await get().refresh();
      schedule();
    }, warming ? WARMING_INTERVAL_MS : NORMAL_INTERVAL_MS);
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
