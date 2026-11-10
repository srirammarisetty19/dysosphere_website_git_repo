"use client";

// Full-screen live browser overlay. Reuses the SAME frame source as the
// inline card (no second socket). Esc / backdrop click closes.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CornerDownLeft, Eye, EyeOff, Hand, ListTree, Minimize2, Square, X } from "lucide-react";
import type { RunItem } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { sendLive, setLiveMode } from "@/components/browser/frame-source";
import { LiveCanvas, type LiveFeedState } from "@/components/browser/live-canvas";
import { FinalSnapshot } from "@/components/browser/final-snapshot";
import { AgentViewList } from "@/components/browser/agent-view-list";
import { AddressBar, LiveBadge, PHASE_LABEL } from "@/components/browser/browser-chrome";

interface BrowserOverlayProps {
  item: RunItem;
  live: boolean;
  initialInteractive?: boolean;
  onClose: () => void;
  onStop?: () => void;
}

export function BrowserOverlay({ item, live, initialInteractive = false, onClose, onStop }: BrowserOverlayProps) {
  const [feed, setFeed] = useState<LiveFeedState | null>(null);
  const [showAgentView, setShowAgentView] = useState(false);
  const [manualInteractive, setManualInteractive] = useState<boolean | null>(null);
  const [quickText, setQuickText] = useState("");
  const [maskQuickText, setMaskQuickText] = useState(true);
  const d = item.data ?? {};

  const interactive = Boolean(
    d.takeover || feed?.meta.takeover || (manualInteractive ?? initialInteractive),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !interactive) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, interactive]);

  const onState = useCallback((s: LiveFeedState) => setFeed(s), []);

  const isLive = live && feed?.status !== "ended";
  const url = feed?.meta.url || d.url || d.final_url;
  const step = feed?.meta.step ?? d.step;
  const snapshotId = feed?.endedSnapshotId || d.final_snapshot_id || d.snapshot_id;

  const startTakeover = async () => {
    try {
      await apiClient.startBrowserTakeover(item.id);
    } catch {
      /* may already be active */
    }
    setLiveMode(item.id, "control");
    setManualInteractive(true);
  };

  const finishTakeover = async (outcome: "completed" | "cancelled") => {
    setQuickText("");
    sendLive(item.id, { type: "takeover_done", outcome });
    try {
      await apiClient.completeBrowserTakeover(item.id, outcome);
    } catch {
      /* ignore */
    }
    setLiveMode(item.id, "view");
    setManualInteractive(false);
  };

  const sendQuickText = () => {
    if (!quickText) return;
    sendLive(item.id, { type: "insert_text", text: quickText });
    setQuickText("");
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md animate-modal-bg sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Agent browser"
      id={`browser-overlay-${item.id}`}
    >
      <div
        className="flex h-full max-h-[94vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0d13] shadow-2xl shadow-black/60 animate-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <div className="hidden gap-1.5 sm:flex" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <AddressBar url={url} sandboxed={d.sandboxed} className="min-w-0 flex-1" />
          {isLive && <LiveBadge status={feed?.status ?? "connecting"} />}
          {typeof step === "number" && step > 0 && (
            <span className="hidden text-[11px] tabular-nums text-white/40 md:inline">
              Step {step}
              {d.max_steps ? ` / ${d.max_steps}` : ""}
            </span>
          )}
          {isLive && !interactive && (
            <button
              id={`browser-overlay-takeover-${item.id}`}
              onClick={startTakeover}
              className="flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-1.5 text-[12px] font-medium text-amber-200 transition-colors hover:bg-amber-400/25"
              title="Pause the agent and interact with the page directly"
            >
              <Hand size={14} />
              <span className="hidden sm:inline">Take Control</span>
            </button>
          )}
          {isLive && (
            <button
              id={`browser-overlay-agentview-${item.id}`}
              onClick={() => setShowAgentView((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
                showAgentView
                  ? "bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)]"
                  : "text-white/55 hover:bg-white/[0.06] hover:text-white/80"
              }`}
              title="Show the elements the agent can see"
            >
              <ListTree size={14} />
              <span className="hidden lg:inline">Agent&apos;s view</span>
            </button>
          )}
          {isLive && onStop && (
            <button
              id={`browser-overlay-stop-${item.id}`}
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-rose-300/80 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
              title="Stop the task"
            >
              <Square size={12} fill="currentColor" />
              <span className="hidden lg:inline">Stop</span>
            </button>
          )}
          <button
            id={`browser-overlay-close-${item.id}`}
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85"
            title="Close (Esc)"
          >
            <span className="sr-only">Close</span>
            <X size={16} className="hidden sm:block" />
            <Minimize2 size={16} className="sm:hidden" />
          </button>
        </div>

        {/* Interactive Takeover Control Bar */}
        {isLive && interactive && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/20 bg-amber-500/[0.08] px-4 py-2 text-[12px]">
            <div className="flex items-center gap-2 text-amber-200">
              <Hand size={14} className="shrink-0" />
              <span className="font-medium">
                You are in control — click on the page and type directly. Agent &amp; screenshots are paused.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex items-center">
                <input
                  type={maskQuickText ? "password" : "text"}
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sendQuickText();
                    }
                  }}
                  autoComplete="off"
                  placeholder="Type or paste into focused field…"
                  className="w-48 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 pr-7 text-[12px] text-white placeholder:text-white/25 focus:border-amber-400/40 focus:outline-none sm:w-56"
                />
                <button
                  type="button"
                  onClick={() => setMaskQuickText((v) => !v)}
                  className="absolute right-2 text-white/30 hover:text-white/60"
                  title={maskQuickText ? "Show text" : "Mask text"}
                >
                  {maskQuickText ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <button
                type="button"
                onClick={sendQuickText}
                disabled={!quickText}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-white/80 hover:bg-white/15 disabled:opacity-40"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() =>
                  sendLive(item.id, {
                    type: "key",
                    eventType: "keyDown",
                    key: "Enter",
                    code: "Enter",
                    keyCode: 13,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-white/75 hover:bg-white/15"
                title="Press Enter on page"
              >
                <CornerDownLeft size={12} />
                Enter
              </button>
              <button
                type="button"
                onClick={() => finishTakeover("completed")}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-200 hover:bg-emerald-500/30"
              >
                <Check size={13} />
                Done — Resume Agent
              </button>
              <button
                type="button"
                onClick={() => finishTakeover("cancelled")}
                className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-white/60 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          <div className="browser-grid relative min-w-0 flex-1 bg-[#07090d]">
            {isLive ? (
              <>
                <LiveCanvas itemId={item.id} interactive={interactive} onState={onState} />
                {!feed?.hasFrame && (
                  <div className="browser-scan absolute inset-0 flex items-center justify-center overflow-hidden text-[12px] text-white/35">
                    {PHASE_LABEL[d.phase ?? ""] ?? "Connecting to the browser"}…
                  </div>
                )}
              </>
            ) : (
              <FinalSnapshot snapshotId={snapshotId} alt={`Final page: ${d.title || url || "browser"}`} />
            )}
          </div>
          {isLive && showAgentView && (
            <AgentViewList
              itemId={item.id}
              className="w-[min(380px,40%)] border-l border-white/[0.06] bg-black/30 animate-content-in"
            />
          )}
        </div>

        {/* Footer: goal */}
        {d.goal && (
          <div className="border-t border-white/[0.06] px-4 py-2 text-[12px] text-white/45">
            <span className="mr-2 font-semibold uppercase tracking-wider text-white/30">Goal</span>
            {d.goal}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
