"use client";

// Shared visual pieces for the browser card and the full-screen overlay.

import { Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { domainOf } from "@/lib/run-items";

export function LiveBadge({ status }: { status: "live" | "connecting" | "reconnecting" | "ended" | "error" }) {
  if (status === "ended") return null;
  const live = status === "live";
  const label = live ? "LIVE" : status === "error" ? "OFFLINE" : "CONNECTING";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] ${
        live
          ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"
          : status === "error"
            ? "bg-white/[0.06] text-white/40 ring-1 ring-white/10"
            : "bg-amber-400/10 text-amber-200/80 ring-1 ring-amber-300/20"
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {live && <span className="live-ping absolute inline-flex h-full w-full rounded-full bg-rose-400" />}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            live ? "bg-rose-400" : status === "error" ? "bg-white/30" : "bg-amber-300 pulse-glow"
          }`}
        />
      </span>
      {label}
    </span>
  );
}

export function AddressBar({
  url,
  sandboxed,
  className = "",
}: {
  url?: string;
  sandboxed?: boolean;
  className?: string;
}) {
  const domain = domainOf(url);
  let rest = "";
  let secure = false;
  if (url) {
    try {
      const u = new URL(url);
      secure = u.protocol === "https:";
      rest = `${u.pathname === "/" ? "" : u.pathname}${u.search}`;
    } catch {
      rest = url;
    }
  }
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-1.5 ${className}`}
    >
      {url ? (
        secure ? (
          <Lock size={11} className="shrink-0 text-emerald-400/70" />
        ) : (
          <TriangleAlert size={11} className="shrink-0 text-amber-300/70" />
        )
      ) : (
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white/10" />
      )}
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
        {url ? (
          <>
            <span className="text-white/80">{domain || url}</span>
            <span className="text-white/30">{rest}</span>
          </>
        ) : (
          <span className="text-white/25">about:blank</span>
        )}
      </span>
      {sandboxed && (
        <span
          className="hidden shrink-0 items-center gap-1 rounded-md bg-emerald-400/[0.08] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-300/70 sm:inline-flex"
          title="Runs in an isolated, network-restricted browser sandbox"
        >
          <ShieldCheck size={10} /> Sandboxed
        </span>
      )}
    </div>
  );
}

export const PHASE_LABEL: Record<string, string> = {
  queued: "Waiting for a browser",
  launching: "Starting secure browser",
  navigating: "Navigating",
  acting: "Working on the page",
  waiting_for_user: "Waiting for you",
  blocked_retrying: "Site pushed back — retrying",
};
