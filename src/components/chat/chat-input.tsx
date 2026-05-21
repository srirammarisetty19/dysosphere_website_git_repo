"use client";

// ============================================================================
// Chat Input — Enhanced web input with drag & drop, keyboard shortcuts,
// auto-expanding textarea, send/stop, file upload, and voice
// ============================================================================

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type DragEvent } from "react";
import {
  Send,
  Paperclip,
  Square,
  Mic,
  X,
  FileText,
  Image as ImageIcon,
  ArrowUp,
} from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({ onSend, isLoading, onStop }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Auto-focus textarea on mount and when loading finishes
  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  // Global keyboard shortcut: focus textarea with /
  useEffect(() => {
    const handleGlobalKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const handleSend = useCallback(() => {
    if ((!message.trim() && attachments.length === 0) || isLoading) return;
    onSend(message.trim(), attachments.length > 0 ? attachments : undefined);
    setMessage("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, attachments, isLoading, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Escape to stop generation
    if (e.key === "Escape" && isLoading) {
      e.preventDefault();
      onStop();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon size={12} />;
    return <FileText size={12} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
  };

  // ── Voice recording ──────────────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((t) => t.stop());

        // Try server-side STT transcription
        try {
          const { apiClient } = await import("@/lib/api-client");
          const result = await apiClient.uploadFile(file);
          if (result.extracted_text && result.extracted_text.trim()) {
            // Populate textarea with transcribed text
            setMessage((prev) =>
              prev ? `${prev} ${result.extracted_text!.trim()}` : result.extracted_text!.trim()
            );
          } else {
            // No transcription returned — add as attachment
            setAttachments((prev) => [...prev, file]);
          }
        } catch {
          // STT failed — fall back to adding as attachment
          setAttachments((prev) => [...prev, file]);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      console.warn("Microphone access denied");
    }
  };

  const hasContent = message.trim() || attachments.length > 0;

  return (
    <div
      className="border-t border-white/[0.04] bg-[var(--color-bg-primary)] px-4 py-3"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto">
        {/* Drag overlay */}
        {isDragging && (
          <div className="mb-3 flex items-center justify-center py-6 rounded-2xl border-2 border-dashed border-[var(--color-accent-cyan)]/30 bg-[var(--color-accent-cyan)]/5 transition-all">
            <div className="flex items-center gap-2 text-[var(--color-accent-cyan)]/60 text-sm">
              <Paperclip size={16} />
              <span>Drop files here to attach</span>
            </div>
          </div>
        )}

        {/* Attachment preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-2">
            {attachments.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs group/attach"
              >
                <span className="text-white/40">{getFileIcon(file)}</span>
                <span className="text-white/60 truncate max-w-[120px]">
                  {file.name}
                </span>
                <span className="text-white/20">{formatFileSize(file.size)}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="text-white/20 hover:text-white/50 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={`flex items-end gap-2 p-2 rounded-2xl border transition-all duration-200 ${
            isDragging
              ? "border-[var(--color-accent-cyan)]/30 bg-[var(--color-accent-cyan)]/5"
              : "bg-white/[0.04] border-white/[0.08] focus-within:border-white/[0.15] focus-within:bg-white/[0.05]"
          }`}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.csv,.json,.md,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Attachment button */}
          <button
            onClick={handleFileSelect}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors shrink-0 mb-0.5"
            title="Attach file (or drag & drop)"
          >
            <Paperclip size={18} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Sphere AI..."
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent text-white text-[15px] placeholder:text-white/20 resize-none focus:outline-none py-2 leading-relaxed min-h-[24px] max-h-[200px] disabled:opacity-50"
          />

          {/* Voice button */}
          <button
            onClick={toggleRecording}
            className={`p-2 rounded-lg transition-colors shrink-0 mb-0.5 ${
              isRecording
                ? "text-red-400 bg-red-400/10 animate-pulse"
                : "text-white/30 hover:text-white/60 hover:bg-white/5"
            }`}
            title={isRecording ? "Stop recording" : "Voice input"}
          >
            <Mic size={18} />
          </button>

          {/* Send / Stop button */}
          {isLoading ? (
            <button
              onClick={onStop}
              className="p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all shrink-0 mb-0.5"
              title="Stop generation (Esc)"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasContent}
              className={`p-2.5 rounded-xl transition-all shrink-0 mb-0.5 ${
                hasContent
                  ? "gradient-bg text-white hover:brightness-110 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-accent-cyan)]/10"
                  : "bg-white/[0.06] text-white/20 cursor-not-allowed"
              }`}
              title="Send message (Enter)"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Bottom hints */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-white/10 text-[11px]">
            Sphere AI processes everything locally on your SphereX device
          </p>
          <div className="hidden md:flex items-center gap-3 text-white/10 text-[10px]">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-white/5 text-white/20 text-[9px] font-mono">Enter</kbd> send
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-white/5 text-white/20 text-[9px] font-mono">Shift+Enter</kbd> newline
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-white/5 text-white/20 text-[9px] font-mono">/</kbd> focus
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
