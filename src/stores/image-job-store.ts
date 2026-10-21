// ============================================================================
// Sphere AI — Image Job Store (Zustand)
// Server: /image-edits/* — async GPU jobs (submit → 202 → poll → completed)
//
// One cache + one poller per job for every consumer (chat cards, editor):
// - 750 ms while running (smooth progress), 2 s while queued
// - Exponential backoff on network errors, gives up after ~2 min of failures
// - Pauses while the tab is hidden, resumes immediately when it returns
// - Regenerations are grouped as "versions" of the original job (‹2/3›)
// ============================================================================

import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import { IMAGE_JOB_TERMINAL, type ImageEditRequest, type ImageJob } from "@/lib/types";

const RUNNING_INTERVAL_MS = 750;
const QUEUED_INTERVAL_MS = 2_000;
const MAX_BACKOFF_MS = 15_000;
const MAX_ERRORS = 12;

interface ImageJobState {
  jobs: Record<string, ImageJob>;
  /** root job id → ordered version job ids (root first) */
  versions: Record<string, string[]>;
  /** version job id → root job id */
  rootOf: Record<string, string>;
  /** Insert/refresh a snapshot (e.g. from an SSE `image_job` event). */
  upsert: (job: ImageJob) => void;
  /** Ensure a job is cached and polled until terminal. */
  track: (jobId: string) => void;
  submit: (req: ImageEditRequest) => Promise<ImageJob>;
  cancel: (jobId: string) => Promise<void>;
  /** Start a new version of `jobId`; returns the new job. */
  regenerate: (jobId: string, mode?: string) => Promise<ImageJob>;
  saveToNas: (jobId: string) => Promise<string>;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const errorCounts = new Map<string, number>();
const tracked = new Set<string>();
let visibilityBound = false;

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useImageJobStore = create<ImageJobState>()((set, get) => {
  const stopPolling = (jobId: string) => {
    const t = timers.get(jobId);
    if (t) clearTimeout(t);
    timers.delete(jobId);
  };

  const schedule = (jobId: string, delay: number) => {
    stopPolling(jobId);
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    timers.set(jobId, setTimeout(() => void poll(jobId), delay));
  };

  const poll = async (jobId: string) => {
    timers.delete(jobId);
    try {
      const job = await apiClient.getImageJob(jobId);
      errorCounts.delete(jobId);
      get().upsert(job);
      if (IMAGE_JOB_TERMINAL.has(job.status)) {
        tracked.delete(jobId);
        return;
      }
      schedule(jobId, job.status === "queued" ? QUEUED_INTERVAL_MS : RUNNING_INTERVAL_MS);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404 || status === 401 || status === 403) {
        tracked.delete(jobId);
        return;
      }
      const n = (errorCounts.get(jobId) ?? 0) + 1;
      errorCounts.set(jobId, n);
      if (n >= MAX_ERRORS) {
        tracked.delete(jobId);
        return;
      }
      schedule(jobId, Math.min(MAX_BACKOFF_MS, RUNNING_INTERVAL_MS * 2 ** n));
    }
  };

  const bindVisibility = () => {
    if (visibilityBound || typeof document === "undefined") return;
    visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        for (const id of [...timers.keys()]) stopPolling(id);
        return;
      }
      for (const id of tracked) schedule(id, 0);
    });
  };

  const addVersion = (rootId: string, versionId: string) => {
    const { versions, rootOf } = get();
    const list = versions[rootId] ?? [rootId];
    if (list.includes(versionId)) return;
    set({
      versions: { ...versions, [rootId]: [...list, versionId] },
      rootOf: { ...rootOf, [versionId]: rootId },
    });
  };

  return {
    jobs: {},
    versions: {},
    rootOf: {},

    upsert: (job) => {
      if (!job?.job_id) return;
      set({ jobs: { ...get().jobs, [job.job_id]: { ...get().jobs[job.job_id], ...job } } });
      if (!IMAGE_JOB_TERMINAL.has(job.status) && !tracked.has(job.job_id)) {
        get().track(job.job_id);
      }
    },

    track: (jobId) => {
      if (!jobId) return;
      bindVisibility();
      const cached = get().jobs[jobId];
      if (cached && IMAGE_JOB_TERMINAL.has(cached.status)) return;
      if (tracked.has(jobId)) return; // already polling (visibility handler resumes paused jobs)
      tracked.add(jobId);
      schedule(jobId, cached ? RUNNING_INTERVAL_MS : 0);
    },

    submit: async (req) => {
      const job = await apiClient.submitImageEdit(req, newIdempotencyKey());
      get().upsert(job);
      get().track(job.job_id);
      return job;
    },

    cancel: async (jobId) => {
      const job = await apiClient.cancelImageJob(jobId);
      stopPolling(jobId);
      tracked.delete(jobId);
      get().upsert(job);
    },

    regenerate: async (jobId, mode) => {
      const rootId = get().rootOf[jobId] ?? jobId;
      const job = await apiClient.regenerateImageJob(jobId, mode);
      get().upsert(job);
      addVersion(rootId, job.job_id);
      get().track(job.job_id);
      return job;
    },

    saveToNas: async (jobId) => {
      const res = await apiClient.saveImageJobToNas(jobId);
      const job = get().jobs[jobId];
      if (job) set({ jobs: { ...get().jobs, [jobId]: { ...job, nas_file_id: res.file_id } } });
      return res.file_id;
    },
  };
});

/** Human-friendly ETA ("~12 s", "~2 min"). */
export function formatEta(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s <= 0) return "a moment";
  if (s < 60) return `~${s} s`;
  return `~${Math.round(s / 60)} min`;
}

export const OPERATION_LABELS: Record<string, string> = {
  auto: "Edit",
  edit: "Edit",
  remove_background: "Remove background",
  upscale: "Enhance",
  erase: "Erase",
  restyle: "Restyle",
};
