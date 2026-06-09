"use client";

// ============================================================================
// Chat Sidebar — Conversation list with sectioned categorization
//
// Sections (industry pattern — Google Gemini / ChatGPT sidebar):
//   • Pinned            — user-pinned conversations (always shown at top)
//   • NAS InPlace AI    — file-scoped "Ask AI" chats (📎 prefix)
//   • Reminders         — scheduler/heartbeat-triggered chats (⏰ prefix)
//   • Regular Chats     — everything else
//
// Sections are collapsible (default: NAS & Reminders collapsed, Regular open).
// File reference displayed as subtitle on NAS InPlace AI tiles.
// ============================================================================

import { useState, useEffect } from "react";
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
  Clock,
  Paperclip,
  AlarmClock,
  ChevronRight,
  ChevronDown,
  MessagesSquare,
} from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { DSLogo } from "@/components/ui/ds-logo";
import type { Conversation } from "@/lib/types";

// ── Conversation Classifier ─────────────────────────────────────────────────

type ConversationCategory = "nas_inplace" | "reminder" | "regular";

function classifyConversation(c: Conversation): ConversationCategory {
  // 1. Prefer structured metadata (future-proof)
  if (c.metadata?.context_type === "nas_inplace") return "nas_inplace";
  if (c.metadata?.context_type === "reminder") return "reminder";
  // 2. Fall back to emoji title prefix (backward compat with existing sessions)
  if (c.title?.startsWith("📎")) return "nas_inplace";
  if (c.title?.startsWith("⏰")) return "reminder";
  return "regular";
}

/** Extract the display name for a NAS InPlace AI conversation.
 *  Prefers structured metadata; falls back to stripping the '📎 ' prefix. */
function getNasFilename(c: Conversation): string {
  if (c.metadata?.source_file?.filename) return c.metadata.source_file.filename;
  const title = c.title ?? "";
  return title.startsWith("📎 ") ? title.slice(2).trim() : title;
}

// ── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-white/[0.03] transition-colors group"
    >
      <span className="text-white/25">{icon}</span>
      <span className="flex-1 text-white/30 text-[11px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-[10px] text-white/20 bg-white/[0.05] px-1.5 py-0.5 rounded-full mr-1">
        {count}
      </span>
      <span className="text-white/15 group-hover:text-white/30 transition-colors">
        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </span>
    </button>
  );
}

// ── Conversation Tile ───────────────────────────────────────────────────────

function ConversationTile({
  convo,
  isActive,
  showPin,
  subtitle,
  renameId,
  renameTitle,
  onSelect,
  onRenameStart,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onPin,
  onDelete,
  formatDate,
}: {
  convo: Conversation;
  isActive: boolean;
  showPin?: boolean;
  subtitle?: string; // file reference for NAS InPlace AI tiles
  renameId: string | null;
  renameTitle: string;
  onSelect: () => void;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onPin: () => void;
  onDelete: () => void;
  formatDate: (d: string) => string;
}) {
  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
        isActive
          ? "bg-white/[0.08] border border-white/[0.1]"
          : "hover:bg-white/[0.04] border border-transparent"
      }`}
      onClick={onSelect}
    >
      {/* Pin indicator */}
      {showPin && convo.is_pinned && (
        <Pin size={11} className="text-[var(--color-accent-cyan)]/50 shrink-0 rotate-45" />
      )}

      {/* Title / rename input + metadata */}
      <div className="flex-1 min-w-0">
        {renameId === convo.id ? (
          <input
            autoFocus
            value={renameTitle}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none"
          />
        ) : (
          <>
            <p className="text-white/60 text-[13px] truncate leading-tight">
              {convo.title || "Untitled"}
            </p>
            {subtitle && (
              <p className="flex items-center gap-1 text-[10px] text-white/25 mt-0.5 truncate">
                <Paperclip size={9} className="shrink-0 text-[var(--color-accent-blue)]/40" />
                <span className="truncate">{subtitle}</span>
              </p>
            )}
            {!subtitle && (
              <p className="text-white/20 text-[10px] mt-0.5">
                {formatDate(convo.created_at)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
          className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
          title="Rename"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
          title={convo.is_pinned ? "Unpin" : "Pin"}
        >
          <Pin size={12} className={convo.is_pinned ? "rotate-45" : ""} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded text-white/20 hover:text-red-400/70 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Main Sidebar ────────────────────────────────────────────────────────────

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const {
    conversations,
    conversationId,
    loadConversation,
    newChat,
    deleteConversation,
    renameConversation,
    togglePin,
    loadConversations,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  // Section open state — NAS & Reminders default collapsed, Regular open
  const [nasOpen, setNasOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [regularOpen, setRegularOpen] = useState(true);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const filteredConversations = conversations.filter((c) =>
    searchQuery
      ? (c.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  // Partition into categories
  const pinned = filteredConversations.filter((c) => c.is_pinned);
  const unpinned = filteredConversations.filter((c) => !c.is_pinned);
  const nasChats = unpinned.filter((c) => classifyConversation(c) === "nas_inplace");
  const reminders = unpinned.filter((c) => classifyConversation(c) === "reminder");
  const regularChats = unpinned.filter((c) => classifyConversation(c) === "regular");

  const handleNewChat = (temporary = false) => {
    newChat(temporary, temporary ? "This chat won't be saved" : undefined);
    onClose();
  };

  const handleSelectConversation = (id: string) => {
    loadConversation(id);
    onClose();
  };

  const handleRename = (id: string, title: string) => {
    if (title.trim()) renameConversation(id, title.trim());
    setRenameId(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const tileProps = (convo: Conversation) => ({
    convo,
    isActive: convo.id === conversationId,
    renameId,
    renameTitle,
    onSelect: () => handleSelectConversation(convo.id),
    onRenameStart: () => { setRenameId(convo.id); setRenameTitle(convo.title || ""); },
    onRenameChange: setRenameTitle,
    onRenameCommit: () => handleRename(convo.id, renameTitle),
    onRenameCancel: () => setRenameId(null),
    onPin: () => togglePin(convo.id, convo.is_pinned || false),
    onDelete: () => deleteConversation(convo.id),
    formatDate,
  });

  const totalCount = filteredConversations.length;

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
        <div className="flex-1 overflow-y-auto">
          {totalCount === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare size={24} className="text-white/10 mx-auto mb-2" />
              <p className="text-white/20 text-xs">
                {searchQuery ? "No matching conversations" : "No conversations yet"}
              </p>
            </div>
          ) : (
            <div className="py-1">

              {/* ── Pinned ──────────────────────────────────────────── */}
              {pinned.length > 0 && (
                <div className="mb-1">
                  <div className="flex items-center gap-2 px-4 py-1.5">
                    <Pin size={11} className="text-white/25 rotate-45" />
                    <span className="text-white/30 text-[11px] font-semibold uppercase tracking-[0.08em]">
                      Pinned
                    </span>
                  </div>
                  <div className="px-2 space-y-0.5">
                    {pinned.map((c) => (
                      <ConversationTile
                        key={c.id}
                        showPin
                        subtitle={
                          classifyConversation(c) === "nas_inplace"
                            ? getNasFilename(c)
                            : undefined
                        }
                        {...tileProps(c)}
                      />
                    ))}
                  </div>
                  <div className="my-2 mx-4 border-t border-white/[0.04]" />
                </div>
              )}

              {/* ── NAS InPlace AI ───────────────────────────────────── */}
              {nasChats.length > 0 && (
                <div className="mb-1">
                  <SectionHeader
                    icon={<Paperclip size={12} />}
                    label="NAS InPlace AI"
                    count={nasChats.length}
                    isOpen={nasOpen}
                    onToggle={() => setNasOpen((p) => !p)}
                  />
                  {nasOpen && (
                    <div className="px-2 space-y-0.5 mt-0.5">
                      {nasChats.map((c) => (
                        <ConversationTile
                          key={c.id}
                          subtitle={getNasFilename(c)}
                          {...tileProps(c)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="my-2 mx-4 border-t border-white/[0.04]" />
                </div>
              )}

              {/* ── Reminders ───────────────────────────────────────── */}
              {reminders.length > 0 && (
                <div className="mb-1">
                  <SectionHeader
                    icon={<AlarmClock size={12} />}
                    label="Reminders"
                    count={reminders.length}
                    isOpen={remindersOpen}
                    onToggle={() => setRemindersOpen((p) => !p)}
                  />
                  {remindersOpen && (
                    <div className="px-2 space-y-0.5 mt-0.5">
                      {reminders.map((c) => (
                        <ConversationTile key={c.id} {...tileProps(c)} />
                      ))}
                    </div>
                  )}
                  <div className="my-2 mx-4 border-t border-white/[0.04]" />
                </div>
              )}

              {/* ── Regular Chats ────────────────────────────────────── */}
              {regularChats.length > 0 && (
                <div>
                  {/* Only show section header if other sections exist */}
                  {(nasChats.length > 0 || reminders.length > 0 || pinned.length > 0) ? (
                    <SectionHeader
                      icon={<MessagesSquare size={12} />}
                      label="Chats"
                      count={regularChats.length}
                      isOpen={regularOpen}
                      onToggle={() => setRegularOpen((p) => !p)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-1.5">
                      <span className="text-white/30 text-[11px] font-semibold uppercase tracking-[0.08em]">
                        Recent
                      </span>
                    </div>
                  )}
                  {regularOpen && (
                    <div className="px-2 space-y-0.5 mt-0.5">
                      {regularChats.map((c) => (
                        <ConversationTile key={c.id} {...tileProps(c)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="h-6" />
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="border-t border-white/[0.04] px-3 py-2 space-y-0.5 shrink-0">
          <SidebarLink icon={<Calendar size={16} />} label="Calendar" href="/calendar" />
          <SidebarLink icon={<Clock size={16} />} label="Reminders" href="/reminders" />
          <SidebarLink icon={<Settings size={16} />} label="Settings" href="/settings" />
        </div>
      </aside>
    </>
  );
}

function SidebarLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors text-sm"
    >
      {icon}
      {label}
    </a>
  );
}
