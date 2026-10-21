"use client";

// ============================================================================
// Image Job Card — in-chat card for an AI image edit
//   queued (position) → running (stage, progress, ETA) → before/after slider
//   Actions: Edit · Regenerate (versions ‹n/m›) · Download · Share · Save to NAS
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  HardDriveUpload,
  Loader2,
  Pencil,
  RefreshCw,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { IMAGE_JOB_TERMINAL, type ImageJob } from "@/lib/types";
import { OPERATION_LABELS, formatEta, useImageJobStore } from "@/stores/image-job-store";
import { useImageEditorStore } from "@/stores/image-editor-store";
import { useChatStore } from "@/stores/chat-store";
import { ImageCompareSlider } from "@/components/image-edit/image-compare-slider";
import { downloadBlob, useJobImage } from "@/components/image-edit/use-job-image";

const EMPTY: string[] = [];

export function ImageJobCard({ jobId, className = "" }: { jobId: string; className?: string }) {
  const track = useImageJobStore((s) => s.track);
  const rootId = useImageJobStore((s) => s.rootOf[jobId] ?? jobId);
  const versions = useImageJobStore((s) => s.versions[rootId] ?? EMPTY);
  const allVersions = useMemo(() => (versions.length > 0 ? versions : [jobId]), [versions, jobId]);
  const [index, setIndex] = useState<number | null>(null);
  // Follow the newest version unless the user picked one
  const activeIndex = index == null ? allVersions.length - 1 : Math.min(index, allVersions.length - 1);
  const activeId = allVersions[activeIndex];
  const job = useImageJobStore((s) => s.jobs[activeId]);

  useEffect(() => {
    track(jobId);
  }, [jobId, track]);

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.02] max-w-[460px] ${
        job && !IMAGE_JOB_TERMINAL.has(job.status) ? "img-edit-glow border-transparent" : ""
      } ${className}`}
    >
      {!job ? (
        <div className="aspect-[4/3] img-edit-skeleton flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-white/30" />
        </div>
      ) : job.status === "completed" ? (
        <CompletedBody job={job} />
      ) : job.status === "failed" || job.status === "cancelled" ? (
        <FailedBody job={job} />
      ) : (
        <RunningBody job={job} />
      )}

      {job && (
        <CardFooter
          job={job}
          versionsCount={allVersions.length}
          activeIndex={activeIndex}
          onPrev={() => setIndex(Math.max(0, activeIndex - 1))}
          onNext={() => setIndex(Math.min(allVersions.length - 1, activeIndex + 1))}
          onRegenerated={() => setIndex(null)}
        />
      )}
    </div>
  );
}

// ── Running / queued ────────────────────────────────────────────────────
function RunningBody({ job }: { job: ImageJob }) {
  const { url: inputUrl } = useJobImage(job.job_id, "input");
  const pct = Math.round(Math.min(1, Math.max(0, job.progress || 0)) * 100);
  const queued = job.status === "queued";
  const ratio = job.input_width && job.input_height ? job.input_width / job.input_height : 4 / 3;

  return (
    <div className="relative" style={{ aspectRatio: String(Math.min(2, Math.max(0.6, ratio))) }}>
      {inputUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={inputUrl} alt="Original" className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px] scale-105" />
      )}
      <div className="absolute inset-0 img-edit-skeleton" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl img-edit-gradient shadow-lg shadow-[#7C4DFF]/30">
          <Sparkles size={20} className="text-white" />
          <span className="absolute inset-0 rounded-2xl img-edit-gradient opacity-50 animate-ping" />
        </span>
        <div>
          <p className="text-white text-sm font-semibold">
            {queued
              ? job.queue_position && job.queue_position > 1
                ? `In queue · #${job.queue_position}`
                : "Starting…"
              : job.stage || "Editing…"}
          </p>
          <p className="text-white/50 text-xs mt-0.5">
            {OPERATION_LABELS[job.operation] ?? "Edit"}
            {job.eta_seconds > 0 && ` · ${formatEta(job.eta_seconds)} left`}
          </p>
        </div>
        <div className="w-full max-w-[260px] h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full img-edit-progress" style={{ width: `${Math.max(queued ? 3 : 6, pct)}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Completed ───────────────────────────────────────────────────────────
function CompletedBody({ job }: { job: ImageJob }) {
  const version = job.finished_at ?? undefined;
  const { url: inputUrl } = useJobImage(job.job_id, "input");
  const { url: resultUrl, error } = useJobImage(job.job_id, "result", true, version);
  const ratio = job.width && job.height ? job.width / job.height : undefined;
  const checker = job.operation === "remove_background";

  if (error) {
    return (
      <div className="aspect-[4/3] flex flex-col items-center justify-center gap-2 text-white/40 text-xs">
        <AlertCircle size={18} /> Result is no longer available
      </div>
    );
  }
  if (!resultUrl) {
    return <div className="img-edit-skeleton" style={{ aspectRatio: String(ratio ?? 4 / 3) }} />;
  }
  if (!inputUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resultUrl} alt={job.instruction || "Edited image"} className={`block w-full ${checker ? "img-edit-checker" : ""}`} />
    );
  }
  return <ImageCompareSlider beforeSrc={inputUrl} afterSrc={resultUrl} alt={job.instruction || "Edited image"} aspectRatio={ratio} checker={checker} />;
}

// ── Failed / cancelled ──────────────────────────────────────────────────
function FailedBody({ job }: { job: ImageJob }) {
  const cancelled = job.status === "cancelled";
  return (
    <div className="px-5 py-6 flex items-start gap-3">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${cancelled ? "bg-white/5" : "bg-red-500/10"}`}>
        {cancelled ? <X size={16} className="text-white/40" /> : <AlertCircle size={16} className="text-red-400" />}
      </div>
      <div className="min-w-0">
        <p className="text-white/85 text-sm font-medium">{cancelled ? "Edit cancelled" : "Couldn't edit this image"}</p>
        <p className="text-white/45 text-xs mt-0.5 break-words">
          {cancelled ? "No changes were made." : job.error || "Something went wrong. Try again."}
        </p>
      </div>
    </div>
  );
}

// ── Footer: caption + actions ───────────────────────────────────────────
function CardFooter({
  job,
  versionsCount,
  activeIndex,
  onPrev,
  onNext,
  onRegenerated,
}: {
  job: ImageJob;
  versionsCount: number;
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onRegenerated: () => void;
}) {
  const regenerate = useImageJobStore((s) => s.regenerate);
  const cancel = useImageJobStore((s) => s.cancel);
  const saveToNas = useImageJobStore((s) => s.saveToNas);
  const openEditor = useImageEditorStore((s) => s.open);
  const sessionId = useChatStore((s) => s.conversationId);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = job.status === "completed";
  const failed = job.status === "failed" || job.status === "cancelled";
  const running = !done && !failed;
  const savedToNas = !!job.nas_file_id;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const run = async (name: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const fileName = `sphere-edit-${job.job_id.slice(0, 8)}.png`;

  const onDownload = () =>
    run("download", async () => {
      const blob = await apiClient.fetchImageJobBlob(job.job_id, "result", job.finished_at ?? undefined);
      downloadBlob(blob, fileName);
    });

  const onShare = () =>
    run("share", async () => {
      const blob = await apiClient.fetchImageJobBlob(job.job_id, "result", job.finished_at ?? undefined);
      const file = new File([blob], fileName, { type: blob.type || "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Edited with Sphere AI" });
          return;
        } catch {
          // user dismissed the share sheet (AbortError) — respect it, don't auto-download
          return;
        }
      }
      downloadBlob(blob, fileName);
      flash("Sharing isn't supported here — downloaded instead");
    });

  return (
    <div className="px-3.5 py-2.5 border-t border-white/[0.06] space-y-2">
      {job.instruction && (
        <p className="text-white/60 text-[12.5px] leading-snug line-clamp-2" title={job.instruction}>
          {job.instruction}
        </p>
      )}
      <div className="flex items-center gap-0.5 flex-wrap">
        {versionsCount > 1 && (
          <div className="flex items-center mr-1 text-white/45 text-[11px] font-mono">
            <IconBtn label="Previous version" onClick={onPrev} disabled={activeIndex === 0}>
              <ChevronLeft size={14} />
            </IconBtn>
            {activeIndex + 1}/{versionsCount}
            <IconBtn label="Next version" onClick={onNext} disabled={activeIndex >= versionsCount - 1}>
              <ChevronRight size={14} />
            </IconBtn>
          </div>
        )}

        {running ? (
          <button
            onClick={() => run("cancel", () => cancel(job.job_id))}
            disabled={busy === "cancel"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-40"
          >
            {busy === "cancel" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Cancel
          </button>
        ) : (
          <>
            {done && (
              <button
                onClick={() => openEditor({ source: { kind: "job", jobId: job.job_id }, sessionId })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
              >
                <Pencil size={13} /> Edit
              </button>
            )}
            <IconBtn
              label={failed ? "Try again" : "Regenerate"}
              onClick={() =>
                run("regen", async () => {
                  await regenerate(job.job_id);
                  onRegenerated();
                })
              }
              disabled={!!busy}
            >
              {busy === "regen" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </IconBtn>
            {done && (
              <>
                <IconBtn label="Download" onClick={onDownload} disabled={!!busy}>
                  {busy === "download" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </IconBtn>
                <IconBtn label="Share" onClick={onShare} disabled={!!busy}>
                  <Share2 size={14} />
                </IconBtn>
                <IconBtn
                  label={savedToNas ? "Saved to NAS" : "Save to NAS"}
                  onClick={() =>
                    run("nas", async () => {
                      await saveToNas(job.job_id);
                      flash("Saved to your NAS");
                    })
                  }
                  disabled={!!busy || savedToNas}
                  active={savedToNas}
                >
                  {busy === "nas" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : savedToNas ? (
                    <Check size={14} />
                  ) : (
                    <HardDriveUpload size={14} />
                  )}
                </IconBtn>
              </>
            )}
          </>
        )}

        <span className="ml-auto text-[10.5px] text-white/30 truncate">
          {notice ??
            (done && job.duration_seconds
              ? `${OPERATION_LABELS[job.operation] ?? "Edit"} · ${Math.round(job.duration_seconds)} s`
              : "")}
        </span>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed ${
        active
          ? "text-emerald-400 bg-emerald-400/10"
          : "text-white/45 hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-30"
      }`}
    >
      {children}
    </button>
  );
}
