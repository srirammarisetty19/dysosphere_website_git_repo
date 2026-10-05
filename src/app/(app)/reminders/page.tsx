"use client";

// ============================================================================
// Reminders Page — Port of heartbeats_sheet.dart
// Scheduled AI heartbeats with create, edit, toggle, delete
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Plus,
  Clock,
  Trash2,
  Pencil,
  X,
  Loader2,
  Repeat,
  AlertCircle,
  Menu,
  CheckCircle2,
  XCircle,
  MessageSquare,
  History,
  RefreshCw,
} from "lucide-react";
import { useHeartbeatsStore, describeCron } from "@/stores/heartbeats-store";
import { useChatStore } from "@/stores/chat-store";
import { apiClient } from "@/lib/api-client";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import type { Heartbeat, HeartbeatResult } from "@/lib/types";

export default function RemindersPage() {
  const { heartbeats, isLoading, error, load, create, toggle, remove } = useHeartbeatsStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
            className="lg:hidden p-2 -ml-2 mr-1 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00BCD4] to-[#7C4DFF] flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Reminders</h1>
          {heartbeats.length > 0 && (
            <span className="text-white/20 text-xs ml-1">
              {heartbeats.filter((h) => h.enabled).length} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={`p-2 rounded-lg transition-colors ${
            showCreate
              ? "text-white/60 bg-white/5"
              : "text-[#00BCD4] hover:bg-[#00BCD4]/10"
          }`}
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Create Form */}
        {showCreate && (
          <CreateForm
            onClose={() => setShowCreate(false)}
            onCreate={async (data) => {
              await create(data);
              setShowCreate(false);
            }}
          />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={14} className="text-red-400" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && heartbeats.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[#00BCD4]" size={24} />
          </div>
        ) : heartbeats.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2.5">
            {heartbeats.map((hb) => (
              <HeartbeatTile
                key={hb.id}
                heartbeat={hb}
                isEditing={editingId === hb.id}
                onEdit={() => setEditingId(editingId === hb.id ? null : hb.id)}
                onToggle={(enabled) => toggle(hb.id, enabled)}
                onDelete={() => remove(hb.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Form ─────────────────────────────────────────────────────────
function CreateForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; prompt: string; schedule: string; type?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * *");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !prompt.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        name: name.trim(),
        prompt: prompt.trim(),
        schedule: schedule.trim(),
        type: "cron",
      });
    } catch {
      // Error shown by store
    } finally {
      setCreating(false);
    }
  };

  const cronDescription = describeCron(schedule);

  return (
    <div className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-[#00BCD4]/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">
          New Reminder
        </h3>
        <button onClick={onClose} className="text-white/20 hover:text-white/40 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Name */}
        <input
          type="text"
          placeholder="Name (e.g. Drink water)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-[#00BCD4]/40 focus:outline-none transition-colors"
        />

        {/* Prompt */}
        <textarea
          placeholder="What should the AI do when this fires?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-[#00BCD4]/40 focus:outline-none transition-colors resize-none"
        />

        {/* Schedule */}
        <div>
          <input
            type="text"
            placeholder="Cron schedule (e.g. 0 9 * * *)"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="w-full px-4 py-3 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-[#00BCD4]/40 focus:outline-none transition-colors font-mono"
          />
          {cronDescription && (
            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[#00BCD4]/8 border border-[#00BCD4]/15">
              <Clock size={12} className="text-[#00BCD4]" />
              <span className="text-[#00BCD4] text-xs font-medium">{cronDescription}</span>
            </div>
          )}
          <p className="text-white/15 text-[10px] mt-1.5 px-1">
            Format: minute hour day month weekday (0=Sun, 1=Mon … 6=Sat, *=any)
          </p>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || !prompt.trim()}
          className="w-full py-3 rounded-xl bg-[#00BCD4] text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {creating ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <>
              <Plus size={16} />
              Schedule
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Heartbeat Tile ──────────────────────────────────────────────────────
function HeartbeatTile({
  heartbeat,
  isEditing,
  onEdit,
  onToggle,
  onDelete,
}: {
  heartbeat: Heartbeat;
  isEditing: boolean;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const enabled = heartbeat.enabled;

  // Clean display name
  let displayName = heartbeat.name || "Heartbeat";
  if (displayName.startsWith("schedule_") || displayName.startsWith("reminder_")) {
    const parts = displayName.split("_");
    if (parts.length >= 3) {
      displayName = parts.slice(2).join(" ");
      displayName = displayName[0].toUpperCase() + displayName.slice(1);
    }
  }

  const scheduleDesc = describeCron(heartbeat.schedule);

  return (
    <div
      className={`rounded-[14px] bg-white/[0.03] border transition-colors ${
        enabled ? "border-[#00BCD4]/15" : "border-white/[0.04]"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Icon */}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            enabled ? "bg-[#00BCD4]/15" : "bg-white/[0.04]"
          }`}
        >
          <Zap size={16} className={enabled ? "text-[#00BCD4]" : "text-white/25"} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${enabled ? "text-white" : "text-white/40"}`}>
            {displayName}
          </p>
          {scheduleDesc && (
            <p className="text-white/30 text-[11px] mt-0.5">{scheduleDesc}</p>
          )}
          {heartbeat.last_run && (
            <p className="text-[#00BCD4]/40 text-[10px] mt-0.5">
              Last run: {new Date(heartbeat.last_run).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Toggle */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-[#00BCD4] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
        </label>

        {/* Edit */}
        <button
          onClick={onEdit}
          className={`p-1.5 rounded-lg transition-colors ${
            enabled
              ? "text-[#00BCD4]/50 hover:text-[#00BCD4] hover:bg-[#00BCD4]/10"
              : "text-white/15 hover:text-white/30"
          }`}
        >
          <Pencil size={14} />
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded detail */}
      {isEditing && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
          <div className="space-y-2 mt-3">
            <div>
              <span className="text-white/25 text-[10px] uppercase tracking-wider font-semibold">Prompt</span>
              <p className="text-white/50 text-xs mt-1 leading-relaxed">{heartbeat.prompt}</p>
            </div>
            {heartbeat.schedule && (
              <div>
                <span className="text-white/25 text-[10px] uppercase tracking-wider font-semibold">Schedule</span>
                <p className="text-white/40 text-xs mt-1 font-mono">{heartbeat.schedule}</p>
              </div>
            )}
            {heartbeat.last_run && (
              <div>
                <span className="text-white/25 text-[10px] uppercase tracking-wider font-semibold">Last Run</span>
                <p className="text-white/30 text-xs mt-1">
                  {new Date(heartbeat.last_run).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <RecentRuns heartbeatId={heartbeat.id} />
        </div>
      )}
    </div>
  );
}

// ── Recent Runs (GET /heartbeats/{id}/results) ───────────────────────────────
const RUNS_PAGE = 5;

function formatDuration(ms: number | null): string | null {
  if (ms == null) return null;
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Unknown time";
  // Server stores naive UTC timestamps — treat a missing offset as UTC.
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function RecentRuns({ heartbeatId }: { heartbeatId: string }) {
  const router = useRouter();
  const loadConversation = useChatStore((s) => s.loadConversation);
  const [runs, setRuns] = useState<HeartbeatResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(RUNS_PAGE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getHeartbeatResults(heartbeatId, limit)
      .then((data) => {
        if (cancelled) return;
        setRuns(data.results ?? []);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load runs"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [heartbeatId, limit, reloadKey]);

  const refresh = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const showMore = () => {
    setLoading(true);
    setLimit((l) => Math.min(l + 10, 100));
  };

  const openSession = (sessionId: string) => {
    loadConversation(sessionId);
    router.push("/chat");
  };

  return (
    <div className="mt-4 pt-3 border-t border-white/[0.04]">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-white/25 text-[10px] uppercase tracking-wider font-semibold">
          <History size={11} /> Recent runs
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1 rounded text-white/20 hover:text-white/50 transition-colors disabled:opacity-50"
          aria-label="Refresh runs"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error ? (
        <p className="text-red-400/80 text-xs">{error}</p>
      ) : loading && runs.length === 0 ? (
        <div className="space-y-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <p className="text-white/20 text-xs">No runs yet — results appear here after this reminder fires.</p>
      ) : (
        <div className="space-y-1.5">
          {runs.map((run) => {
            const failed = !!run.error;
            const open = expandedId === run.id;
            const duration = formatDuration(run.duration_ms);
            const body = failed ? run.error : run.result;
            return (
              <div
                key={run.id}
                className={`rounded-lg border transition-colors ${
                  failed ? "border-red-500/15 bg-red-500/[0.04]" : "border-white/[0.04] bg-white/[0.02]"
                }`}
              >
                <button
                  onClick={() => setExpandedId(open ? null : run.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                  aria-expanded={open}
                >
                  {failed ? (
                    <XCircle size={13} className="text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-400/80 shrink-0" />
                  )}
                  <span className="text-white/55 text-xs shrink-0">{formatWhen(run.created_at)}</span>
                  {duration && <span className="text-white/20 text-[10px] shrink-0">· {duration}</span>}
                  {!open && body && (
                    <span className="text-white/25 text-[11px] truncate ml-1">
                      {body.replace(/[*_`#>~]+/g, "").replace(/\s+/g, " ").trim().slice(0, 120)}
                    </span>
                  )}
                </button>
                {open && (
                  <div className="px-3 pb-3 -mt-0.5">
                    {body ? (
                      failed ? (
                        <p className="text-red-300/80 text-xs font-mono whitespace-pre-wrap break-words">{body}</p>
                      ) : (
                        <div className="text-xs max-h-64 overflow-y-auto">
                          <MarkdownRenderer content={body} dimmed />
                        </div>
                      )
                    ) : (
                      <p className="text-white/20 text-xs">No output recorded.</p>
                    )}
                    {run.session_id && (
                      <button
                        onClick={() => openSession(run.session_id!)}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#00BCD4]/80 hover:text-[#00BCD4] transition-colors"
                      >
                        <MessageSquare size={11} /> Open conversation
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {runs.length >= limit && limit < 100 && (
            <button
              onClick={showMore}
              disabled={loading}
              className="w-full py-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
            >
              {loading ? "Loading…" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <Zap size={28} className="text-white/15" />
      </div>
      <p className="text-white/30 text-sm font-medium mb-1">No reminders yet</p>
      <p className="text-white/15 text-xs text-center max-w-xs">
        Schedule AI heartbeats to automate recurring tasks.
        <br />
        Click + above to create your first reminder.
      </p>
    </div>
  );
}
