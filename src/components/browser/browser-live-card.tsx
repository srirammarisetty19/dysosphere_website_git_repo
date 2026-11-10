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
import Link from "next/link";
import {
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Globe,
  Hand,
  Hourglass,
  KeyRound,
  ListTree,
  LoaderCircle,
  Lock,
  Maximize2,
  MousePointerClick,
  ShieldAlert,
  Square,
} from "lucide-react";
import type { ApprovalDecision, ApprovalRequestPayload, RunItem } from "@/lib/types";
import { apiClient } from "@/lib/api-client";
import { domainOf, errorText } from "@/lib/run-items";
import { useAutoScrollPause } from "@/lib/scroll-pause";
import { useChatStore } from "@/stores/chat-store";
import { sendLive, setLiveMode } from "@/components/browser/frame-source";
import { LiveCanvas, type LiveFeedState } from "@/components/browser/live-canvas";
import { FinalSnapshot } from "@/components/browser/final-snapshot";
import { AgentViewList } from "@/components/browser/agent-view-list";
import { BrowserOverlay } from "@/components/browser/browser-overlay";
import { AddressBar, LiveBadge, PHASE_LABEL } from "@/components/browser/browser-chrome";

export function BrowserApprovalPrompt({
  approval,
  fallbackUrl,
  onStartTakeover,
}: {
  approval: ApprovalRequestPayload;
  fallbackUrl?: string;
  onStartTakeover?: () => void;
}) {
  const resolveApproval = useChatStore((s) => s.resolveApproval);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [originInput, setOriginInput] = useState(approval.origin || fallbackUrl || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const act = async (decision: ApprovalDecision, extra?: { passphrase?: string; credential_id?: string }) => {
    if (decision !== "deny" && approval.requires_passphrase && !(extra?.passphrase ?? passphrase).trim()) {
      setErr("Unlock passphrase is required for this locked login.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await resolveApproval(approval.approval_id, decision, {
        passphrase: extra?.passphrase ?? (passphrase.trim() || undefined),
        credential_id: extra?.credential_id,
      });
      setPassphrase("");
      if (decision === "takeover") {
        onStartTakeover?.();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit decision");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!originInput.trim() || !username.trim() || !password) {
      setErr("Website URL, username, and password are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const saved = await apiClient.createSavedLogin({
        origin: originInput.trim(),
        username: username.trim(),
        password,
        totp_secret: totpSecret.trim() || undefined,
      });
      setPassword("");
      setTotpSecret("");
      await act("saved_login", { credential_id: saved.id });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save login");
      setBusy(false);
    }
  };

  const isNeedsLogin = approval.kind === "needs_login" || approval.kind === "takeover";

  return (
    <div
      id={`approval-prompt-${approval.approval_id}`}
      className="mx-3.5 mb-2.5 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-3 text-[12px] text-white/85"
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
          {approval.requires_passphrase ? <Lock size={13} /> : <ShieldAlert size={13} />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-amber-200">{approval.title}</p>
            <p className="mt-0.5 text-[11.5px] text-white/60">{approval.description}</p>
            {approval.origin && (
              <p className="mt-1 font-mono text-[10.5px] text-emerald-300/80">
                Verified origin: {approval.origin}
                {approval.username_hint ? ` · ${approval.username_hint}` : ""}
              </p>
            )}
          </div>

          {approval.requires_passphrase && (
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="off"
                placeholder="Enter unlock passphrase for this locked login"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 pr-8 text-[12px] text-white placeholder:text-white/25 focus:border-amber-400/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showPassphrase ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          )}

          {isNeedsLogin && showSaveForm && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/35 p-2.5">
              <input
                type="url"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:outline-none"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                placeholder="Username or email"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:outline-none"
              />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Password (encrypted in vault — never shown to AI)"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 pr-8 text-[12px] text-white placeholder:text-white/25 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showPw ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              </div>
              <input
                type="password"
                value={totpSecret}
                onChange={(e) => setTotpSecret(e.target.value)}
                autoComplete="off"
                placeholder="Optional 2FA / TOTP secret key (Base32)"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white placeholder:text-white/25 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveAndContinue}
                  className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  Save &amp; Sign In
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowSaveForm(false)}
                  className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-white/55 hover:bg-white/10"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {err && <p className="text-[11px] text-rose-300">{err}</p>}

          {!showSaveForm && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {isNeedsLogin ? (
                <>
                  {approval.options.includes("takeover") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("takeover")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/20 px-2.5 py-1.5 font-semibold text-amber-200 hover:bg-amber-400/30 disabled:opacity-50"
                    >
                      <Hand size={12} />
                      Log in yourself
                    </button>
                  )}
                  {approval.options.includes("saved_login") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowSaveForm(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <KeyRound size={12} />
                      Save Login to Vault
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act("deny")}
                    className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-white/55 hover:bg-white/10 disabled:opacity-50"
                  >
                    Skip
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act("allow_once")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    <Check size={12} />
                    {approval.requires_passphrase ? "Unlock & Allow" : "Allow Once"}
                  </button>
                  {approval.allow_always_option && approval.options.includes("allow_always") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("allow_always")}
                      className="rounded-lg bg-[var(--color-accent-blue)]/15 px-2.5 py-1.5 font-medium text-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/25 disabled:opacity-50"
                    >
                      Always Allow
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act("deny")}
                    className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    Deny
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [overlayInteractive, setOverlayInteractive] = useState(false);
  const [agentView, setAgentView] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const onState = useCallback((s: LiveFeedState) => setFeed(s), []);
  const hoverPause = useAutoScrollPause();
  const pendingApprovals = useChatStore((s) => s.pendingApprovals);

  const d = item.data ?? {};
  const running = item.status === "in_progress" || item.status === "queued";
  const isLive = live && feed?.status !== "ended";
  const isTakeover = Boolean(isLive && (d.takeover || feed?.meta.takeover));
  const url = feed?.meta.url || d.url || d.final_url;
  const step = feed?.meta.step ?? d.step ?? d.steps_taken ?? 0;
  const snapshotId = feed?.endedSnapshotId || d.final_snapshot_id || d.snapshot_id;
  const actions = (d.actions ?? []).slice(-4);
  const visitedCount = d.visited?.length ?? 0;

  const itemApprovals = pendingApprovals.filter(
    (a) => a.item_id === item.id || (!a.item_id && running),
  );

  const handleOpenTakeover = async () => {
    try {
      await apiClient.startBrowserTakeover(item.id);
    } catch {
      /* may already be in takeover */
    }
    setLiveMode(item.id, "control");
    setOverlayInteractive(true);
    setOverlay(true);
  };

  const handleCompleteTakeover = async (outcome: "completed" | "cancelled") => {
    sendLive(item.id, { type: "takeover_done", outcome });
    try {
      await apiClient.completeBrowserTakeover(item.id, outcome);
    } catch {
      /* ignore */
    }
    setLiveMode(item.id, "view");
    setOverlayInteractive(false);
  };

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
              id={`browser-card-takeover-${item.id}`}
              onClick={handleOpenTakeover}
              className={`rounded-lg p-1.5 transition-colors ${
                isTakeover
                  ? "bg-amber-400/20 text-amber-300"
                  : "text-white/40 hover:bg-white/[0.06] hover:text-white/75"
              }`}
              title="Take interactive control (sign in or solve CAPTCHA yourself)"
            >
              <Hand size={14} />
            </button>
          )}
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

          {/* ── Pending Approvals / Unlock / Needs Login ── */}
          {itemApprovals.map((appr) => (
            <BrowserApprovalPrompt
              key={appr.approval_id}
              approval={appr}
              fallbackUrl={url}
              onStartTakeover={() => {
                setLiveMode(item.id, "control");
                setOverlayInteractive(true);
                setOverlay(true);
              }}
            />
          ))}

          {/* ── Active Takeover Banner ── */}
          {isTakeover && (
            <div className="mx-3.5 mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-[12px] text-amber-200">
              <span className="flex items-center gap-1.5 font-medium">
                <Hand size={13} />
                Agent paused for your input — screenshots disabled
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOverlayInteractive(true);
                    setOverlay(true);
                  }}
                  className="rounded-lg bg-amber-400/20 px-2.5 py-1 text-[11.5px] font-semibold text-amber-100 hover:bg-amber-400/30"
                >
                  Open Interactive View
                </button>
                <button
                  type="button"
                  onClick={() => handleCompleteTakeover("completed")}
                  className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-200 hover:bg-emerald-500/30"
                >
                  Done
                </button>
              </div>
            </div>
          )}

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12px] text-rose-300/80">
              <CircleX size={12} />
              {errorText(item.error_code, item.error)}
            </p>
            {item.error_code === "NEEDS_LOGIN" && (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/75 hover:bg-white/10"
              >
                <KeyRound size={11} />
                Saved Logins in Settings
              </Link>
            )}
          </div>
        )}
      </div>

      {overlay && (
        <BrowserOverlay
          item={item}
          live={isLive}
          initialInteractive={overlayInteractive || isTakeover}
          onClose={() => {
            setOverlay(false);
            setOverlayInteractive(false);
          }}
          onStop={onStop}
        />
      )}
    </div>
  );
}
