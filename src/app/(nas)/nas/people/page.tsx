"use client";

// ============================================================================
// People Page — Face clusters grid (Google Photos style)
// ============================================================================

import { useEffect, useState } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { PersonCluster } from "@/lib/nas-types";
import { Loader2, Users, RefreshCw, ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";

export default function PeoplePage() {
  const [clusters, setClusters] = useState<PersonCluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReclustering, setIsReclustering] = useState(false);
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    loadClusters();
  }, []);

  async function loadClusters() {
    setIsLoading(true);
    try {
      const data = await nasApiClient.getClusters();
      setClusters(data);
    } catch {
      setClusters([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRecluster() {
    setIsReclustering(true);
    try {
      await nasApiClient.triggerRecluster();
      await loadClusters();
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
      loadClusters();
    } catch {
      alert("Rename failed");
    }
  }

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

      {/* Clusters Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : clusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Users className="h-12 w-12 mb-4" />
            <p className="text-sm">No people found yet</p>
            <p className="text-xs mt-1">
              Upload photos with faces to see them here
            </p>
          </div>
        ) : (
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
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleRename(cluster.cluster_id);
                      if (e.key === "Escape") setEditingCluster(null);
                    }}
                    onBlur={() => handleRename(cluster.cluster_id)}
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
                        setEditingCluster(cluster.cluster_id);
                        setEditLabel(cluster.label || "");
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
        )}
      </div>
    </div>
  );
}
