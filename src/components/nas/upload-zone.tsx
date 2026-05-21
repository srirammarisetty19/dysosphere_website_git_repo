"use client";

// ============================================================================
// Upload Zone — Google Drive drag-and-drop + file picker
// ============================================================================

import { useState, useCallback, useRef } from "react";
import { Upload, X, Check, AlertCircle, FileIcon } from "lucide-react";
import { useNasFilesStore } from "@/stores/nas-files-store";
import { formatBytes } from "@/lib/nas-types";

interface UploadZoneProps {
  directoryId?: string | null;
  children: React.ReactNode;
}

export function UploadZone({ directoryId, children }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const { uploadFiles, uploads, removeUpload, clearFinishedUploads } =
    useNasFilesStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadFiles(files, directoryId);
      }
    },
    [uploadFiles, directoryId]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        uploadFiles(files, directoryId);
      }
      // Reset input so same file can be uploaded again
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadFiles, directoryId]
  );

  const activeUploads = uploads.filter(
    (u) => u.status === "uploading" || u.status === "pending"
  );
  const finishedUploads = uploads.filter(
    (u) => u.status === "done" || u.status === "error"
  );

  return (
    <div
      className="relative flex-1 flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        id="nas-file-upload"
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent-blue/10 border-2 border-dashed border-accent-blue rounded-xl backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-accent-blue">
            <Upload className="h-12 w-12 animate-bounce" />
            <p className="text-lg font-medium">Drop files to upload</p>
            <p className="text-sm text-accent-blue/70">
              Files will be uploaded to the current folder
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {children}

      {/* Upload progress toast (bottom-right, Google Drive style) */}
      {uploads.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <span className="text-sm font-medium text-text-primary">
              {activeUploads.length > 0
                ? `Uploading ${activeUploads.length} file${activeUploads.length > 1 ? "s" : ""}`
                : "Uploads complete"}
            </span>
            {finishedUploads.length > 0 && activeUploads.length === 0 && (
              <button
                onClick={clearFinishedUploads}
                className="text-xs text-text-tertiary hover:text-text-secondary"
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Upload list */}
          <div className="max-h-48 overflow-y-auto">
            {uploads.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle last:border-0"
              >
                <FileIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">
                    {task.file.name}
                  </p>
                  {task.status === "uploading" && (
                    <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-blue transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                  {task.status === "error" && (
                    <p className="text-[10px] text-red-400 mt-0.5">
                      {task.error}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {task.status === "done" && (
                    <Check className="h-4 w-4 text-green-400" />
                  )}
                  {task.status === "error" && (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  )}
                  {task.status === "uploading" && (
                    <span className="text-[10px] text-text-tertiary">
                      {task.progress}%
                    </span>
                  )}
                </div>
                {(task.status === "done" || task.status === "error") && (
                  <button
                    onClick={() => removeUpload(task.id)}
                    className="p-0.5 hover:bg-white/5 rounded"
                  >
                    <X className="h-3 w-3 text-text-tertiary" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
