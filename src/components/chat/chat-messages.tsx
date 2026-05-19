"use client";

// ============================================================================
// Chat Messages — Message list with thinking blocks, markdown, and attachments
// Enhanced for web: copy-to-clipboard, timestamps, hover actions, avatar
// ============================================================================

import { useState } from "react";
import type { Message } from "@/lib/types";
import { ThinkingBlock } from "@/components/chat/thinking-block";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { Copy, Check, User, Sparkles, ExternalLink, Download } from "lucide-react";

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
  return (
    <div className="px-4 md:px-6 lg:px-8 xl:px-0 xl:max-w-3xl xl:mx-auto py-6 space-y-1">
      {messages.map((msg, index) => {
        const isLast = index === messages.length - 1;
        const isStreamingAssistant = isLast && isLoading && msg.role === "assistant";

        if (msg.role === "user") {
          return <UserBubble key={index} content={msg.content} timestamp={msg.created_at} />;
        }

        if (msg.role === "assistant") {
          return (
            <AssistantBubble
              key={index}
              message={msg}
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

// ── Copy Button ─────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-lg transition-all duration-200 ${
        copied
          ? "text-green-400 bg-green-400/10"
          : "text-white/0 group-hover:text-white/30 hover:!text-white/60 hover:bg-white/5"
      }`}
      title={copied ? "Copied!" : "Copy message"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// ── User Bubble ─────────────────────────────────────────────────────────
function UserBubble({ content, timestamp }: { content: string; timestamp?: string }) {
  return (
    <div className="group flex gap-3 py-5 justify-end">
      {/* Hover actions */}
      <div className="flex items-start pt-1 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <CopyButton text={content} />
      </div>

      {/* Bubble */}
      <div className="max-w-[80%] lg:max-w-[70%]">
        <div className="px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-br from-white/[0.08] to-white/[0.04] border border-white/[0.08]">
          <p className="text-white text-[15px] leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
        {/* Timestamp */}
        {timestamp && (
          <p className="text-right text-white/0 group-hover:text-white/20 text-[10px] mt-1 mr-2 transition-colors">
            {formatTimestamp(timestamp)}
          </p>
        )}
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
  isStreaming,
  currentActivity,
  iterationSummaries,
}: {
  message: Message;
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

        {/* Inline Images */}
        {image_urls && image_urls.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {image_urls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/img relative block rounded-xl overflow-hidden border border-white/[0.08] hover:border-white/20 transition-all shadow-lg hover:shadow-xl hover:shadow-black/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Generated image ${i + 1}`}
                  className="max-w-[320px] max-h-[240px] object-cover"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-end p-2">
                  <span className="flex items-center gap-1 text-[10px] text-white/80 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <ExternalLink size={10} /> Open
                  </span>
                </div>
              </a>
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

        {/* Hover actions row */}
        {finalResponse && !isStreaming && (
          <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={finalResponse} />
            {/* Timestamp */}
            {message.created_at && (
              <span className="text-white/20 text-[10px] ml-1">
                {formatTimestamp(message.created_at)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
