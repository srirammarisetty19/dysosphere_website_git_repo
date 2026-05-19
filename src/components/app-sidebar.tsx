"use client";

// ============================================================================
// App Sidebar — Shared navigation for all (app) routes
// Conversation list on chat, navigation links for other pages
// Desktop: persistent | Mobile: slide-out drawer
// ============================================================================

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  X,
  MessageSquare,
  Pin,
  Trash2,
  Pencil,
  EyeOff,
  Calendar,
  Settings,
  Zap,
  Menu,
  FileText,
} from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { DSLogo } from "@/components/ui/ds-logo";

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/reminders", label: "Reminders", icon: Zap },
  { href: "/artifacts", label: "Artifacts", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const isChat = pathname === "/chat";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-[var(--color-bg-secondary)] border-r border-white/[0.06]
          flex flex-col
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-2">
            <DSLogo size={18} className="text-[var(--color-accent-blue)]" />
            <span className="text-white/70 text-sm font-semibold tracking-tight">
              Sphere AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-3 space-y-1 border-b border-white/[0.04]">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/[0.08] text-white border border-white/[0.1]"
                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Chat-specific section — only show when on /chat */}
        {isChat ? (
          <ChatSection onClose={onClose} />
        ) : (
          <div className="flex-1" />
        )}

        {/* Server status */}
        <ServerStatus />
      </aside>
    </>
  );
}

// ── Chat-specific sidebar content ──────────────────────────────────────
function ChatSection({ onClose }: { onClose: () => void }) {
  const {
    conversations,
    conversationId,
    loadConversation,
    newChat,
    deleteConversation,
    renameConversation,
    loadConversations,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((c) =>
    searchQuery
      ? (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const handleNewChat = (temporary = false) => {
    newChat(temporary, temporary ? "This chat won't be saved" : undefined);
    onClose();
  };

  const handleSelectConversation = (id: string) => {
    loadConversation(id);
    onClose();
  };

  const handleRename = (id: string, title: string) => {
    if (title.trim()) {
      renameConversation(id, title.trim());
    }
    setRenameId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* New Chat Buttons */}
      <div className="px-3 py-3 space-y-1.5">
        <button
          onClick={() => handleNewChat(false)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all text-white/70 text-sm font-medium"
        >
          <Plus size={16} />
          New Chat
        </button>
        <button
          onClick={() => handleNewChat(true)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl hover:bg-white/[0.04] transition-colors text-white/30 text-xs"
        >
          <EyeOff size={14} />
          Temporary Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20"
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white/[0.04] rounded-lg text-white text-xs placeholder:text-white/15 border border-transparent focus:border-white/10 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {filteredConversations.map((convo, index) => {
          const isActive = convo.id === conversationId;

          return (
            <div
              key={convo.id || `convo-${index}`}
              className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                isActive
                  ? "bg-white/[0.08] border border-white/[0.1]"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
              onClick={() => handleSelectConversation(convo.id)}
            >
              {/* Pin indicator */}
              {convo.is_pinned && (
                <Pin
                  size={11}
                  className="text-[var(--color-accent-cyan)]/50 shrink-0 rotate-45"
                />
              )}

              {/* Title or rename input */}
              <div className="flex-1 min-w-0">
                {renameId === convo.id ? (
                  <input
                    autoFocus
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onBlur={() => handleRename(convo.id, renameTitle)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(convo.id, renameTitle);
                      if (e.key === "Escape") setRenameId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none"
                  />
                ) : (
                  <p className="text-white/60 text-[13px] truncate leading-tight">
                    {convo.title || "Untitled"}
                  </p>
                )}
                <p className="text-white/20 text-[10px] mt-0.5">
                  {formatDate(convo.created_at)}
                </p>
              </div>

              {/* Action buttons (visible on hover) */}
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameId(convo.id);
                    setRenameTitle(convo.title || "");
                  }}
                  className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
                  title="Rename"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(convo.id);
                  }}
                  className="p-1 rounded text-white/20 hover:text-red-400/70 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredConversations.length === 0 && (
          <div className="px-4 py-8 text-center">
            <MessageSquare size={24} className="text-white/10 mx-auto mb-2" />
            <p className="text-white/20 text-xs">
              {searchQuery ? "No matching conversations" : "No conversations yet"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Server status indicator ────────────────────────────────────────────
function ServerStatus() {
  const server = typeof window !== "undefined" ? localStorage.getItem("spherex_server") : null;
  if (!server) return null;

  return (
    <div className="border-t border-white/[0.04] px-4 py-3 shrink-0">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
        <span className="text-white/20 text-[10px] truncate">
          {server.replace(/^https?:\/\//, "")}
        </span>
      </div>
    </div>
  );
}

// ── Mobile menu toggle (exported for use in page headers) ──────────────
export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
    >
      <Menu size={20} />
    </button>
  );
}
