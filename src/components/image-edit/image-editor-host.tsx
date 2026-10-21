"use client";

// ============================================================================
// Image Editor Host — renders the full-screen editor when opened from
// anywhere (useImageEditorStore.open). Mounted once per app shell.
// The editor is loaded lazily so it costs nothing until first use.
// ============================================================================

import dynamic from "next/dynamic";
import { useImageEditorStore } from "@/stores/image-editor-store";

const ImageEditor = dynamic(
  () => import("@/components/image-edit/image-editor").then((m) => m.ImageEditor),
  { ssr: false }
);

export function ImageEditorHost() {
  const isOpen = useImageEditorStore((s) => s.isOpen);
  const nonce = useImageEditorStore((s) => s.nonce);
  const source = useImageEditorStore((s) => s.source);
  const sessionId = useImageEditorStore((s) => s.sessionId);
  const initialPrompt = useImageEditorStore((s) => s.initialPrompt);
  const close = useImageEditorStore((s) => s.close);

  if (!isOpen) return null;
  return (
    <ImageEditor key={nonce} source={source} sessionId={sessionId} initialPrompt={initialPrompt} onClose={close} />
  );
}
