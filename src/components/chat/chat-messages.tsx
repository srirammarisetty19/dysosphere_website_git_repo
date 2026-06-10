"use client";

// ============================================================================
// Chat Messages — Message list with thinking blocks, markdown, and attachments
// Enhanced for web: copy-to-clipboard, timestamps, hover actions, avatar
// Industry-standard action bar: Copy, Retry, Read Aloud, Share, Thumbs Up/Down
// ============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import type { Message, MessagePart } from "@/lib/types";
import { ThinkingBlock } from "@/components/chat/thinking-block";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { AuthImage } from "@/components/ui/auth-image";
import {
  Copy,
  Check,
  User,
  Sparkles,
  ExternalLink,
  Download,
  ImageIcon,
  RefreshCw,
  Volume2,
  VolumeX,
  Share2,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  FileText as FileTextIcon,
  FileCode,
  FileSpreadsheet,
  FileAudio,
  FileVideo,
  File as FileIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useChatStore } from "@/stores/chat-store";

// ── Classify current session (NAS InPlace AI detection) ─────────────────
function useNasContext(): { isNasInplace: boolean; filename: string | null } {
  const { conversations, conversationId } = useChatStore();
  if (!conversationId) return { isNasInplace: false, filename: null };
  const convo = conversations.find((c) => c.id === conversationId);
  if (!convo) return { isNasInplace: false, filename: null };
  // Structured metadata (preferred)
  if (convo.metadata?.context_type === "nas_inplace") {
    return { isNasInplace: true, filename: convo.metadata?.source_file?.filename ?? null };
  }
  // Emoji prefix fallback (backward compat with existing sessions)
  if (convo.title?.startsWith("📎")) {
    return { isNasInplace: true, filename: convo.title.slice(2).trim() || null };
  }
  return { isNasInplace: false, filename: null };
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  currentActivity: string | null;
  iterationSummaries: string[];
}

export function ChatMessages({
  messages,
  isLoading,
  currentActivity,
  iterationSummaries,
}: ChatMessagesProps) {
  const { isNasInplace, filename: nasFilename } = useNasContext();
  // File reference chip shown only on the FIRST user message (industry standard)
  const firstUserMsgIndex = messages.findIndex((m) => m.role === "user");

  return (
    <div className="px-4 md:px-6 lg:px-8 xl:px-0 xl:max-w-3xl xl:mx-auto py-6 space-y-1">
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;
        const isStreamingAssistant = isLast && isLoading && msg.role === "assistant";

        if (msg.role === "user") {
          return (
            <UserBubble
              key={index}
              content={msg.content}
              imageUrls={msg.image_urls}
              parts={msg.parts}
              timestamp={msg.created_at}
              messageIndex={index}
              nasFilename={isNasInplace && index === firstUserMsgIndex ? nasFilename : null}
            />
          );
        }

        if (msg.role === "assistant") {
          return (
            <AssistantBubble
              key={index}
              message={msg}
              messageIndex={index}
              isStreaming={isStreamingAssistant}
              currentActivity={isStreamingAssistant ? currentActivity : null}
              iterationSummaries={isStreamingAssistant ? iterationSummaries : msg.steps.length > 0 ? [] : []}
            />
          );
        }

        return null;
      })}

      {/* Typing indicator when waiting for first token */}
      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant" &&
        !messages[messages.length - 1].content && (
          <TypingIndicator />
        )}
    </div>
  );
}

// ── Timestamp Formatter ─────────────────────────────────────────────────
function formatTimestamp(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── Copy to clipboard (with fallback for non-HTTPS contexts) ────────────
function copyToClipboard(text: string): boolean {
  // Try modern Clipboard API first (requires secure context)
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  // Fallback: hidden textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ── Feedback persistence (localStorage) ─────────────────────────────────
function getFeedback(messageIndex: number, conversationId: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `feedback:${conversationId ?? "temp"}:${messageIndex}`;
    return localStorage.getItem(key);
  } catch { return null; }
}

function setFeedback(messageIndex: number, conversationId: string | null, rating: string): string | null {
  if (typeof window === "undefined") return null;
  const key = `feedback:${conversationId ?? "temp"}:${messageIndex}`;
  const current = localStorage.getItem(key);
  if (current === rating) {
    localStorage.removeItem(key);
    return null;
  }
  localStorage.setItem(key, rating);
  return rating;
}

// ── Copy Button ─────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const ok = copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        copied
          ? "text-green-400 bg-green-400/10"
          : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
      title={copied ? "Copied!" : "Copy message"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ── Retry Button ────────────────────────────────────────────────────────
function RetryButton({ messageIndex }: { messageIndex: number }) {
  const retryMessage = useChatStore((s) => s.retryMessage);
  const isLoading = useChatStore((s) => s.isLoading);

  return (
    <button
      onClick={() => retryMessage(messageIndex)}
      disabled={isLoading}
      className="p-1.5 rounded-lg transition-all duration-200 text-white/30 hover:text-white/60 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
      title="Retry"
    >
      <RefreshCw size={14} />
    </button>
  );
}

// ── Read Aloud Button ───────────────────────────────────────────────────
function ReadAloudButton({ text }: { text: string }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Stop any existing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [text, isSpeaking]);

  // Don't render if Speech API not available
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  return (
    <button
      onClick={handleToggle}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        isSpeaking
          ? "text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10"
          : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
      title={isSpeaking ? "Stop reading" : "Read aloud"}
    >
      {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
    </button>
  );
}

// ── Share Button ────────────────────────────────────────────────────────
function ShareButton({ text }: { text: string }) {
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    // Try native share API first (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // User cancelled or not supported — fall through to copy
      }
    }
    // Fallback: copy to clipboard
    const ok = copyToClipboard(text);
    if (ok) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        shared
          ? "text-green-400 bg-green-400/10"
          : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
      title="Share"
    >
      {shared ? <Check size={14} /> : <Share2 size={14} />}
    </button>
  );
}

// ── Thumbs Feedback Button ──────────────────────────────────────────────
function ThumbsButton({
  messageIndex,
  direction,
}: {
  messageIndex: number;
  direction: "up" | "down";
}) {
  const conversationId = useChatStore((s) => s.conversationId);
  const [rating, setRating] = useState<string | null>(() =>
    getFeedback(messageIndex, conversationId)
  );

  const isActive = rating === direction;
  const Icon = direction === "up" ? ThumbsUp : ThumbsDown;

  const handleClick = () => {
    const newRating = setFeedback(messageIndex, conversationId, direction);
    setRating(newRating);
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        isActive
          ? "text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/10"
          : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
      title={direction === "up" ? "Good response" : "Bad response"}
    >
      <Icon size={14} fill={isActive ? "currentColor" : "none"} />
    </button>
  );
}

// ── File Part Chip (for non-image attachments) ──────────────────────────
// Industry pattern (ChatGPT/Gemini): compact chip with type-specific icon
function FilePartChip({ part }: { part: MessagePart }) {
  const filename = part.filename || "File";
  const parts_ = filename.split(".");
  const ext = parts_.length > 1 ? parts_[parts_.length - 1] : "";
  const extLower = ext.toLowerCase();

  // Map file type to icon and color
  let Icon = FileIcon;
  let color = "text-white/40";
  let bgColor = "bg-white/[0.06]";
  let borderColor = "border-white/[0.08]";
  let label = extLower.toUpperCase() || "FILE";

  if (extLower === "pdf") {
    Icon = FileTextIcon; color = "text-red-400"; bgColor = "bg-red-500/10"; borderColor = "border-red-500/20"; label = "PDF";
  } else if (["doc", "docx"].includes(extLower)) {
    Icon = FileTextIcon; color = "text-blue-400"; bgColor = "bg-blue-500/10"; borderColor = "border-blue-500/20"; label = "DOC";
  } else if (["xlsx", "xls", "csv"].includes(extLower)) {
    Icon = FileSpreadsheet; color = "text-green-400"; bgColor = "bg-green-500/10"; borderColor = "border-green-500/20"; label = extLower.toUpperCase();
  } else if (["py", "js", "ts", "dart", "java", "c", "cpp", "h", "rs", "go", "rb", "swift", "kt"].includes(extLower)) {
    Icon = FileCode; color = "text-cyan-400"; bgColor = "bg-cyan-500/10"; borderColor = "border-cyan-500/20"; label = extLower.toUpperCase();
  } else if (["txt", "md", "json", "xml", "yaml", "yml", "html"].includes(extLower)) {
    Icon = FileTextIcon; color = "text-gray-400"; bgColor = "bg-gray-500/10"; borderColor = "border-gray-500/20"; label = extLower.toUpperCase();
  } else if (["wav", "mp3", "m4a", "ogg", "flac"].includes(extLower) || part.type === "audio") {
    Icon = FileAudio; color = "text-green-400"; bgColor = "bg-green-500/10"; borderColor = "border-green-500/20"; label = "AUDIO";
  } else if (["mp4", "mov", "avi", "mkv"].includes(extLower) || part.type === "video") {
    Icon = FileVideo; color = "text-purple-400"; bgColor = "bg-purple-500/10"; borderColor = "border-purple-500/20"; label = "VIDEO";
  } else if (part.type === "document") {
    Icon = FileTextIcon; color = "text-orange-400"; bgColor = "bg-orange-500/10"; borderColor = "border-orange-500/20"; label = "DOCUMENT";
  }

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${bgColor} border ${borderColor} max-w-[240px]`}>
      <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={color} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white text-xs font-medium truncate">{filename}</p>
        <p className={`text-[10px] font-semibold ${color} opacity-70`}>{label}</p>
      </div>
    </div>
  );
}

// ── User Bubble ─────────────────────────────────────────────────────────
function UserBubble({
  content,
  imageUrls,
  parts,
  timestamp,
  messageIndex,
  nasFilename,
}: {
  content: string;
  imageUrls?: string[];
  parts?: MessagePart[];
  timestamp?: string;
  messageIndex: number;
  nasFilename?: string | null;
}) {
  const hasParts = parts && parts.length > 0;
  const imageParts = hasParts ? parts.filter((p) => p.type === 'image' && p.file_url) : [];
  const hasPartsImages = imageParts.length > 0;
  const hasLegacyImages = !hasPartsImages && imageUrls && imageUrls.length > 0;

  // Use text from parts (clean, no markers) or fall back to content
  let displayContent = hasParts
    ? parts.filter((p) => p.type === 'text').map((p) => p.content || '').join('\n').trim()
    : content;

  // Legacy cleanup: strip markers for old messages that don't have parts
  if (!hasParts && hasLegacyImages) {
    displayContent = displayContent
      .replace(/\[📎 Uploaded image: [^\]]*\]\n*/g, '')
      .replace(/\[📎 [^\]]*\]\s*/g, '')
      .replace(/\[UPLOADED FILE: [^\]]*\]\n*--- File Content ---\n[\s\S]*?--- End File Content ---\n*/g, '')
      .replace(/\[UPLOADED IMAGE: [^\]]*\]\n*Use the analyze_image tool[^\n]*\n*/g, '')
      .trim();
    if (displayContent === 'Analyze this file' || displayContent === 'Please analyze this image.' || displayContent === 'Analyze this file.') {
      displayContent = '';
    }
  }

  return (
    <div className="group flex gap-3 py-5 justify-end">
      {/* Bubble */}
      <div className="max-w-[80%] lg:max-w-[70%]">
        {/* ── NAS InPlace AI File Reference Chip (first user message only) ── */}
        {/* Industry pattern: Google Photos Ask / Samsung Galaxy AI surface   */}
        {/* the file context on the question side for grounding clarity.      */}
        {nasFilename && (
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent-blue)]/10 border border-[var(--color-accent-blue)]/20">
              <Paperclip size={10} className="text-[var(--color-accent-blue)]/60 shrink-0" />
              <span className="text-[11px] text-[var(--color-accent-blue)]/70 font-medium truncate max-w-[220px]">
                {nasFilename}
              </span>
            </div>
          </div>
        )}
        {/* Multimodal parts images (AuthImage for authenticated fetch) */}
        {hasPartsImages && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end">
            {imageParts.map((part, i) => (
              <div
                key={i}
                className="group/img relative block rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/20 transition-all"
              >
                <AuthImage
                  src={part.file_url!}
                  alt={part.filename || `Uploaded image ${i + 1}`}
                  className="max-w-[200px] max-h-[200px] object-cover rounded-xl"
                  clickToOpen
                />
              </div>
            ))}
          </div>
        )}
        {/* Legacy images (AuthImage for authenticated fetch) */}
        {hasLegacyImages && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end">
            {imageUrls!.map((url, i) => (
              <div
                key={i}
                className="group/img relative block rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/20 transition-all"
              >
                <AuthImage
                  src={url}
                  alt={`Uploaded image ${i + 1}`}
                  className="max-w-[200px] max-h-[200px] object-cover rounded-xl"
                  clickToOpen
                />
              </div>
            ))}
          </div>
        )}
        {/* Non-image file parts (documents, code, audio, etc.) */}
        {/* Industry pattern (ChatGPT/Gemini): icon chip with filename */}
        {hasParts && (() => {
          const fileParts = parts!.filter((p) => p.type !== 'text' && p.type !== 'image');
          if (fileParts.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-2 mb-2 justify-end">
              {fileParts.map((part, i) => (
                <FilePartChip key={i} part={part} />
              ))}
            </div>
          );
        })()}
        {displayContent && (
          <div className="px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/[0.08]">
            <p className="text-white text-[15px] leading-relaxed whitespace-pre-wrap">
              {displayContent}
            </p>
          </div>
        )}
        {/* ── User Actions: Copy + Retry (below message, right-aligned) ── */}
        <div className="flex items-center gap-0.5 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={displayContent || content} />
          <RetryButton messageIndex={messageIndex} />
          {/* Timestamp */}
          {timestamp && (
            <span className="text-white/20 text-[10px] ml-2">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-1">
        <User size={14} className="text-white/40" />
      </div>
    </div>
  );
}

// ── Assistant Bubble ────────────────────────────────────────────────────
function AssistantBubble({
  message,
  messageIndex,
  isStreaming,
  currentActivity,
  iterationSummaries,
}: {
  message: Message;
  messageIndex: number;
  isStreaming: boolean;
  currentActivity: string | null;
  iterationSummaries: string[];
}) {
  const { content, steps, thinking_duration_sec, image_urls, nas_files } = message;

  // Parse <think> blocks
  const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/i;
  const thinkMatch = content.match(thinkRegex);
  const thinkDone = /<\/think>/i.test(content);

  let thinkContent: string | null = null;
  let finalResponse = content;

  if (thinkMatch) {
    thinkContent = thinkMatch[1]?.trim() || null;
    const before = content.substring(0, thinkMatch.index || 0);
    const after = thinkDone ? content.substring((thinkMatch.index || 0) + thinkMatch[0].length) : "";
    finalResponse = (before + after).trim();
  }

  // Safety: strip any residual <think>/<tool_call> tags that might leak through
  finalResponse = finalResponse.replace(/<\/?think>/gi, "").replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/gi, "").trim();

  // Also clean "## FINAL ANSWER:" prefixes from the server's formatting
  finalResponse = finalResponse.replace(/^##\s*FINAL\s*ANSWER:?\s*/i, "").trim();

  const hasThinkingOrSteps =
    (thinkContent && thinkContent.length > 0) || steps.length > 0;

  return (
    <div className="group flex gap-3 py-5">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full gradient-bg p-[1px] shrink-0 mt-1">
        <div className="w-full h-full rounded-full bg-[var(--color-bg-primary)] flex items-center justify-center">
          <Sparkles size={13} className="text-[var(--color-accent-cyan)]" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Thinking Block */}
        {hasThinkingOrSteps && (
          <ThinkingBlock
            steps={steps}
            thinkContent={thinkContent}
            isStreaming={isStreaming}
            thinkingDurationSec={thinking_duration_sec}
            currentActivity={currentActivity}
            iterationSummaries={iterationSummaries}
            streamStartedAt={message.stream_started_at || null}
          />
        )}

        {/* Final Response */}
        {finalResponse && (
          <div className="px-0.5">
            <MarkdownRenderer content={finalResponse} />
          </div>
        )}

        {/* Inline Images (AuthImage for authenticated fetch) */}
        {image_urls && image_urls.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {image_urls.map((url, i) => (
              <div
                key={i}
                className="group/img relative block rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/20 transition-all shadow-lg hover:shadow-xl hover:shadow-black/20"
              >
                <AuthImage
                  src={url}
                  alt={`Generated image ${i + 1}`}
                  className="max-w-[320px] max-h-[240px] object-cover"
                  clickToOpen
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-end p-2 pointer-events-none">
                  <span className="flex items-center gap-1 text-[10px] text-white/80 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <ExternalLink size={10} /> Open
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NAS File Results */}
        {nas_files && nas_files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {nas_files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all cursor-default"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-400/10 flex items-center justify-center shrink-0">
                  <Download size={14} className="text-sky-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white/70 text-[13px] font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-white/20 text-[10px]">{file.type || "File"}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Action Row: Copy | Retry | Read Aloud | Share | Feedback ───── */}
        {/* Industry standard (ChatGPT/Gemini): retry on assistant bubble   */}
        {finalResponse && !isStreaming && (
          <div className="flex items-center gap-0.5 mt-1">
            <CopyButton text={finalResponse} />
            <RetryButton messageIndex={messageIndex} />
            <ReadAloudButton text={finalResponse} />
            <ShareButton text={finalResponse} />
            <ThumbsButton messageIndex={messageIndex} direction="up" />
            <ThumbsButton messageIndex={messageIndex} direction="down" />

            {/* Timestamp */}
            {message.created_at && (
              <span className="text-white/20 text-[10px] ml-2">
                {formatTimestamp(message.created_at)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
