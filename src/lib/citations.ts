// Turn model-emitted `[n]` citation markers into `[n](cite:n)` markdown links
// so the renderer can swap them for CitationPills. Only ids that map to a
// real source are converted (the server validates them too); code blocks and
// inline code are left untouched.

const SEGMENT_RE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;
// [1] or [1, 2] — not a reference link ([text][1]), not an inline link
// target ([1](...)), not a reference definition ([1]: url), not escaped.
const CITE_RE = /(?<![\]\\])\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\](?![(\[:])/g;

export const CITE_SCHEME = "cite:";

export function linkifyCitations(markdown: string, validIds: Set<number>): string {
  if (!markdown || validIds.size === 0) return markdown;
  const parts = markdown.split(SEGMENT_RE);
  for (let i = 0; i < parts.length; i += 2) {
    // even indices are prose; odd indices are captured code segments
    parts[i] = parts[i].replace(CITE_RE, (whole, group: string) => {
      const ids = group.split(",").map((s) => parseInt(s.trim(), 10));
      if (!ids.every((n) => validIds.has(n))) return whole;
      return ids.map((n) => `[${n}](${CITE_SCHEME}${n})`).join("");
    });
  }
  return parts.join("");
}

export function citedIdsOf(markdown: string, validIds: Set<number>): Set<number> {
  const out = new Set<number>();
  if (!markdown) return out;
  const parts = markdown.split(SEGMENT_RE);
  for (let i = 0; i < parts.length; i += 2) {
    for (const m of parts[i].matchAll(CITE_RE)) {
      for (const s of m[1].split(",")) {
        const n = parseInt(s.trim(), 10);
        if (validIds.has(n)) out.add(n);
      }
    }
  }
  return out;
}
