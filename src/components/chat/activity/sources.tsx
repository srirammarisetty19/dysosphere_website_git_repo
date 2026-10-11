"use client";

// Source monogram + citation pill + sources bar.
//
// Privacy: we deliberately do NOT load remote favicons (that would make the
// user's browser contact every cited site automatically). A deterministic
// colored monogram stands in for the site icon.

import { ExternalLink } from "lucide-react";
import type { Source } from "@/lib/types";
import { domainOf } from "@/lib/run-items";

function hueFor(domain: string): number {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) % 360;
  return h;
}

export function SourceMonogram({ url, size = 16 }: { url: string; size?: number }) {
  const domain = domainOf(url) || "?";
  const hue = hueFor(domain);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.55)),
        background: `hsl(${hue} 70% 55% / 0.18)`,
        color: `hsl(${hue} 85% 75%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 70% 60% / 0.25)`,
      }}
    >
      {domain.charAt(0)}
    </span>
  );
}

/** Inline [n] citation. Spans only — it renders inside markdown <p>. */
export function CitationPill({ source, n }: { source?: Source; n: number }) {
  if (!source) {
    return <span className="text-white/40">[{n}]</span>;
  }
  const domain = source.domain || domainOf(source.url);
  return (
    <span className="group/cite relative mx-[1px] inline-block align-baseline">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="citation-pill inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-[1px] items-center justify-center rounded-md bg-[var(--color-accent-blue)]/12 px-1 text-[10.5px] font-semibold leading-none text-[var(--color-accent-blue)] no-underline ring-1 ring-[var(--color-accent-blue)]/20 transition-all hover:bg-[var(--color-accent-blue)]/25 hover:ring-[var(--color-accent-blue)]/40 focus-visible:bg-[var(--color-accent-blue)]/25"
        aria-label={`Source ${n}: ${source.title || domain}`}
      >
        {n}
      </a>
      {/* Hover / focus card */}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-1/2 z-50 block w-72 -translate-x-1/2 translate-y-1 rounded-xl border border-white/[0.1] bg-[#10141c]/95 p-3 text-left opacity-0 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-150 group-focus-within/cite:visible group-focus-within/cite:translate-y-0 group-focus-within/cite:opacity-100 group-hover/cite:pointer-events-auto group-hover/cite:visible group-hover/cite:translate-y-0 group-hover/cite:opacity-100"
      >
        <span className="flex items-center gap-2">
          <SourceMonogram url={source.url} size={16} />
          <span className="truncate text-[11px] font-medium text-white/50">{domain}</span>
          <ExternalLink size={10} className="ml-auto shrink-0 text-white/30" />
        </span>
        <span className="mt-1.5 line-clamp-2 block text-[12.5px] font-semibold leading-snug text-white/85">
          {source.title || source.url}
        </span>
        {source.snippet && (
          <span className="mt-1 line-clamp-3 block text-[11.5px] leading-relaxed text-white/45">
            {source.snippet}
          </span>
        )}
      </span>
    </span>
  );
}

/** Horizontal strip of source chips under the answer. */
export function SourcesBar({ sources, citedIds }: { sources: Source[]; citedIds?: Set<number> }) {
  if (sources.length === 0) return null;
  // Cited sources first, then the rest; cap to keep it tidy.
  const ordered = [...sources].sort((a, b) => {
    const ca = citedIds?.has(a.id) ? 0 : 1;
    const cb = citedIds?.has(b.id) ? 0 : 1;
    return ca - cb || a.id - b.id;
  });
  const shown = ordered.slice(0, 8);
  const extra = ordered.length - shown.length;

  return (
    <div className="mt-3" id="answer-sources">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/30">
        Sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((s) => {
          const domain = s.domain || domainOf(s.url);
          const cited = citedIds?.has(s.id);
          return (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.title || s.url}
              className={`group flex max-w-[220px] items-center gap-2 rounded-lg border px-2 py-1.5 transition-all hover:-translate-y-[1px] ${
                cited
                  ? "border-white/[0.1] bg-white/[0.045] hover:border-[var(--color-accent-blue)]/35 hover:bg-white/[0.07]"
                  : "border-white/[0.05] bg-white/[0.02] opacity-75 hover:opacity-100"
              }`}
            >
              <span className="text-[10px] font-semibold tabular-nums text-white/35">{s.id}</span>
              <SourceMonogram url={s.url} size={15} />
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-medium text-white/75 group-hover:text-white/90">
                  {s.title || domain}
                </span>
                <span className="block truncate text-[10px] text-white/35">{domain}</span>
              </span>
            </a>
          );
        })}
        {extra > 0 && (
          <span className="flex items-center rounded-lg border border-white/[0.05] px-2.5 py-1.5 text-[11px] text-white/40">
            +{extra} more
          </span>
        )}
      </div>
    </div>
  );
}
