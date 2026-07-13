"use client";

// ============================================================================
// Typing Indicator — Port of TypingIndicator from thinking_widgets.dart
// Shimmer spark icon + bouncing dots
// ============================================================================

import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.08]">
        {/* Shimmer spark */}
        <span className="shimmer-icon rounded-sm">
          <Sparkles size={14} className="text-white" />
        </span>

        {/* Bouncing dots */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`w-[5px] h-[5px] rounded-full bg-[var(--color-accent-blue)] opacity-60 bounce-dot bounce-dot-${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
