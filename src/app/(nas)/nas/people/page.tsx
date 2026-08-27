"use client";

// ============================================================================
// People Page — Face clusters grid (Google Photos style)
// Features: Cluster grid, merge suggestions, unclustered faces, inline rename
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { PersonCluster } from "@/lib/nas-types";
import {
  Loader2,
  Users,
  RefreshCw,
  ArrowLeft,
  Pencil,
  ArrowRightLeft,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MergeSuggestion {
  cluster_a: string;
  cluster_b: string;
  similarity: number;
  cluster_a_label: string;
  cluster_b_label: string;
}

interface UnclusteredFace {
  file_id: string;
  det_score?: number;
  [key: string]: unknown;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PeoplePage() {
  const [clusters, setClusters] = useState<PersonCluster[]>([]);
  const [unclusteredCount, setUnclusteredCount] = useState(0);
  const [unclusteredFaces, setUnclusteredFaces] = useState<UnclusteredFace[]>(
    []
  );
  const [suggestions, setSuggestions] = useState<MergeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReclustering, setIsReclustering] = useState(false);
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clusterData, suggestionsData] = await Promise.all([
        nasApiClient.getClustersWithMeta(),
        nasApiClient.getMergeSuggestions().catch(() => ({ suggestions: [] })),
      ]);
      setClusters(clusterData.clusters || []);
      setUnclusteredCount(clusterData.unclustered_count || 0);
      setSuggestions(suggestionsData.suggestions || []);

      // Load unclustered faces if any
      if (clusterData.unclustered_count > 0) {
        const uf = await nasApiClient
          .getUnclusteredFaces(20, 0)
          .catch(() => ({ faces: [], total: 0 }));
        setUnclusteredFaces(uf.faces as UnclusteredFace[]);
      } else {
        setUnclusteredFaces([]);
      }
    } catch {
      setClusters([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleRecluster() {
    setIsReclustering(true);
    try {
      await nasApiClient.triggerRecluster();
      setTimeout(() => loadAll(), 3000);
    } catch {
      alert("Re-cluster failed");
    } finally {
      setIsReclustering(false);
    }
  }

  async function handleRename(clusterId: string) {
    if (!editLabel.trim()) return;
    try {
      await nasApiClient.labelCluster(clusterId, editLabel.trim());
      setEditingCluster(null);
      setEditLabel("");
      loadAll();
    } catch {
      alert("Rename failed");
    }
  }

  async function handleAcceptSuggestion(s: MergeSuggestion) {
    try {
      await nasApiClient.acceptSuggestion(s.cluster_a, s.cluster_b);
      loadAll();
    } catch {
      alert("Merge failed");
    }
  }

  async function handleRejectSuggestion(s: MergeSuggestion) {
    try {
      await nasApiClient.rejectSuggestion(s.cluster_a, s.cluster_b);
      setSuggestions((prev) =>
        prev.filter(
          (p) => p.cluster_a !== s.cluster_a || p.cluster_b !== s.cluster_b
        )
      );
    } catch {
      /* silent */
    }
  }

  async function handleAssignFace(fileId: string, clusterId: string) {
    try {
      await nasApiClient.assignFaceToCluster(fileId, clusterId);
      loadAll();
    } catch {
      alert("Assignment failed");
    }
  }

  // Split into named / unnamed
  const labeled = clusters.filter((c) => c.label && !c.label.startsWith("cluster_"));
  const unnamed = clusters.filter((c) => !c.label || c.label.startsWith("cluster_"));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <Users className="h-5 w-5 text-accent-purple" />
        <h1 className="text-lg font-semibold text-text-primary">People</h1>
        <div className="flex-1" />
        <button
          onClick={handleRecluster}
          disabled={isReclustering}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${isReclustering ? "animate-spin" : ""}`}
          />
          Re-cluster
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : clusters.length === 0 && unclusteredFaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Users className="h-12 w-12 mb-4" />
            <p className="text-sm">No people found yet</p>
            <p className="text-xs mt-1">
              Upload photos with faces to see them here
            </p>
          </div>
        ) : (
          <>
            {/* ── Merge Suggestions Banner ── */}
            {suggestions.length > 0 && (
              <SuggestionsBanner
                suggestions={suggestions}
                onAccept={handleAcceptSuggestion}
                onReject={handleRejectSuggestion}
              />
            )}

            {/* ── Named People ── */}
            {labeled.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">
                  Named · {labeled.length}
                </h2>
                <ClusterGrid
                  clusters={labeled}
                  editingCluster={editingCluster}
                  editLabel={editLabel}
                  onEditLabel={setEditLabel}
                  onEditCluster={setEditingCluster}
                  onRename={handleRename}
                />
              </section>
            )}

            {/* ── Unnamed People ── */}
            {unnamed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">
                  {labeled.length === 0 ? "People" : "Unnamed"} · {unnamed.length}
                </h2>
                <ClusterGrid
                  clusters={unnamed}
                  editingCluster={editingCluster}
                  editLabel={editLabel}
                  onEditLabel={setEditLabel}
                  onEditCluster={setEditingCluster}
                  onRename={handleRename}
                />
              </section>
            )}

            {/* ── Unclustered Faces ("Others") ── */}
            {unclusteredFaces.length > 0 && (
              <OthersSection
                faces={unclusteredFaces}
                total={unclusteredCount}
                clusters={clusters}
                onAssign={handleAssignFace}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Cluster Grid ───────────────────────────────────────────────────────────

function ClusterGrid({
  clusters,
  editingCluster,
  editLabel,
  onEditLabel,
  onEditCluster,
  onRename,
}: {
  clusters: PersonCluster[];
  editingCluster: string | null;
  editLabel: string;
  onEditLabel: (v: string) => void;
  onEditCluster: (id: string | null) => void;
  onRename: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-6">
      {clusters.map((cluster) => (
        <Link
          key={cluster.cluster_id}
          href={`/nas/people/${cluster.cluster_id}`}
          className="group flex flex-col items-center gap-2"
        >
          {/* Face thumbnail circle */}
          <div className="relative">
            <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-border-subtle group-hover:border-accent-blue transition-colors">
              {cluster.representative_file_id ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={nasApiClient.faceThumbnailUrl(
                    cluster.representative_file_id
                  )}
                  alt={cluster.label || "Person"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-accent-purple/10 flex items-center justify-center">
                  <Users className="h-8 w-8 text-accent-purple/50" />
                </div>
              )}
            </div>
            {/* Face count badge */}
            <div className="absolute -bottom-1 -right-1 h-6 min-w-[24px] rounded-full bg-accent-blue flex items-center justify-center px-1">
              <span className="text-[10px] font-bold text-white">
                {cluster.face_count}
              </span>
            </div>
          </div>

          {/* Label */}
          {editingCluster === cluster.cluster_id ? (
            <input
              autoFocus
              value={editLabel}
              onChange={(e) => onEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRename(cluster.cluster_id);
                if (e.key === "Escape") onEditCluster(null);
              }}
              onBlur={() => onRename(cluster.cluster_id)}
              onClick={(e) => e.preventDefault()}
              className="w-full text-center text-xs bg-transparent border-b border-accent-blue text-text-primary focus:outline-none px-1"
            />
          ) : (
            <div className="flex items-center gap-1 group/label">
              <span className="text-xs text-text-secondary text-center truncate max-w-[80px]">
                {cluster.label || "Unknown"}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onEditCluster(cluster.cluster_id);
                  onEditLabel(cluster.label || "");
                }}
                className="opacity-0 group-hover/label:opacity-100 p-0.5"
              >
                <Pencil className="h-3 w-3 text-text-tertiary" />
              </button>
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

// ─── Merge Suggestions Banner ───────────────────────────────────────────────

function SuggestionsBanner({
  suggestions,
  onAccept,
  onReject,
}: {
  suggestions: MergeSuggestion[];
  onAccept: (s: MergeSuggestion) => void;
  onReject: (s: MergeSuggestion) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const s = suggestions[currentIndex];
  if (!s) return null;

  const hueA = Math.abs(s.cluster_a_label.charCodeAt(0) * 37) % 360;
  const hueB = Math.abs(s.cluster_b_label.charCodeAt(0) * 37) % 360;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-r from-accent-purple/[0.08] to-accent-blue/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-purple" />
          <span className="text-xs font-semibold text-accent-purple">
            Same person?
          </span>
        </div>
        {suggestions.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCurrentIndex((i) =>
                  i > 0 ? i - 1 : suggestions.length - 1
                )
              }
              className="p-1 rounded hover:bg-white/5"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-text-tertiary" />
            </button>
            <span className="text-[10px] text-text-tertiary font-medium">
              {currentIndex + 1}/{suggestions.length}
            </span>
            <button
              onClick={() =>
                setCurrentIndex((i) =>
                  i < suggestions.length - 1 ? i + 1 : 0
                )
              }
              className="p-1 rounded hover:bg-white/5"
            >
              <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Person A */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold border-2"
            style={{
              backgroundColor: `hsl(${hueA}, 45%, 55%, 0.15)`,
              borderColor: `hsl(${hueA}, 45%, 55%, 0.4)`,
              color: `hsl(${hueA}, 45%, 55%)`,
            }}
          >
            {s.cluster_a_label?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-[10px] text-text-tertiary truncate max-w-[56px] text-center">
            {s.cluster_a_label}
          </span>
        </div>

        {/* Similarity indicator */}
        <div className="flex flex-col items-center">
          <ArrowRightLeft className="h-5 w-5 text-accent-purple/50" />
          <span className="text-[10px] text-text-tertiary font-medium mt-0.5">
            {Math.round(s.similarity * 100)}%
          </span>
        </div>

        {/* Person B */}
        <div className="flex flex-col items-center gap-1">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold border-2"
            style={{
              backgroundColor: `hsl(${hueB}, 45%, 55%, 0.15)`,
              borderColor: `hsl(${hueB}, 45%, 55%, 0.4)`,
              color: `hsl(${hueB}, 45%, 55%)`,
            }}
          >
            {s.cluster_b_label?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-[10px] text-text-tertiary truncate max-w-[56px] text-center">
            {s.cluster_b_label}
          </span>
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onAccept(s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/15 text-accent-purple text-xs font-semibold hover:bg-accent-purple/25 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Yes
          </button>
          <button
            onClick={() => onReject(s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-text-tertiary text-xs font-semibold hover:bg-white/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            No
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Others Section (Unclustered Faces) ─────────────────────────────────────

function OthersSection({
  faces,
  total,
  clusters,
  onAssign,
}: {
  faces: UnclusteredFace[];
  total: number;
  clusters: PersonCluster[];
  onAssign: (fileId: string, clusterId: string) => void;
}) {
  const [assigningFace, setAssigningFace] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">
        Others · {total}
      </h2>
      <p className="text-xs text-text-tertiary mb-3">
        Faces that haven&apos;t been grouped yet. Tap to assign to a person.
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {faces.map((face) => (
          <div key={face.file_id} className="flex-shrink-0">
            <button
              onClick={() => setAssigningFace(face.file_id)}
              className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-dashed border-white/10 hover:border-accent-blue/50 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={nasApiClient.faceThumbnailUrl(face.file_id, 128)}
                alt="Face"
                className="h-full w-full object-cover"
              />
            </button>
          </div>
        ))}
      </div>

      {/* Assign modal */}
      {assigningFace && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-bg-secondary rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] overflow-y-auto p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Assign to person
            </h3>
            <div className="space-y-1">
              {clusters.map((c) => (
                <button
                  key={c.cluster_id}
                  onClick={() => {
                    onAssign(assigningFace, c.cluster_id);
                    setAssigningFace(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-left"
                >
                  <div className="h-8 w-8 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                    {c.representative_file_id ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={nasApiClient.faceThumbnailUrl(
                          c.representative_file_id,
                          64
                        )}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-accent-purple/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-accent-purple/50" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-text-primary font-medium">
                      {c.label || "Unknown"}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      {c.face_count} photos
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setAssigningFace(null)}
              className="mt-4 w-full py-2 rounded-lg border border-white/10 text-xs font-medium text-text-secondary hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
