"use client";

// ============================================================================
// Calendar Page — Port of calendar_screen.dart
// Premium Apple Calendar-inspired design with monthly grid + event detail
// ============================================================================

import { useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Clock,
  Repeat,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  useCalendarStore,
  getEventsForDate,
  getEventMap,
  type CalendarEvent,
} from "@/stores/calendar-store";

// ── Category Styling ──────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  work: "#00BCD4",
  meeting: "#00BCD4",
  personal: "#7C4DFF",
  health: "#66BB6A",
  reminder: "#FFB74D",
  task: "#42A5F5",
  event: "#26A69A",
  general: "#78909C",
};

function colorFor(category: string): string {
  return CATEGORY_COLORS[category] || "#78909C";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const {
    events,
    selectedDate,
    focusedMonth,
    isLoading,
    selectDate,
    setFocusedMonth,
    loadMonth,
  } = useCalendarStore();

  // Load events for the focused month on mount
  useEffect(() => {
    loadMonth(focusedMonth);
  }, [loadMonth, focusedMonth]);

  const eventMap = useMemo(() => getEventMap(events), [events]);
  const selectedEvents = useMemo(
    () => getEventsForDate(events, selectedDate),
    [events, selectedDate]
  );

  const goToToday = () => {
    const now = new Date();
    selectDate(now);
    setFocusedMonth(now);
  };

  const prevMonth = () => {
    const d = new Date(focusedMonth);
    d.setMonth(d.getMonth() - 1);
    setFocusedMonth(d);
  };

  const nextMonth = () => {
    const d = new Date(focusedMonth);
    d.setMonth(d.getMonth() + 1);
    setFocusedMonth(d);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#26A69A] to-[#00BCD4] flex items-center justify-center">
            <CalendarDays size={15} className="text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Calendar</h1>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 rounded-lg text-[#00BCD4] text-sm font-semibold hover:bg-[#00BCD4]/10 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="mx-4 mt-4 mb-2 rounded-2xl bg-white/[0.03] border border-white/[0.04] overflow-hidden">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-white font-semibold text-[15px] tracking-tight">
            {MONTHS[focusedMonth.getMonth()]} {focusedMonth.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day of Week Headers */}
        <div className="grid grid-cols-7 border-b border-white/[0.04]">
          {DAYS.map((day) => (
            <div key={day} className="py-2 text-center text-white/30 text-[11px] font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Date Grid */}
        <CalendarGrid
          focusedMonth={focusedMonth}
          selectedDate={selectedDate}
          eventMap={eventMap}
          onSelectDate={selectDate}
        />
      </div>

      {/* Selected Day Events */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex items-center gap-2 mb-3 mt-2">
          <h3 className="text-white/50 text-xs font-semibold uppercase tracking-wider">
            {formatDateHeading(selectedDate)}
          </h3>
          {isLoading && (
            <div className="w-3 h-3 border border-[#00BCD4] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {selectedEvents.length === 0 ? (
          <EmptyDay date={selectedDate} />
        ) : (
          <div className="space-y-2.5">
            {selectedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar Grid Component ─────────────────────────────────────────────
function CalendarGrid({
  focusedMonth,
  selectedDate,
  eventMap,
  onSelectDate,
}: {
  focusedMonth: Date;
  selectedDate: Date;
  eventMap: Map<string, CalendarEvent[]>;
  onSelectDate: (date: Date) => void;
}) {
  const cells = useMemo(() => {
    const year = focusedMonth.getFullYear();
    const month = focusedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    // Monday = 0, Sunday = 6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null; day: number }> = [];

    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: null, day: 0 });
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), day: d });
    }
    return cells;
  }, [focusedMonth]);

  const today = new Date();

  return (
    <div className="grid grid-cols-7">
      {cells.map((cell, i) => {
        if (!cell.date) {
          return <div key={`empty-${i}`} className="py-2" />;
        }
        const d = cell.date;
        const isToday = isSameDay(d, today);
        const isSelected = isSameDay(d, selectedDate);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const dayEvents = eventMap.get(key) || [];
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        return (
          <button
            key={key}
            onClick={() => onSelectDate(d)}
            className="py-2 flex flex-col items-center gap-1 transition-colors hover:bg-white/[0.04] relative"
          >
            <span
              className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all ${
                isSelected
                  ? "bg-gradient-to-br from-[#00BCD4] to-[#7C4DFF] text-white font-bold"
                  : isToday
                  ? "ring-2 ring-[#00BCD4] text-white font-bold"
                  : isWeekend
                  ? "text-white/35"
                  : "text-white/70"
              }`}
            >
              {cell.day}
            </span>
            {/* Event dots */}
            {dayEvents.length > 0 && (
              <div className="flex gap-0.5">
                {dayEvents.slice(0, 3).map((e, ei) => (
                  <span
                    key={ei}
                    className="w-[5px] h-[5px] rounded-full"
                    style={{ backgroundColor: colorFor(e.category) }}
                  />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Event Card ──────────────────────────────────────────────────────────
function EventCard({ event }: { event: CalendarEvent }) {
  const color = colorFor(event.category);
  const timeStr = event.all_day ? "All Day" : formatTime(new Date(event.start));
  const hasEnd = event.end && !event.all_day;
  const endStr = hasEnd ? ` – ${formatTime(new Date(event.end!))}` : "";

  return (
    <div className="flex rounded-[14px] bg-white/[0.03] border border-white/[0.04] overflow-hidden hover:bg-white/[0.05] transition-colors">
      {/* Left color strip */}
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />

      {/* Content */}
      <div className="flex-1 px-4 py-3.5">
        {/* Time row */}
        <div className="flex items-center gap-2 mb-1.5">
          <Clock size={12} style={{ color }} />
          <span className="text-xs font-semibold" style={{ color }}>
            {timeStr}{endStr}
          </span>
          {event.recurring && (
            <Repeat size={12} className="text-white/25 ml-auto" />
          )}
        </div>

        {/* Title */}
        <p className="text-white font-semibold text-[15px] leading-tight tracking-tight">
          {event.title}
        </p>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <MapPin size={11} className="text-white/25" />
            <span className="text-white/30 text-xs truncate">{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-white/25 text-xs mt-1.5 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Source badge */}
        {event.source && event.source !== "local" && (
          <span className="inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-medium text-white/20 bg-white/[0.04] border border-white/[0.06]">
            {event.source}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Empty Day ───────────────────────────────────────────────────────────
function EmptyDay({ date }: { date: Date }) {
  const isToday = isSameDay(date, new Date());
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <CalendarIcon size={28} className="text-white/15" />
      </div>
      <p className="text-white/30 text-sm font-medium">
        {isToday ? "No events today" : "No events"}
      </p>
      <p className="text-white/15 text-xs mt-1">
        {isToday ? "Your schedule is clear!" : formatDateFull(date)}
      </p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(dt: Date): string {
  const h = dt.getHours();
  const m = String(dt.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function formatDateHeading(dt: Date): string {
  const today = new Date();
  if (isSameDay(dt, today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(dt, yesterday)) return "Yesterday";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(dt, tomorrow)) return "Tomorrow";
  return formatDateFull(dt);
}

function formatDateFull(dt: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${days[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}
