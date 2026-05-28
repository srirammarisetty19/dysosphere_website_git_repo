"use client";

// ============================================================================
// File AI Chat Panel — In-place AI chat for NAS files
// Industry pattern: Google Photos Ask + Samsung Galaxy AI
//
// Features:
// - Slide-over panel (desktop) with file context header
// - Context-aware quick action chips based on file type
// - SSE streaming with abort support
// - Markdown rendering via react-markdown
// - Conversational multi-turn with session persistence
// ============================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import type { FileItem } from "@/lib/nas-types";
import { useAuthStore } from "@/stores/auth-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileThumbnail } from "./file-thumbnail";
import {
  X,
  Sparkles,
  Send,
  Square,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Loader2,
  Lightbulb,
  ListChecks,
  Table,
  Mic,
  MapPin,
  Search as SearchIcon,
  ScanText,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

interface FileAIChatPanelProps {
  file: FileItem;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getFileType(mimeType: string | null): string {
  if (!mimeType) return "document";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function getFileTypeIcon(fileType: string) {
  switch (fileType) {
    case "image":
      return <ImageIcon className="h-4 w-4" />;
    case "video":
      return <Film className="h-4 w-4" />;
    case "audio":
      return <Music className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getQuickActions(fileType: string): QuickAction[] {
  switch (fileType) {
    case "image":
      return [
        { label: "Describe", icon: <ScanText className="h-3.5 w-3.5" />, prompt: "Describe this image in detail." },
        { label: "Extract Text", icon: <FileText className="h-3.5 w-3.5" />, prompt: "Extract and read any text visible in this image (OCR)." },
        { label: "Identify", icon: <SearchIcon className="h-3.5 w-3.5" />, prompt: "Identify all objects, people, and notable elements in this image." },
        { label: "Location", icon: <MapPin className="h-3.5 w-3.5" />, prompt: "Where was this photo taken? Describe the location and any landmarks." },
      ];
    case "video":
      return [
        { label: "Summarize", icon: <ListChecks className="h-3.5 w-3.5" />, prompt: "Summarize the content of this video." },
        { label: "Transcribe", icon: <Mic className="h-3.5 w-3.5" />, prompt: "Transcribe the spoken content in this video." },
        { label: "Key Points", icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: "List the key points and highlights from this video." },
      ];
    case "audio":
      return [
        { label: "Transcribe", icon: <Mic className="h-3.5 w-3.5" />, prompt: "Transcribe this audio recording." },
        { label: "Summarize", icon: <ListChecks className="h-3.5 w-3.5" />, prompt: "Summarize what is discussed in this audio." },
        { label: "Key Points", icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: "Extract key points and action items from this audio." },
      ];
    default:
      return [
        { label: "Summarize", icon: <ListChecks className="h-3.5 w-3.5" />, prompt: "Summarize this document concisely." },
        { label: "Key Points", icon: <Lightbulb className="h-3.5 w-3.5" />, prompt: "List the key points and main ideas from this document." },
        { label: "Extract Data", icon: <Table className="h-3.5 w-3.5" />, prompt: "Extract any tables, numbers, or structured data from this document." },
        { label: "Explain", icon: <ScanText className="h-3.5 w-3.5" />, prompt: "Explain this document in simple terms." },
      ];
  }
}

/** Strip XML reasoning tags */
function cleanContent(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<response>/gi, "")
    .replace(/<\/response>/gi, "")
    .trim();
}

// ── Component ────────────────────────────────────────────────────────────

export function FileAIChatPanel({ file, onClose }: FileAIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentActivity, setCurrentActivity] = useState("");
  const [showChips, setShowChips] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileType = getFileType(file.mime_type);
  const quickActions = getQuickActions(fileType);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);
      setShowChips(false);
      setStreamingContent("");
      setCurrentActivity("💭 Thinking...");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // Get auth context
        const { activeAccount } = useAuthStore.getState();
        if (!activeAccount) throw new Error("Not authenticated");

        const serverUrl = activeAccount.serverUrl;
        const token = activeAccount.token;
        const url = `${serverUrl}/api/ai/agents/stream`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text.trim(),
            session_id: sessionId || undefined,
            nas_file_context: {
              file_id: file.id,
              file_type: fileType,
              filename: file.name,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        if (!response.body) throw new Error("No response body");

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") break;

              try {
                const event = JSON.parse(data);

                switch (event.type) {
                  case "token":
                  case "thinking":
                    accumulated += event.content || "";
                    setStreamingContent(cleanContent(accumulated));
                    break;
                  case "session":
                  case "session_id":
                    if (event.session_id || event.content) {
                      setSessionId(event.session_id || event.content);
                    }
                    break;
                  case "activity":
                    setCurrentActivity(event.content || "💭 Thinking...");
                    break;
                  case "error":
                    if (event.error !== "[Generation Stopped]" && event.content !== "[Generation Stopped]") {
                      setMessages((prev) => [
                        ...prev,
                        {
                          role: "assistant",
                          content: `⚠️ ${event.error || event.content || "An error occurred"}`,
                          timestamp: new Date(),
                        },
                      ]);
                      setIsLoading(false);
                      setCurrentActivity("");
                    }
                    return;
                  case "done":
                    break;
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Finalize
        const finalContent = cleanContent(accumulated);
        if (finalContent) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: finalContent,
              timestamp: new Date(),
            },
          ]);
        }
        setStreamingContent("");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ ${(err as Error).message || "Connection failed"}`,
              timestamp: new Date(),
            },
          ]);
        }
      } finally {
        setIsLoading(false);
        setCurrentActivity("");
        abortControllerRef.current = null;
      }
    },
    [isLoading, sessionId, file.id, file.name, fileType]
  );

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    if (streamingContent) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: streamingContent, timestamp: new Date() },
      ]);
    }
    setStreamingContent("");
    setIsLoading(false);
    setCurrentActivity("");
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-bg-secondary border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          {/* File thumbnail */}
          <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 bg-white/5">
            {fileType === "image" ? (
              <FileThumbnail
                fileId={file.id}
                mimeType={file.mime_type}
                name={file.name}
                size="sm"
                className="rounded-xl"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-text-tertiary">
                {getFileTypeIcon(fileType)}
              </div>
            )}
          </div>

          {/* File name + AI label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {file.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="h-3 w-3 text-accent-blue" />
              <span className="text-[11px] text-accent-blue font-medium">
                Ask AI
              </span>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-tertiary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Chat Area ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && showChips ? (
            /* Quick action chips */
            <div className="space-y-5 pt-2">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  What would you like to know?
                </h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Tap a suggestion or type your own question
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-accent-blue/20 bg-accent-blue/5 text-sm text-text-secondary hover:bg-accent-blue/10 hover:text-text-primary hover:border-accent-blue/30 transition-all"
                  >
                    {action.icon}
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat messages */
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  style={{ animation: "message-in 0.2s ease-out" }}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-accent-blue text-white rounded-br-md"
                        : "bg-white/[0.04] border border-border-subtle text-text-secondary rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="gemini-prose prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming content */}
              {streamingContent && (
                <div className="flex justify-start" style={{ animation: "message-in 0.2s ease-out" }}>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm bg-white/[0.04] border border-border-subtle text-text-secondary">
                    <div className="gemini-prose prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingContent && (
                <div className="flex justify-start" style={{ animation: "message-in 0.2s ease-out" }}>
                  <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white/[0.04] border border-border-subtle flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-accent-blue bounce-dot bounce-dot-1" />
                      <div className="h-2 w-2 rounded-full bg-accent-blue bounce-dot bounce-dot-2" />
                      <div className="h-2 w-2 rounded-full bg-accent-blue bounce-dot bounce-dot-3" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ── Activity Indicator ──────────────────────────────────────── */}
        {currentActivity && (
          <div className="px-4 py-1.5">
            <p className="text-xs text-accent-blue italic truncate">
              {currentActivity}
            </p>
          </div>
        )}

        {/* ── Input Bar ──────────────────────────────────────────────── */}
        <div className="px-3 py-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  sendMessage(inputValue);
                }
              }}
              placeholder="Ask about this file..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-border-subtle text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/40 transition-colors"
              disabled={isLoading}
            />
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                title="Stop"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="p-2.5 rounded-xl bg-accent-blue text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent-blue/90 transition-colors"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
