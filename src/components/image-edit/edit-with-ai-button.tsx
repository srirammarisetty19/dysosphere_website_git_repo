"use client";

// ============================================================================
// "Edit with AI" overlay button for chat images (shown on hover).
// Hidden unless the server has AI image editing enabled.
// ============================================================================

import { Wand2 } from "lucide-react";
import { useImageEditEnabled } from "@/stores/gpu-store";
import { useImageEditorStore } from "@/stores/image-editor-store";
import { useChatStore } from "@/stores/chat-store";

export function EditWithAiButton({ url, name }: { url: string; name?: string }) {
  const enabled = useImageEditEnabled();
  const open = useImageEditorStore((s) => s.open);
  const sessionId = useChatStore((s) => s.conversationId);
  if (!enabled || !url) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open({ source: { kind: "url", url, name }, sessionId });
      }}
      className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-medium text-white img-edit-gradient shadow-md shadow-black/40 opacity-0 group-hover/img:opacity-100 focus-visible:opacity-100 transition-opacity"
      title="Edit this image with AI"
    >
      <Wand2 size={11} /> Edit
    </button>
  );
}
