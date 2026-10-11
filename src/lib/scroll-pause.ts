// Tiny module-level flag so interactive cards (e.g. the live browser view)
// can pause chat auto-scroll while the pointer is over them. Ref-counted so
// nested/overlapping hover regions behave correctly. Not React state on
// purpose — toggling it must never trigger a re-render.

import { useEffect, useMemo, useRef } from "react";

let holds = 0;

export function pauseAutoScroll(): void {
  holds += 1;
}

export function resumeAutoScroll(): void {
  holds = Math.max(0, holds - 1);
}

export function isAutoScrollPaused(): boolean {
  return holds > 0;
}

/**
 * Hover handlers that pause auto-scroll while the pointer is inside the
 * element. Releases the hold on unmount so a card that disappears while
 * hovered can't leave auto-scroll stuck.
 */
export function useAutoScrollPause() {
  const held = useRef(false);
  useEffect(
    () => () => {
      if (held.current) {
        held.current = false;
        resumeAutoScroll();
      }
    },
    [],
  );
  return useMemo(
    () => ({
      onPointerEnter: () => {
        if (!held.current) {
          held.current = true;
          pauseAutoScroll();
        }
      },
      onPointerLeave: () => {
        if (held.current) {
          held.current = false;
          resumeAutoScroll();
        }
      },
    }),
    [],
  );
}
