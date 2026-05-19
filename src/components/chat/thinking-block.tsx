"use client";

// ============================================================================
// Thinking Block — Port of ThinkingMessageBubble from thinking_widgets.dart
// Premium AI thinking process with live step timeline, shimmer animations,
// elapsed timer, and expandable reasoning view
// ============================================================================

import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Brain,
  Search,
  Wrench,
  Globe,
  FileText,
  Code,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

interface ThinkingBlockProps {
  steps: string[];
  thinkContent: string | null;
  isStreaming: boolean;
  thinkingDurationSec: number;
  currentActivity: string | null;
  iterationSummaries: string[];
  streamStartedAt: string | null;
}

export function ThinkingBlock({
  steps,
  thinkContent,
  isStreaming,
  thinkingDurationSec,
  currentActivity,
  iterationSummaries,
  streamStartedAt,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed timer
  useEffect(() => {
    if (isStreaming) {
      const startTime = streamStartedAt
        ? new Date(streamStartedAt).getTime()
        : Date.now();

      const tick = () => {
        setElapsed(Math.round((Date.now() - startTime) / 1000));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isStreaming, streamStartedAt]);

  const displayDuration = isStreaming ? elapsed : (elapsed > 0 ? elapsed : thinkingDurationSec);
  const elapsedLabel =
    displayDuration <= 0
      ? ""
      : displayDuration < 60
        ? `${displayDuration}s`
        : `${Math.floor(displayDuration / 60)}m ${displayDuration % 60}s`;

  // Header label
  const headerLabel = isStreaming
    ? currentActivity || (steps.length > 0 ? steps[steps.length - 1] : "Thinking...")
    : elapsedLabel
      ? `Thought for ${elapsedLabel}`
      : "Thought process";

  return (
    <div
      className={`rounded-[14px] border transition-colors duration-300 ${
        isStreaming
          ? "border-[var(--color-accent-cyan)]/25 thinking-active"
          : "border-white/[0.07]"
      } bg-white/[0.02] overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        {/* Brain icon with shimmer when streaming */}
        {isStreaming ? (
          <span className="shimmer-icon rounded-full p-0.5">
            <Brain size={16} className="text-white" />
          </span>
        ) : (
          <Brain size={16} className="text-white/40" />
        )}

        {/* Label */}
        <span
          className={`flex-1 text-left text-[13px] ${
            isStreaming
              ? "text-white font-semibold"
              : "text-white/50 font-medium"
          } tracking-wide truncate`}
        >
          {headerLabel}
        </span>

        {/* Elapsed time (streaming only) */}
        {isStreaming && elapsedLabel && (
          <span className="text-white/25 text-[11px] mr-1">{elapsedLabel}</span>
        )}

        {/* Expand chevron */}
        <ChevronDown
          size={16}
          className={`text-white/30 transition-transform duration-250 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Iteration Summaries (shown when collapsed & completed) */}
      {!isStreaming && !expanded && iterationSummaries.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {iterationSummaries.map((summary, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <CheckCircle size={12} className="text-green-400/60 mt-0.5 shrink-0" />
              <span className="text-[11px] text-white/35 italic">{summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Body */}
      {expanded && (
        <div className="border-t border-white/5">
          <div className="px-4 py-3 space-y-2">
            {/* Tool Steps Timeline */}
            {steps.length > 0 && (
              <div className="space-y-1.5">
                {steps.map((step, i) => (
                  <StepRow key={i} step={step} isLast={i === steps.length - 1 && isStreaming} />
                ))}
              </div>
            )}

            {/* Thinking Content (dimmed, italic markdown) */}
            {thinkContent && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="text-white/40 text-[12.5px] italic leading-relaxed">
                  <MarkdownRenderer content={thinkContent} dimmed />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step Row ────────────────────────────────────────────────────────────
function StepRow({ step, isLast }: { step: string; isLast: boolean }) {
  const icon = getStepIcon(step);
  const color = getStepColor(step);

  return (
    <div className="flex items-start gap-2.5">
      {/* Timeline dot */}
      <div className={`mt-1 shrink-0 ${isLast ? "pulse-glow" : ""}`}>
        {icon}
      </div>
      {/* Label */}
      <span className={`text-[12px] ${color} leading-relaxed`}>{step}</span>
    </div>
  );
}

function getStepIcon(step: string) {
  const s = step.toLowerCase();
  if (s.includes("error") || s.includes("fail") || s.includes("⚠"))
    return <AlertTriangle size={13} className="text-orange-400" />;
  if (s.includes("🔧") || s.includes("tool"))
    return <Wrench size={13} className="text-sky-400" />;
  if (s.includes("search") || s.includes("web"))
    return <Search size={13} className="text-green-400" />;
  if (s.includes("file") || s.includes("read") || s.includes("write"))
    return <FileText size={13} className="text-white/40" />;
  if (s.includes("browser") || s.includes("url") || s.includes("fetch"))
    return <Globe size={13} className="text-purple-400" />;
  if (s.includes("code") || s.includes("exec"))
    return <Code size={13} className="text-white/40" />;
  if (s.includes("✅"))
    return <CheckCircle size={13} className="text-green-400" />;
  return <ArrowRight size={13} className="text-white/30" />;
}

function getStepColor(step: string) {
  const s = step.toLowerCase();
  if (s.includes("error") || s.includes("fail") || s.includes("⚠"))
    return "text-orange-400/80";
  if (s.includes("🔧") || s.includes("tool"))
    return "text-sky-400/80";
  if (s.includes("search") || s.includes("web"))
    return "text-green-400/80";
  if (s.includes("browser"))
    return "text-purple-400/80";
  if (s.includes("✅"))
    return "text-green-400/70";
  return "text-white/40";
}
