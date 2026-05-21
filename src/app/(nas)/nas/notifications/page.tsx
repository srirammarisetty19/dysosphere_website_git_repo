"use client";

// ============================================================================
// Notifications Page
// ============================================================================

import { useEffect, useState } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import type { NasNotification } from "@/lib/nas-types";
import {
  Loader2,
  Bell,
  ArrowLeft,
  Check,
  CheckCheck,
  Trash2,
  Share2,
  AlertTriangle,
  Info,
} from "lucide-react";
import Link from "next/link";

const ICON_MAP: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  share: { icon: Share2, color: "text-blue-400" },
  alert: { icon: AlertTriangle, color: "text-amber-400" },
  system: { icon: Info, color: "text-text-tertiary" },
  task_complete: { icon: Check, color: "text-green-400" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NasNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setIsLoading(true);
    try {
      const data = await nasApiClient.getNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await nasApiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await nasApiClient.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    try {
      await nasApiClient.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleClearAll() {
    if (!confirm("Clear all notifications?")) return;
    try {
      await nasApiClient.clearAllNotifications();
      setNotifications([]);
    } catch {
      // ignore
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <Bell className="h-5 w-5 text-text-secondary" />
        <h1 className="text-lg font-semibold text-text-primary">
          Notifications
        </h1>
        {unreadCount > 0 && (
          <span className="h-5 min-w-[20px] rounded-full bg-red-500 flex items-center justify-center px-1.5 text-[11px] font-bold text-white">
            {unreadCount}
          </span>
        )}
        <div className="flex-1" />
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/5"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
        {notifications.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
            <Bell className="h-12 w-12 mb-4" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {notifications.map((notif) => {
              const typeInfo = ICON_MAP[notif.type] || ICON_MAP.system;
              const Icon = typeInfo.icon;

              return (
                <div
                  key={notif.id}
                  className={`
                    flex items-start gap-4 px-6 py-4 transition-colors group
                    ${notif.is_read ? "" : "bg-accent-blue/[0.03]"}
                  `}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0">
                    {!notif.is_read ? (
                      <div className="h-2 w-2 rounded-full bg-accent-blue" />
                    ) : (
                      <div className="h-2 w-2" />
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className={`h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${typeInfo.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-medium">
                      {notif.title}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {notif.message}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-text-tertiary"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
