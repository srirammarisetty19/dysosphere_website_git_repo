"use client";

// "Agent's view" — the indexed element list the browser agent currently
// reasons over (browser_use DOM serialization). Pulled on demand over the
// existing live socket; refreshed while open.

import { useEffect, useMemo, useState } from "react";
import { ListTree, LoaderCircle } from "lucide-react";
import { sendLive, subscribeLive } from "@/components/browser/frame-source";

interface AgentViewListProps {
  itemId: string;
  className?: string;
}

const LINE_RE = /^(\s*)(\*?\[(\d+)\])?(.*)$/;

export function AgentViewList({ itemId, className = "" }: AgentViewListProps) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeLive(itemId, {
      onAgentView: (c) => setContent(c),
      onStatus: (s) => {
        if (s === "live") sendLive(itemId, { type: "agent_view" });
      },
      onMeta: () => sendLive(itemId, { type: "agent_view" }),
    });
    sendLive(itemId, { type: "agent_view" });
    const t = setInterval(() => sendLive(itemId, { type: "agent_view" }), 3000);
    return () => {
      clearInterval(t);
      unsubscribe();
    };
  }, [itemId]);

  const lines = useMemo(
    () => (content ?? "").split("\n").filter((l) => l.trim().length > 0).slice(0, 400),
    [content],
  );

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <ListTree size={13} className="text-[var(--color-accent-blue)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          What the agent sees
        </span>
        {content !== null && (
          <span className="ml-auto text-[10px] text-white/30">{lines.length} elements</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.65]">
        {content === null ? (
          <div className="flex items-center gap-2 py-6 text-white/35">
            <LoaderCircle size={13} className="animate-spin" />
            Reading page structure…
          </div>
        ) : lines.length === 0 ? (
          <div className="py-6 text-white/35">No interactive elements on this page yet.</div>
        ) : (
          lines.map((line, i) => {
            const m = LINE_RE.exec(line);
            const indent = m?.[1]?.length ?? 0;
            const idx = m?.[3];
            const rest = (m?.[4] ?? line).trim();
            return (
              <div
                key={i}
                className="truncate text-white/55"
                style={{ paddingLeft: Math.min(indent, 12) * 6 }}
                title={rest}
              >
                {idx && (
                  <span className="mr-1.5 inline-flex min-w-[1.75rem] justify-center rounded bg-[var(--color-accent-blue)]/15 px-1 text-[10px] font-semibold text-[var(--color-accent-blue)]">
                    {idx}
                  </span>
                )}
                {rest}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
