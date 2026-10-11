"use client";

// ============================================================================
// BrowserLiveCard — inline card inside the assistant message for a
// browser_task item. Fixed 16:9 viewport so streaming never shifts layout.
//   • live (in progress + server says live + newest streaming message):
//       canvas fed by the shared frame source
//   • otherwise: static step/final snapshot <img>
// Expand opens the full-screen overlay on the same frame source.
// ============================================================================

import { useCallback, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  Globe,
  Hourglass,
  ListTree,
  LoaderCircle,
  Maximize2,
  MousePointerClick,
  Square,
} from "lucide-react";
import type { RunItem } from "@/lib/types";
import { domainOf, errorText } from "@/lib/run-items";
import { useAutoScrollPause } from "@/lib/scroll-pause";
import { LiveCanvas, type LiveFeedState } from "@/components/browser/live-canvas";
import { FinalSnapshot } from "@/components/browser/final-snapshot";
import { AgentViewList } from "@/components/browser/agent-view-list";
import { BrowserOverlay } from "@/components/browser/browser-overlay";
import { AddressBar, LiveBadge, PHASE_LABEL } from "@/components/browser/browser-chrome";

interface BrowserLiveCardProps {
  item: RunItem;
  /** Parent decides: item in progress, data.live, and this is the newest streaming message. */
  live: boolean;
  onStop?: () => void;
  defaultExpanded?: boolean;
}

export function BrowserLiveCard({ item, live, onStop, defaultExpanded = true }: BrowserLiveCardProps) {
  const [feed, setFeed] = useState<LiveFeedState | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [agentView, setAgentView] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const onState = useCallback((s: LiveFeedState) => setFeed(s), []);
  const hoverPause = useAutoScrollPause();

  const d = item.data ?? {};
  const running = item.status === "in_progress" || item.status === "queued";
  const isLive = live && feed?.status !== "ended";
  const url = feed?.meta.url || d.url || d.final_url;
  const step = feed?.meta.step ?? d.step ?? d.steps_taken ?? 0;
  const snapshotId = feed?.endedSnapshotId || d.final_snapshot_id || d.snapshot_id;
  const actions = (d.actions ?? []).slice(-4);
  const visitedCount = d.visited?.length ?? 0;

  const headline = running
    ? PHASE_LABEL[d.phase ?? ""] ?? "Browsing"
    : item.status === "completed"
      ? d.success === false
        ? "Browsing finished with issues"
        : "Browsed the web"
      : item.status === "cancelled"
        ? "Browsing stopped"
        : "Browsing failed";

  const StatusIcon = running
    ? item.status === "queued"
      ? Hourglass
      : LoaderCircle
    : item.status === "completed" && d.success !== false
      ? CircleCheck
      : CircleX;

  return (
    <div
      id={`browser-card-${item.id}`}
      className={`overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.035] to-white/[0.015] shadow-lg shadow-black/20 transition-colors ${
        isLive ? "border-[var(--color-accent-blue)]/25" : "border-white/[0.08]"
      }`}
      {...hoverPause}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            running ? "bg-[var(--color-accent-blue)]/15" : "bg-white/[0.05]"
          }`}
        >
          <Globe size={14} className={running ? "text-[var(--color-accent-blue)]" : "text-white/50"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusIcon
              size={12}
              className={`shrink-0 ${
                running
                  ? `text-[var(--color-accent-blue)] ${item.status === "in_progress" ? "animate-spin" : ""}`
                  : item.status === "completed" && d.success !== false
                    ? "text-emerald-400"
                    : "text-rose-400/80"
              }`}
            />
            <span className={`truncate text-[13px] font-medium ${running ? "shimmer" : "text-white/80"}`}>
              {headline}
            </span>
            {isLive && <LiveBadge status={feed?.status ?? "connecting"} />}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-white/35">
            {item.status === "queued" && d.queue_position
              ? `#${d.queue_position} in queue — one browser runs at a time on this server`
              : [
                  step ? `Step ${step}${d.max_steps ? ` of ${d.max_steps}` : ""}` : null,
                  visitedCount ? `${visitedCount} page${visitedCount === 1 ? "" : "s"}` : null,
                  !running && domainOf(url) ? domainOf(url) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Preparing…"}
          </div>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-0.5">
          {isLive && (
            <button
              id={`browser-card-agentview-${item.id}`}
              onClick={() => setAgentView((v) => !v)}
              className={`rounded-lg p-1.5 transition-colors ${
                agentView
                  ? "bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)]"
                  : "text-white/40 hover:bg-white/[0.06] hover:text-white/75"
              }`}
              title="Agent's view — elements the agent can see"
            >
              <ListTree size={14} />
            </button>
          )}
          {expanded && (isLive || snapshotId) && (
            <button
              id={`browser-card-expand-${item.id}`}
              onClick={() => setOverlay(true)}
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/75"
              title="Expand"
            >
              <Maximize2 size={14} />
            </button>
          )}
          {running && onStop && (
            <button
              id={`browser-card-stop-${item.id}`}
              onClick={onStop}
              className="rounded-lg p-1.5 text-rose-300/60 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
              title="Stop"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}
          {!running && (
            <button
              id={`browser-card-toggle-${item.id}`}
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/75"
              title={expanded ? "Collapse" : "Show browser"}
            >
              <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {/* ── Address bar ── */}
          <div className="px-3.5 pb-2">
            <AddressBar url={url} sandboxed={d.sandboxed} />
          </div>

          {/* ── Viewport (fixed 16:9) ── */}
          <div className="px-3.5">
            <div
              className="browser-grid relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#07090d]"
              onDoubleClick={() => (isLive || snapshotId) && setOverlay(true)}
            >
              {isLive ? (
                <LiveCanvas itemId={item.id} onState={onState} />
              ) : snapshotId ? (
                <FinalSnapshot snapshotId={snapshotId} alt={`Page the agent ended on: ${d.title || url || ""}`} />
              ) : null}

              {/* Pre-first-frame / queued / no-snapshot state */}
              {((isLive && !feed?.hasFrame) || (!isLive && !snapshotId)) && (
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden ${
                    running ? "browser-scan" : ""
                  }`}
                >
                  {running ? (
                    <>
                      <Globe size={22} strokeWidth={1.4} className="text-[var(--color-accent-blue)]/50" />
                      <span className="text-[12px] text-white/40">
                        {item.status === "queued"
                          ? "Waiting for a free browser…"
                          : `${PHASE_LABEL[d.phase ?? ""] ?? "Connecting"}…`}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] text-white/25">No preview available</span>
                  )}
                </div>
              )}

              {/* Agent's view drawer over the viewport */}
              {isLive && agentView && (
                <AgentViewList
                  itemId={item.id}
                  className="absolute inset-y-0 right-0 w-[min(320px,55%)] border-l border-white/[0.08] bg-[#0a0d13]/95 backdrop-blur-sm animate-content-in"
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Goal + recent actions ── */}
      <div className="space-y-1.5 px-3.5 pt-2.5 pb-3">
        {d.goal && expanded && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-white/45">
            <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">Goal</span>
            {d.goal}
          </p>
        )}
        {actions.length > 0 && expanded && (
          <ul className="space-y-1">
            {actions.map((a, i) => {
              const latest = running && i === actions.length - 1;
              return (
                <li
                  key={`${step}-${i}-${a.label}`}
                  className="animate-activity-step flex items-center gap-2 text-[12px]"
                >
                  <MousePointerClick
                    size={11}
                    className={latest ? "text-[var(--color-accent-blue)]" : "text-white/25"}
                  />
                  <span className={`truncate ${latest ? "text-white/75" : "text-white/40"}`}>{a.label}</span>
                </li>
              );
            })}
          </ul>
        )}
        {(item.status === "failed" || (item.status === "completed" && d.success === false)) && (
          <p className="flex items-center gap-1.5 text-[12px] text-rose-300/80">
            <CircleX size={12} />
            {errorText(item.error_code, item.error)}
          </p>
        )}
      </div>

      {overlay && (
        <BrowserOverlay item={item} live={isLive} onClose={() => setOverlay(false)} onStop={onStop} />
      )}
    </div>
  );
}
