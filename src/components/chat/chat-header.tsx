"use client";

// ============================================================================
// Chat Header — Port of AppBar from home_screen.dart
// Bell icon → notifications dropdown, ... → chat options menu
// ============================================================================

import { useState, useRef, useEffect } from "react";
import { Menu, Bell, MoreHorizontal, Pencil, Pin, Trash2, X, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { apiClient } from "@/lib/api-client";

interface ChatHeaderProps {
  title: string;
  isTemporary?: boolean;
  description?: string | null;
  username: string;
  onMenuClick: () => void;
}

export function ChatHeader({
  title,
  isTemporary,
  username,
  onMenuClick,
}: ChatHeaderProps) {
  const { user } = useAuthStore();
  const initial = (user?.username || username || "U")[0].toUpperCase();

  return (
    <header className="flex items-center h-14 px-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] shrink-0">
      {/* Menu button (mobile) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
        aria-label="Open sidebar"
      >
        <Menu size={22} />
      </button>

      {/* Title */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-2">
        {isTemporary && (
          <span className="text-[var(--color-text-muted)] mr-1.5 text-sm">👻</span>
        )}
        <span className="text-[var(--color-text-secondary)] text-[15px] font-medium truncate">
          {title}
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <NotificationBell />

        {/* More options */}
        <ChatOptionsMenu />

        {/* Avatar */}
        <div className="ml-1 mr-1">
          <div className="w-8 h-8 rounded-full bg-[var(--color-accent-blue)] flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {initial}
              </span>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Notification Bell with Dropdown ─────────────────────────────────────
interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Real-time badge updates via WebSocket (Google/Slack pattern)
  // Falls back to REST polling if WS is not connected.
  useEffect(() => {
    // Initial fetch via REST API
    const fetchUnread = async () => {
      try {
        const count = await apiClient.getUnreadCount();
        setUnreadCount(count || 0);
      } catch {
        // ignore
      }
    };
    fetchUnread();

    // Subscribe to WebSocket events for real-time updates
    const unsubscribe = apiClient.onNotification((event) => {
      if (event.type === "badge_update" && typeof event.unread_count === "number") {
        setUnreadCount(event.unread_count);
      } else if (event.type === "notification") {
        // New notification arrived — increment badge
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Fallback polling every 60s (in case WS is not connected)
    const interval = setInterval(fetchUnread, 60_000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(0);
      // Mark all as read
      await apiClient.markAllNotificationsRead().catch(() => {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) loadNotifications();
    setIsOpen(!isOpen);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    try {
      await apiClient.clearAllNotifications();
      setNotifications([]);
    } catch {
      // ignore
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[400px] rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <h3 className="text-white/70 text-sm font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-white/20 text-[10px] hover:text-white/40 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[340px]">
            {loading ? (
              <div className="py-8 text-center">
                <Loader2 className="animate-spin text-white/15 mx-auto" size={20} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell size={24} className="text-white/20 mx-auto mb-2" />
                <p className="text-white/30 text-xs">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[13px] font-medium truncate">
                      {n.title}
                    </p>
                    <p className="text-white/40 text-[11px] mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-white/25 text-[10px] mt-1">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="hidden group-hover:block p-1 text-white/20 hover:text-red-400/60 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chat Options Menu (... button) ─────────────────────────────────────
function ChatOptionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    conversationId,
    currentTitle,
    isTemporaryMode,
    renameConversation,
    deleteConversation,
    togglePin,
    conversations,
  } = useChatStore();

  const currentConvo = conversations.find((c) => c.id === conversationId);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowRename(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!conversationId || isTemporaryMode) {
    return (
      <button
        className="p-2 rounded-lg text-white/20 cursor-not-allowed"
        aria-label="More options"
        disabled
      >
        <MoreHorizontal size={20} />
      </button>
    );
  }

  const handleRename = () => {
    if (renameValue.trim()) {
      renameConversation(conversationId, renameValue.trim());
    }
    setShowRename(false);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (confirm("Delete this conversation? This cannot be undone.")) {
      deleteConversation(conversationId);
    }
    setIsOpen(false);
  };

  const handlePin = () => {
    togglePin(conversationId, currentConvo?.is_pinned || false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowRename(false);
        }}
        className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        aria-label="More options"
      >
        <MoreHorizontal size={20} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-2xl overflow-hidden z-50">
          {showRename ? (
            <div className="p-3 space-y-2">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setShowRename(false);
                    setIsOpen(false);
                  }
                }}
                placeholder="New title"
                className="w-full px-3 py-2 bg-white/[0.06] rounded-lg text-white text-xs placeholder:text-white/20 border border-transparent focus:border-white/15 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRename(false)}
                  className="flex-1 py-1.5 text-[11px] text-white/30 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  className="flex-1 py-1.5 text-[11px] text-[var(--color-accent-blue)] font-semibold rounded-lg hover:bg-[var(--color-accent-blue)]/10 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowRename(true);
                  setRenameValue(currentTitle || "");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:bg-white/[0.04] transition-colors text-sm"
              >
                <Pencil size={14} />
                Rename
              </button>
              <button
                onClick={handlePin}
                className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:bg-white/[0.04] transition-colors text-sm"
              >
                <Pin size={14} className={currentConvo?.is_pinned ? "rotate-45" : ""} />
                {currentConvo?.is_pinned ? "Unpin" : "Pin"}
              </button>
              <div className="border-t border-white/[0.06]" />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400/70 hover:bg-red-500/5 transition-colors text-sm"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
