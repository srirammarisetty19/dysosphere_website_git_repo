"use client";

// ============================================================================
// Sync Dashboard Page — Cross-device folder sync management
// Google Drive "Computers" style management console
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { SyncFolder, SyncFolderStatus, SyncDirection } from "@/lib/nas-types";
import {
  ArrowLeft,
  RefreshCw,
  Smartphone,
  Laptop,
  Monitor,
  Wifi,
  WifiOff,
  Check,
  Clock,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowUpDown,
  Loader2,
  FolderSync,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import Link from "next/link";

// ── Device icon helper ──────────────────────────────────────────────────

function DeviceIcon({
  type,
  className = "h-5 w-5",
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case "android":
    case "ios":
      return <Smartphone className={className} />;
    case "macos":
      return <Laptop className={className} />;
    case "windows":
    case "linux":
      return <Monitor className={className} />;
    default:
      return <Monitor className={className} />;
  }
}

function directionIcon(dir: SyncDirection) {
  switch (dir) {
    case "upload":
      return <ArrowUpFromLine className="h-3.5 w-3.5" />;
    case "download":
      return <ArrowDownToLine className="h-3.5 w-3.5" />;
    case "bidirectional":
      return <ArrowUpDown className="h-3.5 w-3.5" />;
  }
}

function directionLabel(dir: SyncDirection) {
  switch (dir) {
    case "upload":
      return "Upload only";
    case "download":
      return "Download only";
    case "bidirectional":
      return "Two-way sync";
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function deviceTypeLabel(type: string): string {
  switch (type) {
    case "android":
      return "Android";
    case "ios":
      return "iPhone";
    case "macos":
      return "Mac";
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return "Device";
  }
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function SyncDashboardPage() {
  const [folders, setFolders] = useState<SyncFolder[]>([]);
  const [statuses, setStatuses] = useState<SyncFolderStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load Data ───────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [foldersRes, statusRes] = await Promise.all([
        nasApiClient.listSyncFolders(),
        nasApiClient.getSyncStatus(),
      ]);
      setFolders(foldersRes.sync_folders || []);
      setStatuses(statusRes.folders || []);
    } catch (err) {
      setError("Failed to load sync data");
      console.error("[SyncDashboard]", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Get status for a folder ─────────────────────────────────────────

  function getStatus(folderId: string): SyncFolderStatus | undefined {
    return statuses.find((s) => s.sync_folder_id === folderId);
  }

  // ── Group folders by device ─────────────────────────────────────────

  const deviceGroups = folders.reduce<
    Record<string, { deviceName: string; deviceType: string; folders: SyncFolder[] }>
  >((acc, f) => {
    const key = f.device_id;
    if (!acc[key]) {
      acc[key] = {
        deviceName: f.device_name || deviceTypeLabel(f.device_type),
        deviceType: f.device_type,
        folders: [],
      };
    }
    acc[key].folders.push(f);
    return acc;
  }, {});

  // ── Handlers ────────────────────────────────────────────────────────

  async function handleToggle(folderId: string, enabled: boolean) {
    try {
      await nasApiClient.updateSyncFolder(folderId, { sync_enabled: enabled });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, sync_enabled: enabled } : f))
      );
    } catch {
      // Revert on failure
    }
  }

  async function handleUpdateDirection(folderId: string, direction: SyncDirection) {
    try {
      await nasApiClient.updateSyncFolder(folderId, { sync_direction: direction });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, sync_direction: direction } : f))
      );
    } catch {
      // ignore
    }
  }

  async function handleToggleWifi(folderId: string, wifiOnly: boolean) {
    try {
      await nasApiClient.updateSyncFolder(folderId, { wifi_only: wifiOnly });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, wifi_only: wifiOnly } : f))
      );
    } catch {
      // ignore
    }
  }

  async function handleDelete(folderId: string) {
    try {
      await nasApiClient.deleteSyncFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setConfirmDeleteId(null);
    } catch {
      // ignore
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <FolderSync className="h-5 w-5 text-accent-green" />
        <h1 className="text-lg font-semibold text-text-primary">Folder Sync</h1>
        <div className="flex-1" />
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {/* Info Banner */}
        <div className="rounded-2xl border border-accent-green/15 bg-accent-green/[0.04] p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent-green/10 flex items-center justify-center shrink-0">
              <FolderSync className="h-5 w-5 text-accent-green" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                Sync Management
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                View and manage folder sync across all your devices. Synced files
                get full AI search, face detection, and captioning.
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-accent-red/20 bg-accent-red/5 px-4 py-3 mb-6 flex items-center gap-2 text-sm text-accent-red">
            <Info className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : folders.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <div className="h-20 w-20 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-5">
              <FolderSync className="h-9 w-9" />
            </div>
            <p className="text-base font-medium text-text-secondary">
              No folders syncing
            </p>
            <p className="text-sm text-text-tertiary mt-2 text-center max-w-sm">
              To start syncing, open the SphereX NAS app on your phone or desktop
              and go to{" "}
              <span className="text-text-secondary font-medium">
                Settings → Folder Sync
              </span>
              .
            </p>
            <div className="flex items-center gap-3 mt-6">
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-border-subtle px-4 py-2.5">
                <Smartphone className="h-4 w-4 text-accent-blue" />
                <span className="text-xs text-text-secondary">Mobile App</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-border-subtle px-4 py-2.5">
                <Laptop className="h-4 w-4 text-accent-purple" />
                <span className="text-xs text-text-secondary">Desktop App</span>
              </div>
            </div>
          </div>
        ) : (
          /* Device Groups */
          <div className="space-y-6">
            <p className="text-xs font-semibold text-accent-blue uppercase tracking-wider px-1">
              Synced Devices ({Object.keys(deviceGroups).length})
            </p>

            {Object.entries(deviceGroups).map(
              ([deviceId, { deviceName, deviceType, folders: deviceFolders }]) => (
                <div
                  key={deviceId}
                  className="rounded-2xl border border-border-subtle bg-bg-tertiary overflow-hidden"
                >
                  {/* Device Header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-subtle">
                    <div className="h-9 w-9 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                      <DeviceIcon
                        type={deviceType}
                        className="h-4.5 w-4.5 text-accent-blue"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {deviceName}
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        {deviceTypeLabel(deviceType)} ·{" "}
                        {deviceFolders.length} folder
                        {deviceFolders.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Folders */}
                  {deviceFolders.map((folder, idx) => {
                    const status = getStatus(folder.id);
                    const isExpanded = expandedId === folder.id;
                    const isDeleting = confirmDeleteId === folder.id;

                    return (
                      <div
                        key={folder.id}
                        className={
                          idx > 0 ? "border-t border-border-subtle" : ""
                        }
                      >
                        {/* Folder Row */}
                        <div className="flex items-center gap-3 px-5 py-3">
                          {/* Status dot */}
                          <div className="shrink-0">
                            {!folder.sync_enabled ? (
                              <div className="h-2.5 w-2.5 rounded-full bg-text-tertiary" />
                            ) : status?.pending_changes &&
                              status.pending_changes > 0 ? (
                              <div className="h-2.5 w-2.5 rounded-full bg-accent-orange animate-pulse" />
                            ) : (
                              <div className="h-2.5 w-2.5 rounded-full bg-accent-green" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">
                              {folder.directory_name ||
                                folder.local_path
                                  .split("/")
                                  .filter(Boolean)
                                  .pop() ||
                                "Synced Folder"}
                            </p>
                            <p className="text-[11px] text-text-tertiary truncate mt-0.5">
                              {folder.local_path} →{" "}
                              {folder.directory_path || `/${folder.directory_name}`}
                            </p>
                          </div>

                          {/* Status chips */}
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            {folder.sync_enabled && (
                              <>
                                {status?.last_synced_at ? (
                                  <span className="flex items-center gap-1 text-[11px] text-accent-green">
                                    <Check className="h-3 w-3" />
                                    {formatRelativeTime(status.last_synced_at)}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                                    <Clock className="h-3 w-3" />
                                    Never synced
                                  </span>
                                )}
                                {status?.synced_files !== undefined && (
                                  <span className="text-[11px] text-text-tertiary">
                                    · {status.synced_files.toLocaleString()} files
                                  </span>
                                )}
                              </>
                            )}
                            {!folder.sync_enabled && (
                              <span className="text-[11px] text-text-tertiary">
                                Paused
                              </span>
                            )}
                          </div>

                          {/* Toggle */}
                          <button
                            onClick={() =>
                              handleToggle(folder.id, !folder.sync_enabled)
                            }
                            className={`
                              relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200
                              ${folder.sync_enabled ? "bg-accent-blue" : "bg-white/10"}
                            `}
                          >
                            <div
                              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                              style={{
                                transform: folder.sync_enabled
                                  ? "translateX(20px)"
                                  : "translateX(0)",
                              }}
                            />
                          </button>

                          {/* Expand */}
                          <button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : folder.id)
                            }
                            className="p-1.5 rounded-lg hover:bg-white/5 text-text-tertiary transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {/* Mobile status (visible on small screens only) */}
                        <div className="flex sm:hidden items-center gap-2 px-5 pb-2 -mt-1">
                          {folder.sync_enabled && status?.last_synced_at ? (
                            <span className="flex items-center gap-1 text-[11px] text-accent-green">
                              <Check className="h-3 w-3" />
                              {formatRelativeTime(status.last_synced_at)}
                            </span>
                          ) : folder.sync_enabled ? (
                            <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
                              <Clock className="h-3 w-3" />
                              Never synced
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-tertiary">
                              Paused
                            </span>
                          )}
                          {status?.synced_files !== undefined && (
                            <span className="text-[11px] text-text-tertiary">
                              · {status.synced_files.toLocaleString()} files
                            </span>
                          )}
                        </div>

                        {/* Expanded Settings */}
                        {isExpanded && (
                          <div className="px-5 pb-4 space-y-3 animate-in">
                            {/* Tags row */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Wi-Fi toggle chip */}
                              <button
                                onClick={() =>
                                  handleToggleWifi(folder.id, !folder.wifi_only)
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                  folder.wifi_only
                                    ? "bg-accent-blue/5 border-accent-blue/15 text-accent-blue"
                                    : "bg-white/[0.03] border-border-subtle text-text-tertiary hover:text-text-secondary"
                                }`}
                              >
                                {folder.wifi_only ? (
                                  <Wifi className="h-3 w-3" />
                                ) : (
                                  <WifiOff className="h-3 w-3" />
                                )}
                                {folder.wifi_only ? "Wi-Fi only" : "Any network"}
                              </button>

                              {/* Sync direction selector */}
                              {(
                                ["upload", "download", "bidirectional"] as SyncDirection[]
                              ).map((dir) => (
                                <button
                                  key={dir}
                                  onClick={() =>
                                    handleUpdateDirection(folder.id, dir)
                                  }
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                    folder.sync_direction === dir
                                      ? "bg-accent-blue/5 border-accent-blue/15 text-accent-blue"
                                      : "bg-white/[0.03] border-border-subtle text-text-tertiary hover:text-text-secondary"
                                  }`}
                                >
                                  {directionIcon(dir)}
                                  {directionLabel(dir)}
                                </button>
                              ))}
                            </div>

                            {/* Pending changes */}
                            {status?.pending_changes !== undefined &&
                              status.pending_changes > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-orange/5 border border-accent-orange/10 text-[11px] text-accent-orange">
                                  <Clock className="h-3.5 w-3.5" />
                                  {status.pending_changes} change
                                  {status.pending_changes > 1 ? "s" : ""} pending
                                  sync
                                </div>
                              )}

                            {/* Remove button */}
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-[11px] text-text-tertiary">
                                Registered{" "}
                                {new Date(folder.created_at).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </p>

                              {isDeleting ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-accent-red">
                                    Remove sync? NAS files preserved.
                                  </span>
                                  <button
                                    onClick={() => handleDelete(folder.id)}
                                    className="px-3 py-1 rounded-lg bg-accent-red/10 text-[11px] font-medium text-accent-red hover:bg-accent-red/20 transition-colors"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-3 py-1 rounded-lg bg-white/5 text-[11px] text-text-tertiary hover:bg-white/10 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(folder.id)}
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] text-text-tertiary hover:text-accent-red hover:bg-accent-red/5 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Remove sync
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Add folder CTA */}
            <div className="rounded-2xl border border-dashed border-border-default bg-white/[0.01] p-5">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-text-tertiary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-text-secondary">
                    Want to sync another folder?
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Open the SphereX NAS app on your phone or desktop → Settings →
                    Folder Sync to add new folders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
