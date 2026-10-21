// ============================================================================
// Sphere AI — Image Editor Store (Zustand)
// Opens the full-screen AI image editor from anywhere (chat, NAS viewer,
// job cards). The editor itself is rendered once by <ImageEditorHost/>.
// ============================================================================

import { create } from "zustand";

export type ImageEditorSource =
  /** Local bytes: new upload, pasted image, NAS download, chat image */
  | { kind: "blob"; blob: Blob; name?: string }
  /** A previous edit result — continues via parent_job_id (no re-upload) */
  | { kind: "job"; jobId: string }
  /** Server path fetched with auth (e.g. /files/u/123.png) */
  | { kind: "url"; url: string; name?: string };

interface ImageEditorState {
  isOpen: boolean;
  /** Increments on every open() — used as a React key for a fresh editor */
  nonce: number;
  source: ImageEditorSource | null;
  /** Chat session the results belong to (for history/listing) */
  sessionId: string | null;
  initialPrompt: string;
  open: (opts?: { source?: ImageEditorSource | null; sessionId?: string | null; prompt?: string }) => void;
  close: () => void;
}

export const useImageEditorStore = create<ImageEditorState>()((set, get) => ({
  isOpen: false,
  nonce: 0,
  source: null,
  sessionId: null,
  initialPrompt: "",
  open: (opts) =>
    set({
      isOpen: true,
      nonce: get().nonce + 1,
      source: opts?.source ?? null,
      sessionId: opts?.sessionId ?? null,
      initialPrompt: opts?.prompt ?? "",
    }),
  close: () => set({ isOpen: false, source: null, initialPrompt: "" }),
}));
