"use client";

// ============================================================================
// ActivityTimeline — typed web activity for one assistant turn
// (web_search → page_read → browser_task), rendered between the thinking
// block and the final answer. Driven entirely by protocol-v2 run items.
// ============================================================================

import { useState } from "react";
import {
  ChevronRight,
  CircleCheck,
  CircleX,
  FileText,
  LoaderCircle,
  Search,
} from "lucide-react";
import type { RunItem } from "@/lib/types";
import { domainOf, errorText, isTerminal } from "@/lib/run-items";
import { BrowserLiveCard } from "@/components/browser/browser-live-card";
import { SourceMonogram } from "@/components/chat/activity/sources";

interface ActivityTimelineProps {
  items: RunItem[];
  /** True when this is the newest assistant message and it is still streaming. */
  isStreaming: boolean;
  onStop?: () => void;
}

export function ActivityTimeline({ items, isStreaming, onStop }: ActivityTimelineProps) {
  if (!items || items.length === 0) return null;

  // Only ONE live socket at a time: the newest in-progress live browser item.
  const liveId = isStreaming
    ? [...items].reverse().find((i) => i.kind === "browser_task" && i.status === "in_progress" && i.data?.live)?.id
    : undefined;

  return (
    <div className="space-y-2" id="web-activity">
      {items.map((item, idx) => {
        if (item.kind === "browser_task") {
          return (
            <div key={item.id} className="animate-content-in py-1">
              <BrowserLiveCard
                item={item}
                live={item.id === liveId}
                onStop={isStreaming ? onStop : undefined}
                defaultExpanded={isStreaming || !isTerminal(item)}
              />
            </div>
          );
        }
        const prev = items[idx - 1];
        const next = items[idx + 1];
        const connectTop = prev && prev.kind !== "browser_task";
        const connectBottom = next && next.kind !== "browser_task";
        return (
          <TimelineRow key={item.id} item={item} connectTop={!!connectTop} connectBottom={!!connectBottom} />
        );
      })}
    </div>
  );
}

// ── Rows for lightweight items ─────────────────────────────────────────

function StatusGlyph({ item }: { item: RunItem }) {
  if (item.status === "in_progress" || item.status === "queued") {
    return <LoaderCircle size={11} className="animate-spin text-[var(--color-accent-blue)]" />;
  }
  if (item.status === "completed") return <CircleCheck size={11} className="text-emerald-400/80" />;
  return <CircleX size={11} className="text-rose-400/70" />;
}

function TimelineRow({
  item,
  connectTop,
  connectBottom,
}: {
  item: RunItem;
  connectTop: boolean;
  connectBottom: boolean;
}) {
  const [open, setOpen] = useState(false);
  const running = !isTerminal(item);
  const failed = item.status === "failed" || item.status === "cancelled";
  const isSearch = item.kind === "web_search";
  const Icon = isSearch ? Search : FileText;

  const query = String(item.args?.query ?? "");
  const url = String(item.args?.url ?? item.data?.url ?? "");
  const title = isSearch
    ? running
      ? "Searching the web"
      : failed
        ? "Search failed"
        : "Searched the web"
    : running
      ? "Reading page"
      : failed
        ? "Couldn't read page"
        : "Read page";

  const subtitle = isSearch ? (query ? `“${query}”` : "") : item.data?.title || domainOf(url) || url;
  const results = item.sources ?? [];
  const expandable = (isSearch && results.length > 0) || failed;

  return (
    <div className="animate-activity-step relative flex gap-3">
      {/* Rail */}
      <div className="relative flex w-6 shrink-0 justify-center">
        {connectTop && <span className="absolute top-0 h-2 w-px bg-white/[0.08]" />}
        {connectBottom && <span className="absolute top-8 bottom-[-8px] w-px bg-white/[0.08]" />}
        <span
          className={`relative z-[1] mt-1.5 flex h-6 w-6 items-center justify-center rounded-lg border ${
            running
              ? "border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/10"
              : failed
                ? "border-rose-400/20 bg-rose-500/[0.06]"
                : "border-white/[0.08] bg-white/[0.04]"
          }`}
        >
          <Icon
            size={12}
            className={running ? "text-[var(--color-accent-blue)]" : failed ? "text-rose-300/70" : "text-white/55"}
          />
        </span>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1 py-1">
        <button
          type="button"
          onClick={() => expandable && setOpen((v) => !v)}
          className={`group flex w-full min-w-0 items-center gap-2 text-left ${expandable ? "cursor-pointer" : "cursor-default"}`}
          aria-expanded={expandable ? open : undefined}
          id={`activity-row-${item.id}`}
        >
          <StatusGlyph item={item} />
          <span className={`shrink-0 text-[12.5px] font-medium ${running ? "shimmer" : "text-white/70"}`}>
            {title}
          </span>
          {subtitle && <span className="min-w-0 truncate text-[12.5px] text-white/40">{subtitle}</span>}
          {isSearch && !running && results.length > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              <span className="flex -space-x-1">
                {results.slice(0, 4).map((s) => (
                  <span key={s.id} className="rounded-[6px] ring-2 ring-[var(--color-bg-primary,#0b0e14)]">
                    <SourceMonogram url={s.url} size={14} />
                  </span>
                ))}
              </span>
              <span className="text-[11px] tabular-nums text-white/35">{results.length}</span>
            </span>
          )}
          {expandable && (
            <ChevronRight
              size={12}
              className={`shrink-0 text-white/30 transition-transform group-hover:text-white/60 ${
                open ? "rotate-90" : ""
              } ${isSearch && results.length > 0 ? "" : "ml-auto"}`}
            />
          )}
        </button>

        {!isSearch && !running && !failed && url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/30 transition-colors hover:text-[var(--color-accent-blue)]"
          >
            <SourceMonogram url={url} size={12} />
            <span className="truncate">{domainOf(url)}</span>
          </a>
        )}

        {open && failed && (
          <p className="mt-1.5 text-[11.5px] text-rose-300/70">{errorText(item.error_code, item.error)}</p>
        )}

        {open && isSearch && results.length > 0 && (
          <ul className="mt-2 space-y-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1.5 animate-content-in">
            {results.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="mt-0.5 w-4 shrink-0 text-right text-[10px] font-semibold tabular-nums text-white/30">
                    {s.id}
                  </span>
                  <SourceMonogram url={s.url} size={15} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-white/75">{s.title || s.url}</span>
                    <span className="block truncate text-[10.5px] text-white/35">
                      {s.domain || domainOf(s.url)}
                      {s.snippet ? ` — ${s.snippet}` : ""}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
