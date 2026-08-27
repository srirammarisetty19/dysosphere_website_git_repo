"use client";

// ============================================================================
// Chat Page — Main chat interface
// Enhanced for web: gradient branding, better empty state, keyboard navigation
// ============================================================================

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useChatStore } from "@/stores/chat-store";
import { apiClient } from "@/lib/api-client";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatHeader } from "@/components/chat/chat-header";
import { Sparkles, Zap, Search, FileText, Brain, Globe, Scissors, Shield, ArrowRight } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuthStore();
  const {
    messages,
    isLoading,
    conversationId,
    currentTitle,
    isTemporaryMode,
    description,
    currentActivity,
    iterationSummaries,
    errorMessage,
    truncationWarning,
    uploadProgress,
    sendMessage,
    stopGeneration,
    loadConversations,
    clearError,
    clearTruncationWarning,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // GPU heartbeat (30s interval, matching Flutter)
  useEffect(() => {
    const sendHeartbeat = () => apiClient.sendGpuHeartbeat("active");
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      apiClient.sendGpuHeartbeat("closed");
    };
  }, []);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll during streaming (every token update) and on completion
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (isLoading) {
      // During streaming — scroll on each message update
      scrollToBottom();
    } else if (wasLoading && !isLoading) {
      // Streaming just finished — scroll to final position
      scrollToBottom();
    }
  }, [messages, isLoading, scrollToBottom]);

  // Error snackbar auto-dismiss
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(clearError, 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, clearError]);

  // Truncation warning auto-dismiss (longer duration — 15s)
  useEffect(() => {
    if (truncationWarning) {
      const timer = setTimeout(clearTruncationWarning, 15000);
      return () => clearTimeout(timer);
    }
  }, [truncationWarning, clearTruncationWarning]);

  const handleSend = async (message: string, attachments?: File[]) => {
    await sendMessage(message, { attachments });
    scrollToBottom();
  };

  const chatTitle = isTemporaryMode
    ? "Temporary Chat"
    : currentTitle || (conversationId ? "Conversation" : "New Chat");

  return (
    <>
      {/* Header */}
      <ChatHeader
        title={chatTitle}
        isTemporary={isTemporaryMode}
        description={description}
        username={user?.username || ""}
        onMenuClick={() => {
          window.dispatchEvent(new CustomEvent("toggle-sidebar"));
        }}
      />

      {/* Temporary Mode Banner */}
      {isTemporaryMode && description && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/[0.02] border-b border-white/[0.04]">
          <span className="text-white/20 text-xs">👻</span>
          <span className="text-white/30 text-xs">{description}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mx-4 mt-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 animate-in slide-in-from-top-2 duration-300">
          <span className="text-red-400 text-sm">⚠️</span>
          <p className="text-red-400 text-sm flex-1">{errorMessage}</p>
          <button
            onClick={clearError}
            className="text-red-400/60 hover:text-red-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Truncation Warning Banner (Google/OpenAI pattern: typed event, amber) */}
      {truncationWarning && (
        <div className="mx-4 mt-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-in slide-in-from-top-2 duration-300">
          <Scissors size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-sm flex-1">{truncationWarning}</p>
          <button
            onClick={clearTruncationWarning}
            className="text-amber-400/60 hover:text-amber-400 text-xs font-medium px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState username={user?.username || ""} />
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            currentActivity={currentActivity}
            iterationSummaries={iterationSummaries}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        onStop={stopGeneration}
        uploadProgress={uploadProgress}
      />
    </>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ username }: { username: string }) {
  const { sendMessage } = useChatStore();

  const suggestions = [
    {
      icon: <Brain size={16} />,
      text: "Explain quantum computing in simple terms",
    },
    {
      icon: <FileText size={16} />,
      text: "Help me write a professional email",
    },
    {
      icon: <Search size={16} />,
      text: "Search my documents for the latest report",
    },
    {
      icon: <Globe size={16} />,
      text: "What are the latest developments in AI?",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
      {/* Greeting */}
      <div className="text-center mb-10">
        <h2 className="text-[28px] font-semibold text-[var(--color-text-primary)] mb-3 tracking-tight">
          Hello, {username}
        </h2>
        <p className="text-[var(--color-text-tertiary)] text-[15px] max-w-md leading-relaxed">
          Your private AI assistant — everything is processed locally on your SphereX device.
        </p>
      </div>

      {/* Suggestion prompts — clean, text-forward */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => sendMessage(s.text)}
            className="group flex items-center gap-3 text-left px-4 py-3.5 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-elevated)] transition-all duration-200"
          >
            <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-tertiary)] transition-colors shrink-0">
              {s.icon}
            </span>
            <span className="text-[var(--color-text-tertiary)] text-[13px] group-hover:text-[var(--color-text-secondary)] transition-colors leading-snug">
              {s.text}
            </span>
          </button>
        ))}
      </div>

      {/* Privacy assurance — reinforces trust */}
      <div className="flex items-center gap-2 mt-8 text-[var(--color-text-muted)]">
        <Shield size={13} />
        <span className="text-[11px]">All data stays on your device</span>
      </div>
    </div>
  );
}
