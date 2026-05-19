// ============================================================================
// Sphere AI — Calendar Store (Zustand)
// Port of calendar_provider.dart
// ============================================================================

import { create } from "zustand";
import { apiClient } from "@/lib/api-client";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string | null;
  category: string;
  all_day: boolean;
  recurring: boolean;
  location: string;
  source: string;
}

interface CalendarState {
  events: CalendarEvent[];
  selectedDate: Date;
  focusedMonth: Date;
  isLoading: boolean;
  error: string | null;
  // Cache: "YYYY-MM" → events
  cache: Record<string, CalendarEvent[]>;

  // Actions
  loadMonth: (date: Date) => Promise<void>;
  selectDate: (date: Date) => void;
  setFocusedMonth: (date: Date) => void;
  refresh: () => Promise<void>;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  events: [],
  selectedDate: new Date(),
  focusedMonth: new Date(),
  isLoading: false,
  error: null,
  cache: {},

  loadMonth: async (date: Date) => {
    const key = monthKey(date);
    const { cache } = get();

    // Use cache if available
    if (cache[key]) {
      set({ events: cache[key] });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.getCalendarEvents(
        date.getFullYear(),
        date.getMonth() + 1
      );
      const events = data.events || [];
      set((state) => ({
        events,
        isLoading: false,
        cache: { ...state.cache, [key]: events },
      }));
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load events",
      });
    }
  },

  selectDate: (date: Date) => {
    set({ selectedDate: date });
  },

  setFocusedMonth: (date: Date) => {
    set({ focusedMonth: date });
    get().loadMonth(date);
  },

  refresh: async () => {
    const { focusedMonth } = get();
    const key = monthKey(focusedMonth);
    // Clear cache for current month
    set((state) => {
      const newCache = { ...state.cache };
      delete newCache[key];
      return { cache: newCache };
    });
    await get().loadMonth(focusedMonth);
  },
}));

// Selectors
export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter((e) => {
    const eventDate = new Date(e.start);
    return isSameDay(eventDate, date);
  });
}

export function getEventMap(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const d = new Date(event.start);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const list = map.get(key) || [];
    list.push(event);
    map.set(key, list);
  }
  return map;
}
