"use client";

// ============================================================================
// Search Page — Text search + AI Semantic search
// ============================================================================

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { nasApiClient } from "@/lib/nas-api-client";
import type { FileItem, DisplayItem } from "@/lib/nas-types";
import { FileThumbnail } from "@/components/nas/file-thumbnail";
import { FileViewerModal } from "@/components/nas/file-viewer-modal";
import {
  Search,
  ArrowLeft,
  Loader2,
  Sparkles,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [textResults, setTextResults] = useState<DisplayItem[]>([]);
  const [visualMatches, setVisualMatches] = useState<FileItem[]>([]);
  const [docMatches, setDocMatches] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [viewerItem, setViewerItem] = useState<DisplayItem | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const initialSearchDone = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-search if ?q= param is present (from inline search "See all results" link)
  useEffect(() => {
    if (initialSearchDone.current) return;
    const urlQuery = searchParams.get("q");
    if (urlQuery && urlQuery.trim()) {
      initialSearchDone.current = true;
      setQuery(urlQuery);
      doSearch(urlQuery);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setTextResults([]);
      setVisualMatches([]);
      setDocMatches([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(true);

    // Text search
    setIsSearching(true);
    try {
      const data = await nasApiClient.searchFiles(q.trim());
      const items: DisplayItem[] = data.map((raw: any) => {
        const isDir = raw.parent_id !== undefined && raw.directory_id === undefined;
        return isDir
          ? { kind: "directory" as const, item: raw }
          : { kind: "file" as const, item: raw };
      });
      setTextResults(items);
    } catch {
      setTextResults([]);
    } finally {
      setIsSearching(false);
    }

    // AI semantic search (parallel)
    setIsAiSearching(true);
    setAiError(null);
    try {
      console.log('[NAS Search Page] Calling semantic search for:', q.trim());
      const semantic = await nasApiClient.searchSemantic(q.trim());
      const allFiles = [
        ...(semantic.media || []),
        ...(semantic.documents || []),
      ];
      console.log('[NAS Search Page] Semantic search returned', allFiles.length, 'results');
      const visual = allFiles.filter((f) => {
        const m = f.mime_type || "";
        return m.startsWith("image/") || m.startsWith("video/");
      });
      const docs = allFiles.filter((f) => {
        const m = f.mime_type || "";
        return !m.startsWith("image/") && !m.startsWith("video/");
      });
      setVisualMatches(visual);
      setDocMatches(docs);
    } catch (err) {
      console.error('[NAS Search Page] Semantic search failed:', err);
      setVisualMatches([]);
      setDocMatches([]);
      setAiError('AI search failed — the search engine may be unavailable');
    } finally {
      setIsAiSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            placeholder="Search files and folders..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-border-subtle text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue transition-colors"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Search className="h-12 w-12 mb-4" />
            <p className="text-sm">Search across all your files</p>
            <p className="text-xs mt-1">
              AI-powered semantic search finds images and documents by meaning
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* AI Error Banner */}
            {aiError && !isAiSearching && (
              <div className="flex items-center gap-2 px-6 py-2.5 text-amber-400/80 bg-amber-500/5 border-b border-border-subtle">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs">{aiError}</span>
              </div>
            )}
            {/* AI Visual Matches */}
            {(isAiSearching || visualMatches.length > 0) && (
              <div className="border-b border-border-subtle pb-4">
                <div className="flex items-center gap-2 px-6 py-3">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">
                    {isAiSearching
                      ? "AI Search Processing..."
                      : "Visual Matches"}
                  </span>
                  {isAiSearching && (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  )}
                </div>
                {isAiSearching ? (
                  <div className="flex gap-3 px-6 overflow-x-auto scrollbar-none">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-28 shrink-0 aspect-square rounded-xl bg-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 px-6 overflow-x-auto scrollbar-none pb-2">
                    {visualMatches.map((file) => (
                      <button
                        key={file.id}
                        onClick={() =>
                          setViewerItem({ kind: "file", item: file })
                        }
                        className="w-28 shrink-0 group"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden border border-border-subtle group-hover:border-accent-blue transition-colors">
                          <FileThumbnail
                            fileId={file.id}
                            mimeType={file.mime_type}
                            name={file.name}
                            size="md"
                          />
                        </div>
                        <p className="text-[11px] text-text-secondary text-center truncate mt-1.5">
                          {file.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Document Matches */}
            {docMatches.length > 0 && (
              <div className="border-b border-border-subtle">
                <div className="flex items-center gap-2 px-6 py-3">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">
                    Document Matches
                  </span>
                </div>
                {docMatches.map((file) => (
                  <button
                    key={file.id}
                    onClick={() =>
                      setViewerItem({ kind: "file", item: file })
                    }
                    className="flex items-center gap-3 w-full px-6 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                      <FileThumbnail
                        fileId={file.id}
                        mimeType={file.mime_type}
                        name={file.name}
                        size="sm"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        AI Match
                        {file.updated_at
                          ? ` · ${new Date(file.updated_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Text Search Results */}
            <div>
              <div className="flex items-center gap-2 px-6 py-3">
                <Search className="h-4 w-4 text-text-tertiary" />
                <span className="text-sm font-medium text-text-secondary">
                  {isSearching
                    ? "Searching..."
                    : `${textResults.length} result${textResults.length !== 1 ? "s" : ""}`}
                </span>
                {isSearching && (
                  <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                )}
              </div>
              {!isSearching && textResults.length === 0 && (
                <p className="px-6 py-4 text-sm text-text-tertiary">
                  No filename matches found.
                </p>
              )}
              {textResults.map((item) => (
                <button
                  key={item.item.id}
                  onClick={() => {
                    if (item.kind === "file") setViewerItem(item);
                  }}
                  className="flex items-center gap-3 w-full px-6 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                    {item.kind === "directory" ? (
                      <div className="h-full w-full bg-blue-500/10 flex items-center justify-center">
                        <svg
                          className="h-5 w-5 text-blue-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                      </div>
                    ) : (
                      <FileThumbnail
                        fileId={item.item.id}
                        mimeType={(item.item as any).mime_type}
                        name={item.item.name}
                        size="sm"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">
                      {item.item.name}
                    </p>
                    <p className="text-[11px] text-text-tertiary truncate">
                      {item.item.path}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {viewerItem && (
        <FileViewerModal
          item={viewerItem}
          onClose={() => setViewerItem(null)}
        />
      )}
    </div>
  );
}
