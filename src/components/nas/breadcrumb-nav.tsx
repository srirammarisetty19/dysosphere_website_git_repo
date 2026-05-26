"use client";

// ============================================================================
// Breadcrumb Navigation — Google Drive style path bar with animations
// ============================================================================

import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbNavProps {
  breadcrumbs: Array<{ name: string; id: string | null }>;
  onNavigate: (index: number) => void;
}

export function BreadcrumbNav({ breadcrumbs, onNavigate }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-none">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <div
            key={`${crumb.id ?? "root"}-${index}`}
            className={`flex items-center gap-1 shrink-0 ${
              index > 0 ? "animate-breadcrumb-in" : ""
            }`}
            style={index > 0 ? { animationDelay: `${(index - 1) * 50}ms` } : undefined}
          >
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
            )}
            <button
              onClick={() => onNavigate(index)}
              disabled={isLast}
              className={`
                flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150
                ${
                  isLast
                    ? "text-text-primary font-semibold cursor-default"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                }
              `}
            >
              {index === 0 && <Home className="h-4 w-4" />}
              <span className="truncate max-w-[160px]">{crumb.name}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
