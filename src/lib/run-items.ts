// ============================================================================
// Protocol v2 run-item reducer — ONE implementation shared by the live stream,
// the resume/replay path and history reload, so the three never diverge.
//
// Every item.* event carries the full item snapshot, so applying an event is
// an idempotent upsert by id (replay after reconnect is safe).
// ============================================================================

import type { Annotation, Message, RunItem, Source, StreamEvent } from "./types";

export interface RunState {
  items: RunItem[];
  sources: Source[];
  annotations: Annotation[];
}

export const emptyRunState = (): RunState => ({ items: [], sources: [], annotations: [] });

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function isTerminal(item: RunItem): boolean {
  return TERMINAL.has(item.status);
}

export function upsertItem(items: RunItem[], item: RunItem): RunItem[] {
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx === -1) return [...items, item];
  const prev = items[idx];
  // Never let a late non-terminal update overwrite a terminal state.
  if (isTerminal(prev) && !isTerminal(item)) return items;
  const next = items.slice();
  next[idx] = item;
  return next;
}

function mergeSources(existing: Source[], incoming: Source[] | undefined): Source[] {
  if (!incoming || incoming.length === 0) return existing;
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const s of incoming) byId.set(s.id, { ...byId.get(s.id), ...s });
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/**
 * Apply a stream event. Returns the next state, or null when the event is not
 * a protocol-v2 event (caller handles legacy events as before).
 */
export function applyRunEvent(state: RunState, event: StreamEvent): RunState | null {
  const t = event.type as string;
  if (t.startsWith("item.") && event.item) {
    return {
      ...state,
      items: upsertItem(state.items, event.item),
      sources: mergeSources(state.sources, event.item.sources),
    };
  }
  if (t === "message.annotations" && event.data) {
    return {
      ...state,
      annotations: event.data.annotations ?? [],
      sources: mergeSources(state.sources, event.data.sources),
    };
  }
  return null;
}

/** Fields to spread onto the assistant Message. */
export function runStateToMessage(state: RunState): Pick<Message, "items" | "sources" | "annotations"> {
  return {
    items: state.items,
    sources: state.sources,
    annotations: state.annotations,
  };
}

/** Rebuild run state from persisted history block metadata. */
export function runStateFromBlockMetadata(
  state: RunState,
  role: string,
  metadata: Record<string, unknown> | null | undefined,
): RunState {
  if (!metadata) return state;
  if (role === "tool_result" && metadata.item && typeof metadata.item === "object") {
    const item = metadata.item as RunItem;
    return { ...state, items: upsertItem(state.items, item), sources: mergeSources(state.sources, item.sources) };
  }
  if (role === "assistant") {
    return {
      ...state,
      annotations: (metadata.annotations as Annotation[]) ?? state.annotations,
      sources: mergeSources(state.sources, metadata.sources as Source[] | undefined),
    };
  }
  return state;
}

// ── Presentation helpers ────────────────────────────────────────────────

export function domainOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const ERROR_TEXT: Record<string, string> = {
  TIMEOUT: "Took too long and was stopped",
  BLOCKED_BY_SITE: "The site blocked automated access",
  POLICY_DENIED: "Blocked by your organization's browsing policy",
  NEEDS_LOGIN: "This page needs you to sign in",
  SANDBOX_UNAVAILABLE: "The secure browser isn't available right now",
  NOT_CONFIGURED: "Web search isn't set up on this server",
  PROVIDER_UNAVAILABLE: "The search provider didn't respond",
  FETCH_FAILED: "Couldn't load the page",
  STEP_LIMIT: "Ran out of steps before finishing",
  CANCELLED: "Stopped",
  INVALID_ARGS: "Invalid request",
  INTERNAL: "Something went wrong",
};

export function errorText(code: string | null | undefined, fallback?: string | null): string {
  if (code && ERROR_TEXT[code]) return ERROR_TEXT[code];
  return fallback || "Something went wrong";
}

export function snapshotUrl(serverUrl: string, snapshotId: string): string {
  return `${serverUrl.replace(/\/$/, "")}/api/ai/browser/snapshots/${encodeURIComponent(snapshotId)}`;
}
