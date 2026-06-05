"use client";

// ============================================================================
// Breadcrumb Navigation — Google Drive style path bar with animations
// Uses AnimatePresence for smooth entry/exit of breadcrumb segments.
// Industry pattern: Google Drive, Notion, Figma breadcrumbs.
// ============================================================================

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbNavProps {
  breadcrumbs: Array<{ name: string; id: string | null }>;
  onNavigate: (index: number) => void;
}

export function BreadcrumbNav({ breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none">
      {/* Root segment — always visible, never animates */}
      <button
        onClick={() => onNavigate(0)}
        disabled={breadcrumbs.length === 1}
        className={`
          flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150 shrink-0
          ${
            breadcrumbs.length === 1
              ? "text-text-primary font-semibold cursor-default"
              : "text-text-secondary hover:text-text-primary hover:bg-white/5"
          }
        `}
      >
        <Home className="h-4 w-4" />
        <span className="truncate max-w-[160px]">{breadcrumbs[0].name}</span>
      </button>

      {/* Animated path segments — slide in on enter, slide out on exit */}
      <AnimatePresence initial={false}>
        {breadcrumbs.slice(1).map((crumb, i) => {
          const index = i + 1;
          const isLast = index === breadcrumbs.length - 1;

          return (
            <motion.div
              key={crumb.id ?? `crumb-${index}`}
              className="flex items-center gap-1 shrink-0"
              initial={{ opacity: 0, x: 12, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: -8, width: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              style={{ overflow: "hidden" }}
            >
              <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
              <button
                onClick={() => onNavigate(index)}
                disabled={isLast}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150 whitespace-nowrap
                  ${
                    isLast
                      ? "text-text-primary font-semibold cursor-default"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                  }
                `}
              >
                <span className="truncate max-w-[160px]">{crumb.name}</span>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </nav>
  );
}
