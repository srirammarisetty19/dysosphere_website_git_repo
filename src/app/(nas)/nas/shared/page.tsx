"use client";

// ============================================================================
// Shared Files Page — "Shared with me" and "Shared by me" tabs
// ============================================================================

import { useEffect, useState } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { ShareItem } from "@/lib/nas-types";
import { formatBytes } from "@/lib/nas-types";
import { Loader2, Share2, ArrowLeft, Users, FileText } from "lucide-react";
import Link from "next/link";

export default function SharedPage() {
  const [sharedWithMe, setSharedWithMe] = useState<ShareItem[]>([]);
  const [sharedByMe, setSharedByMe] = useState<ShareItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"with" | "by">("with");

  useEffect(() => {
    loadShared();
  }, []);

  async function loadShared() {
    setIsLoading(true);
    try {
      const data = await nasApiClient.listShared();
      setSharedWithMe(data.shared_with_me || []);
      setSharedByMe(data.shared_by_me || []);
    } catch {
      setSharedWithMe([]);
      setSharedByMe([]);
    } finally {
      setIsLoading(false);
    }
  }

  const activeItems = activeTab === "with" ? sharedWithMe : sharedByMe;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <Share2 className="h-5 w-5 text-accent-blue" />
        <h1 className="text-lg font-semibold text-text-primary">Shared</h1>
      </div>

      {/* Tabs */}
      <div className="flex px-6 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab("with")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "with"
              ? "border-accent-blue text-accent-blue"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Shared with me
        </button>
        <button
          onClick={() => setActiveTab("by")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "by"
              ? "border-accent-blue text-accent-blue"
              : "border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          Shared by me
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Users className="h-12 w-12 mb-4" />
            <p className="text-sm">
              {activeTab === "with"
                ? "No files shared with you yet"
                : "You haven't shared any files yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activeItems.map((share) => (
              <div
                key={share.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-accent-blue/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-accent-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate font-medium">
                    {share.item_name}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {activeTab === "with"
                      ? `Shared by ${share.owner_username}`
                      : `Shared with ${share.shared_with_username}`}
                    {" · "}
                    {share.permission}
                  </p>
                </div>
                <span className="text-xs text-text-tertiary">
                  {new Date(share.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
