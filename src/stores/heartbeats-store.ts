// ============================================================================
// Sphere AI — Heartbeats Store (Zustand)
// Port of heartbeats_sheet.dart / heartbeat provider
// ============================================================================

import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import type { Heartbeat } from "@/lib/types";

interface HeartbeatsState {
  heartbeats: Heartbeat[];
  isLoading: boolean;
  error: string | null;

  // Actions
  load: () => Promise<void>;
  create: (data: { name: string; prompt: string; schedule: string; type?: string }) => Promise<void>;
  update: (id: string, data: Partial<Heartbeat>) => Promise<void>;
  toggle: (id: string, enabled: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHeartbeatsStore = create<HeartbeatsState>()((set, get) => ({
  heartbeats: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const heartbeats = await apiClient.getHeartbeats();
      set({ heartbeats, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load reminders",
      });
    }
  },

  create: async (data) => {
    set({ error: null });
    try {
      const heartbeat = await apiClient.createHeartbeat(data);
      set((state) => ({ heartbeats: [...state.heartbeats, heartbeat] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create reminder" });
      throw err;
    }
  },

  update: async (id, data) => {
    try {
      await apiClient.updateHeartbeat(id, data);
      // Reload to get fresh data
      await get().load();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update reminder" });
      throw err;
    }
  },

  toggle: async (id, enabled) => {
    // Optimistic update
    set((state) => ({
      heartbeats: state.heartbeats.map((h) =>
        h.id === id ? { ...h, enabled } : h
      ),
    }));
    try {
      await apiClient.updateHeartbeat(id, { enabled } as Partial<Heartbeat>);
    } catch {
      // Revert on failure
      await get().load();
    }
  },

  remove: async (id) => {
    // Optimistic remove
    const prev = get().heartbeats;
    set({ heartbeats: prev.filter((h) => h.id !== id) });
    try {
      await apiClient.deleteHeartbeat(id);
    } catch {
      // Revert on failure
      set({ heartbeats: prev });
    }
  },
}));

// ── Cron helpers (ported from heartbeats_sheet.dart) ─────────────────
export function describeCron(schedule: string | undefined): string {
  if (!schedule) return "";

  // Biweekly
  if (schedule.startsWith("BW:")) {
    try {
      const inner = schedule.substring(3);
      const colonIdx = inner.lastIndexOf(":");
      const cron = colonIdx >= 0 ? inner.substring(0, colonIdx) : inner;
      return `Every 2 weeks · ${parseCronTime(cron)}`;
    } catch {
      return "Every 2 weeks";
    }
  }

  // Last weekday of month
  if (schedule.startsWith("L:")) {
    try {
      const cron = schedule.substring(2);
      return `Last weekday of month · ${parseCronTime(cron)}`;
    } catch {
      return "Last weekday of month";
    }
  }

  // Nth weekday (e.g. 0 9 * * 6#1)
  if (schedule.includes("#")) {
    try {
      const parts = schedule.split("#");
      const n = parseInt(parts[parts.length - 1]) || 1;
      const ordinals = ["", "1st", "2nd", "3rd", "4th"];
      const ordinal = n < ordinals.length ? ordinals[n] : `${n}th`;
      return `${ordinal} weekday of month · ${parseCronTime(parts[0])}`;
    } catch {
      return "Monthly";
    }
  }

  return parseCronTime(schedule);
}

function parseCronTime(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 2) return cron;

  const minute = parts[0];
  const hour = parts[1];
  const dow = parts.length >= 5 ? parts[4] : "*";

  const daysFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let dayLabel = "";
  if (dow !== "*") {
    const dowNum = parseInt(dow.split("#")[0]);
    if (!isNaN(dowNum) && dowNum >= 0 && dowNum <= 6) {
      dayLabel = ` · Every ${daysFull[dowNum]}`;
    }
  }

  if (hour.startsWith("*/")) return `Every ${hour.substring(2)} hours${dayLabel}`;
  if (minute.startsWith("*/")) return `Every ${minute.substring(2)} minutes`;

  const h = parseInt(hour.replace("*/", ""));
  const m = parseInt(minute.replace("*/", ""));
  if (isNaN(h) || isNaN(m)) return cron;

  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  return `${timeStr}${dayLabel}`;
}
