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
import { Sparkles, Zap, Search, FileText, Brain, Globe } from "lucide-react";

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
    sendMessage,
    stopGeneration,
    loadConversations,
    clearError,
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
      />
    </>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ username }: { username: string }) {
  const { sendMessage } = useChatStore();

  const suggestions = [
    {
      icon: <Brain size={18} />,
      title: "Reason & Analyze",
      text: "Explain quantum computing in simple terms",
      gradient: "from-purple-500/10 to-purple-500/5",
      iconColor: "text-purple-400",
    },
    {
      icon: <FileText size={18} />,
      title: "Write & Create",
      text: "Help me write a professional email",
      gradient: "from-sky-500/10 to-sky-500/5",
      iconColor: "text-sky-400",
    },
    {
      icon: <Search size={18} />,
      title: "Search & Find",
      text: "Search my documents for the latest report",
      gradient: "from-green-500/10 to-green-500/5",
      iconColor: "text-green-400",
    },
    {
      icon: <Globe size={18} />,
      title: "Browse & Research",
      text: "What are the latest developments in AI?",
      gradient: "from-amber-500/10 to-amber-500/5",
      iconColor: "text-amber-400",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 pb-20">
      {/* Animated logo */}
      <div className="relative mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-bg p-[1.5px] shadow-lg shadow-[var(--color-accent-cyan)]/10">
          <div className="w-full h-full rounded-[14px] bg-[var(--color-bg-primary)] flex items-center justify-center">
            <Sparkles size={28} className="text-[var(--color-accent-cyan)]" />
          </div>
        </div>
        {/* Subtle glow */}
        <div className="absolute inset-0 w-16 h-16 rounded-2xl gradient-bg opacity-20 blur-xl" />
      </div>

      {/* Greeting */}
      <div className="text-center mb-10">
        <h2 className="text-2xl font-semibold text-white/80 mb-2">
          Hello, {username}
        </h2>
        <p className="text-white/30 text-sm max-w-md">
          I can help you think, create, search, and browse — all processed
          privately on your SphereX device.
        </p>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => sendMessage(s.text)}
            className={`text-left p-4 rounded-2xl bg-gradient-to-br ${s.gradient} border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 group hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`${s.iconColor} opacity-60 group-hover:opacity-100 transition-opacity`}>
                {s.icon}
              </div>
              <span className="text-white/50 text-[13px] font-semibold group-hover:text-white/70 transition-colors">
                {s.title}
              </span>
            </div>
            <span className="text-white/35 text-sm group-hover:text-white/55 transition-colors leading-relaxed">
              {s.text}
            </span>
          </button>
        ))}
      </div>

      {/* Capability chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
        {["Agentic AI", "Tool Use", "Web Search", "File Analysis", "Voice Input"].map((cap) => (
          <span
            key={cap}
            className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/20 text-[11px] font-medium"
          >
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}
