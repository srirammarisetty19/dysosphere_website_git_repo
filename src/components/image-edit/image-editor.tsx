"use client";

// ============================================================================
// AI Image Editor — full-screen editor (brush/mask, quick actions, prompt)
//
// Flow (same as the Flutter app):
//   1. Pick an image (upload / paste / drop, chat image, NAS file, or a
//      previous result — results continue via parent_job_id, no re-upload)
//   2. Optionally paint a mask (white = edit, black = keep) with brush/eraser
//   3. Quick action (Remove background · Enhance · Erase selected · Restyle)
//      or a free-form prompt, with quality Fast / Standard / Max
//   4. Live progress → before/after compare → Keep editing / versions
//
// The mask is painted on a canvas at ≤2048 px (server resizes to the input).
// Strokes are stored as vector ops so undo/redo is cheap at any resolution.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import {
  AlertCircle,
  Brush,
  Check,
  Download,
  Eraser,
  FlipHorizontal2,
  Hand,
  HardDriveUpload,
  ImagePlus,
  Loader2,
  Maximize,
  Minus,
  Palette,
  Plus,
  Redo2,
  RefreshCw,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { IMAGE_JOB_TERMINAL, type ImageEditMode, type ImageEditOperation, type ImageJob } from "@/lib/types";
import { OPERATION_LABELS, formatEta, useImageJobStore } from "@/stores/image-job-store";
import type { ImageEditorSource } from "@/stores/image-editor-store";
import { ImageCompareSlider } from "@/components/image-edit/image-compare-slider";
import { downloadBlob, useJobImage } from "@/components/image-edit/use-job-image";

// ── Constants ───────────────────────────────────────────────────────────
const MASK_COLOR = "#FF4081";
const MAX_MASK_SIDE = 2048;
const MAX_UPLOAD_SIDE = 4096;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MIN_BRUSH = 4;
const MAX_BRUSH = 160;

export const RESTYLE_PRESETS = [
  "Watercolor painting",
  "Anime illustration",
  "Oil painting",
  "Pencil sketch",
  "Cinematic film still",
  "3D animated movie character",
  "Vintage 1970s photo",
  "Studio product photo on white",
] as const;

const PROMPT_IDEAS = ["Make it golden hour", "Add light snowfall", "Remove the people in the background", "Change the sky to a starry night"];

const QUALITY: { mode: ImageEditMode; label: string; hint: string }[] = [
  { mode: "fast", label: "Fast", hint: "Quick preview" },
  { mode: "standard", label: "Standard", hint: "Balanced" },
  { mode: "max", label: "Max", hint: "Best detail" },
];

// ── Types ───────────────────────────────────────────────────────────────
type Tool = "brush" | "eraser" | "pan";

type MaskOp =
  | { type: "stroke"; erase: boolean; size: number; points: number[] }
  | { type: "invert" }
  | { type: "clear" };

interface BaseImage {
  url: string;
  width: number;
  height: number;
  /** Bytes to upload (null when continuing from a previous result) */
  blob: Blob | null;
  parentJobId: string | null;
  name: string;
}

interface ImageEditorProps {
  source: ImageEditorSource | null;
  sessionId: string | null;
  initialPrompt?: string;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image format isn't supported by your browser."));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality)
  );
}

/** Downscale very large / exotic images before upload (server limit ~25 MB). */
async function prepareUpload(blob: Blob, img: HTMLImageElement): Promise<Blob> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const okType = /image\/(png|jpeg|webp)/.test(blob.type);
  if (Math.max(w, h) <= MAX_UPLOAD_SIDE && blob.size <= MAX_UPLOAD_BYTES && okType) return blob;
  const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return blob.type === "image/png" && c.width * c.height < 4_000_000
    ? canvasToBlob(c, "image/png")
    : canvasToBlob(c, "image/jpeg", 0.93);
}

function drawOps(canvas: HTMLCanvasElement, ops: MaskOp[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const op of ops) {
    if (op.type === "clear") {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else if (op.type === "invert") {
      ctx.globalCompositeOperation = "xor";
      ctx.fillStyle = MASK_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      drawStroke(ctx, op.points, op.size, op.erase);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawStroke(ctx: CanvasRenderingContext2D, pts: number[], size: number, erase: boolean) {
  if (pts.length < 2) return;
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.strokeStyle = MASK_COLOR;
  ctx.fillStyle = MASK_COLOR;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.arc(pts[0], pts[1], size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

/** Mask PNG: white = edit, black = keep. Returns null when nothing is painted. */
async function exportMask(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = new ImageData(w, h);
  const d = out.data;
  let any = false;
  for (let i = 0; i < w * h; i++) {
    const v = src[i * 4 + 3] > 24 ? 255 : 0;
    if (v) any = true;
    d[i * 4] = v;
    d[i * 4 + 1] = v;
    d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  if (!any) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.putImageData(out, 0, 0);
  return canvasToBlob(c, "image/png");
}

function maskIsActive(ops: MaskOp[]): boolean {
  let active = false;
  for (const op of ops) {
    if (op.type === "clear") active = false;
    else if (op.type === "invert") active = true;
    else if (!op.erase) active = true;
  }
  return active;
}

// ============================================================================
// Component
// ============================================================================
export function ImageEditor({ source, sessionId, initialPrompt = "", onClose }: ImageEditorProps) {
  const submit = useImageJobStore((s) => s.submit);
  const cancelJob = useImageJobStore((s) => s.cancel);
  const regenerate = useImageJobStore((s) => s.regenerate);
  const saveToNas = useImageJobStore((s) => s.saveToNas);
  const jobs = useImageJobStore((s) => s.jobs);

  // ── Image + session state ──
  const [base, setBase] = useState<BaseImage | null>(null);
  const [loadingSource, setLoadingSource] = useState<boolean>(!!source);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(source?.kind === "job" ? [source.jobId] : []);
  const [viewJobId, setViewJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Tools ──
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(40);
  const [ops, setOps] = useState<MaskOp[]>([]);
  const [redoOps, setRedoOps] = useState<MaskOp[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);

  // ── Prompt panel ──
  const [prompt, setPrompt] = useState(initialPrompt);
  const [mode, setMode] = useState<ImageEditMode>("standard");
  const [showStyles, setShowStyles] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const strokeRef = useRef<{ pts: number[]; size: number; erase: boolean } | null>(null);
  const panDragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const viewJob: ImageJob | undefined = viewJobId ? jobs[viewJobId] : undefined;
  const activeJob = useMemo(
    () => history.map((id) => jobs[id]).find((j) => j && !IMAGE_JOB_TERMINAL.has(j.status)),
    [history, jobs]
  );
  const isRunning = !!activeJob || submitting;
  const hasMask = maskIsActive(ops);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }, []);

  // Revoke every object URL we created on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // ── Load a source into the canvas ──
  const loadFromBlob = useCallback(async (blob: Blob, name: string, parentJobId: string | null) => {
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.push(url);
    const img = await loadImage(url);
    const upload = parentJobId ? null : await prepareUpload(blob, img);
    setBase({ url, width: img.naturalWidth, height: img.naturalHeight, blob: upload, parentJobId, name });
    setOps([]);
    setRedoOps([]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setViewJobId(null);
    setError(null);
  }, []);

  // Callers own the loading flag (initial state is already `true` when a source is given)
  const loadSource = useCallback(
    async (src: ImageEditorSource) => {
      try {
        if (src.kind === "blob") {
          await loadFromBlob(src.blob, src.name ?? "image", null);
        } else if (src.kind === "job") {
          const blob = await apiClient.fetchImageJobBlob(src.jobId, "result");
          await loadFromBlob(blob, `edit-${src.jobId.slice(0, 8)}`, src.jobId);
        } else {
          const objUrl = await apiClient.fetchAuthenticatedFileBlob(src.url);
          const blob = await (await fetch(objUrl)).blob();
          URL.revokeObjectURL(objUrl);
          await loadFromBlob(blob, src.name ?? src.url.split("/").pop() ?? "image", null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open this image");
      } finally {
        setLoadingSource(false);
      }
    },
    [loadFromBlob]
  );

  // Initial source (editor is remounted per open). Deferred to a callback so
  // StrictMode's mount→unmount→mount only loads once.
  useEffect(() => {
    if (!source) return;
    const t = setTimeout(() => void loadSource(source), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stage size (fit image) ──
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maskDims = useMemo(() => {
    if (!base) return { w: 0, h: 0 };
    const s = Math.min(1, MAX_MASK_SIDE / Math.max(base.width, base.height));
    return { w: Math.max(1, Math.round(base.width * s)), h: Math.max(1, Math.round(base.height * s)) };
  }, [base]);

  const fit = useMemo(() => {
    if (!base || !stageSize.w || !stageSize.h) return { w: 0, h: 0 };
    const pad = 32;
    const s = Math.min((stageSize.w - pad) / base.width, (stageSize.h - pad) / base.height, 3);
    return { w: Math.max(1, base.width * s), h: Math.max(1, base.height * s) };
  }, [base, stageSize]);

  // Replay mask ops whenever they (or the canvas size) change
  useEffect(() => {
    const c = canvasRef.current;
    if (c) drawOps(c, ops);
  }, [ops, maskDims.w, maskDims.h, viewJobId]);

  // ── Wheel zoom (non-passive so we can preventDefault) ──
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!base) return;
      e.preventDefault();
      setZoom((z) => Math.min(8, Math.max(0.5, z * (1 - e.deltaY * 0.0015))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [base]);

  // ── Mask actions ──
  const pushOp = useCallback((op: MaskOp) => {
    setOps((prev) => [...prev, op]);
    setRedoOps([]);
  }, []);
  const undo = useCallback(() => {
    if (ops.length === 0) return;
    setRedoOps([...redoOps, ops[ops.length - 1]]);
    setOps(ops.slice(0, -1));
  }, [ops, redoOps]);
  const redo = useCallback(() => {
    if (redoOps.length === 0) return;
    setOps([...ops, redoOps[redoOps.length - 1]]);
    setRedoOps(redoOps.slice(0, -1));
  }, [ops, redoOps]);
  const invert = useCallback(() => pushOp({ type: "invert" }), [pushOp]);
  const clearMask = useCallback(() => {
    if (ops.length > 0) pushOp({ type: "clear" });
  }, [ops.length, pushOp]);

  // ── Pointer handling on the canvas ──
  const toMask = (e: PointerEvent<HTMLElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
      scale: c.width / r.width,
    };
  };

  const isPanning = tool === "pan" || spaceDown;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!base || viewJobId) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (isPanning || e.button === 1) {
      panDragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    if (e.button !== 0) return;
    const { x, y, scale } = toMask(e);
    const size = brushSize * scale;
    const erase = tool === "eraser";
    strokeRef.current = { pts: [x, y], size, erase };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      drawStroke(ctx, [x, y], size, erase);
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Brush cursor preview (direct DOM update — no re-render per move)
    const cur = cursorRef.current;
    const stage = stageRef.current;
    if (cur && stage) {
      const r = stage.getBoundingClientRect();
      cur.style.transform = `translate(${e.clientX - r.left - brushSize / 2}px, ${e.clientY - r.top - brushSize / 2}px)`;
    }
    if (panDragRef.current) {
      const d = panDragRef.current;
      setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
      return;
    }
    const s = strokeRef.current;
    if (!s) return;
    const { x, y } = toMask(e);
    const n = s.pts.length;
    const lx = s.pts[n - 2];
    const ly = s.pts[n - 1];
    if (Math.hypot(x - lx, y - ly) < 1.5) return;
    s.pts.push(x, y);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      drawStroke(ctx, [lx, ly, x, y], s.size, s.erase);
      ctx.globalCompositeOperation = "source-over";
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (panDragRef.current) {
      panDragRef.current = null;
      return;
    }
    const s = strokeRef.current;
    strokeRef.current = null;
    if (s) pushOp({ type: "stroke", erase: s.erase, size: s.size, points: s.pts });
  };

  // ── Submit ──
  const runEdit = useCallback(
    async (operation: ImageEditOperation, instruction: string, opts?: { upscaleFactor?: 2 | 4; useMask?: boolean }) => {
      if (!base || isRunning) return;
      setSubmitting(true);
      setError(null);
      try {
        const useMask = opts?.useMask ?? (operation === "auto" || operation === "edit" || operation === "erase");
        const mask = useMask && canvasRef.current && hasMask ? await exportMask(canvasRef.current) : null;
        if (operation === "erase" && !mask) {
          flash("Brush over what you want to erase first");
          return;
        }
        const job = await submit({
          image: base.parentJobId ? null : base.blob,
          parentJobId: base.parentJobId,
          mask,
          instruction,
          operation,
          mode,
          sessionId,
          upscaleFactor: opts?.upscaleFactor,
        });
        setHistory((h) => [...h, job.job_id]);
        setViewJobId(job.job_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the edit");
      } finally {
        setSubmitting(false);
      }
    },
    [base, isRunning, hasMask, mode, sessionId, submit, flash]
  );

  const onGenerate = () => {
    const text = prompt.trim();
    if (!text) {
      flash("Describe the change you want");
      return;
    }
    void runEdit("auto", text);
  };

  const onEnhance = () => {
    if (!base) return;
    const factor: 2 | 4 = Math.max(base.width, base.height) <= 1024 ? 4 : 2;
    void runEdit("upscale", `Enhance and upscale ×${factor}`, { upscaleFactor: factor, useMask: false });
  };

  /** Continue editing from a finished result (chains parent_job_id). */
  const keepEditing = async (jobId: string) => {
    setLoadingSource(true);
    try {
      const blob = await apiClient.fetchImageJobBlob(jobId, "result");
      await loadFromBlob(blob, `edit-${jobId.slice(0, 8)}`, jobId);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the result");
    } finally {
      setLoadingSource(false);
    }
  };

  // ── Files: upload / drop / paste ──
  const acceptFile = useCallback(
    async (file: File | Blob | null | undefined, name?: string) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        flash("Please choose an image file");
        return;
      }
      setLoadingSource(true);
      try {
        await loadFromBlob(file, name ?? ("name" in file ? file.name : "image"), null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open this image");
      } finally {
        setLoadingSource(false);
      }
    },
    [flash, loadFromBlob]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (!item) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      e.preventDefault();
      void acceptFile(item.getAsFile(), `pasted-${Date.now()}.png`);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [acceptFile]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    void acceptFile(e.dataTransfer?.files?.[0]);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "TEXTAREA" || tag === "INPUT";
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (typing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === " ") {
        e.preventDefault();
        setSpaceDown(true);
      } else if (!mod && e.key.toLowerCase() === "b") setTool("brush");
      else if (!mod && e.key.toLowerCase() === "e") setTool("eraser");
      else if (!mod && e.key.toLowerCase() === "h") setTool("pan");
      else if (!mod && e.key.toLowerCase() === "i") invert();
      else if (e.key === "[") setBrushSize((s) => Math.max(MIN_BRUSH, s - 6));
      else if (e.key === "]") setBrushSize((s) => Math.min(MAX_BRUSH, s + 6));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceDown(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [onClose, undo, redo, invert]);

  // Lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const showCursor = !!base && !viewJobId && !isPanning;

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-[#0A0A0F] text-white animate-modal-bg"
      role="dialog"
      aria-modal="true"
      aria-label="AI image editor"
    >
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-3 md:px-4 h-14 border-b border-white/[0.06] bg-[#12121C]/80 backdrop-blur-xl shrink-0">
        <button
          id="image-editor-close"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Close (Esc)"
          aria-label="Close editor"
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg img-edit-gradient flex items-center justify-center shrink-0">
            <Wand2 size={14} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold img-edit-gradient-text leading-tight">AI Image Editor</h2>
            <p className="text-[11px] text-white/35 truncate leading-tight">
              {base ? `${base.name} · ${base.width}×${base.height}` : "Private · runs on your SphereX"}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {base && !viewJobId && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ImagePlus size={14} /> Replace image
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          className="hidden"
          onChange={(e) => {
            void acceptFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ── Left toolbar (desktop) ── */}
        {base && !viewJobId && (
          <Toolbar
            className="hidden lg:flex flex-col w-16 border-r border-white/[0.06] py-3"
            tool={tool}
            setTool={setTool}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            canUndo={ops.length > 0}
            canRedo={redoOps.length > 0}
            onUndo={undo}
            onRedo={redo}
            onInvert={invert}
            onClear={clearMask}
            onFit={resetView}
            onZoomIn={() => setZoom((z) => Math.min(8, z * 1.25))}
            onZoomOut={() => setZoom((z) => Math.max(0.5, z / 1.25))}
            zoom={zoom}
          />
        )}

        {/* ── Stage ── */}
        <div className="relative flex-1 min-h-[45vh] lg:min-h-0 flex flex-col">
          <div
            ref={stageRef}
            className={`relative flex-1 overflow-hidden browser-grid ${
              showCursor ? "cursor-none" : isPanning && base ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => {
              if (cursorRef.current) cursorRef.current.style.opacity = "0";
            }}
            onPointerEnter={() => {
              if (cursorRef.current) cursorRef.current.style.opacity = "1";
            }}
          >
            {loadingSource ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-white/40" />
              </div>
            ) : !base ? (
              <EmptyDropzone onPick={() => fileInputRef.current?.click()} />
            ) : viewJobId ? (
              <ResultView job={viewJob} fallbackUrl={base.url} onCancel={(id) => void cancelJob(id)} />
            ) : (
              <div
                className="absolute left-1/2 top-1/2 touch-none"
                style={{
                  width: fit.w,
                  height: fit.h,
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                  transformOrigin: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={base.url}
                  alt="Image being edited"
                  draggable={false}
                  className="absolute inset-0 w-full h-full select-none pointer-events-none rounded-sm shadow-2xl shadow-black/60"
                />
                <canvas
                  ref={canvasRef}
                  width={maskDims.w}
                  height={maskDims.h}
                  className="absolute inset-0 w-full h-full opacity-55 mix-blend-normal pointer-events-none"
                />
              </div>
            )}

            {/* Brush cursor */}
            {showCursor && (
              <div
                ref={cursorRef}
                className={`pointer-events-none absolute left-0 top-0 rounded-full border-2 ${
                  tool === "eraser" ? "border-white/80 border-dashed" : "border-white/90"
                } shadow-[0_0_0_1px_rgba(0,0,0,0.5)]`}
                style={{ width: brushSize, height: brushSize, opacity: 0 }}
              />
            )}

            {/* Hint */}
            {base && !viewJobId && !hasMask && !loadingSource && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-[11.5px] text-white/60 whitespace-nowrap">
                Brush over an area to edit just that part — or describe the change
              </div>
            )}
          </div>

          {/* Mobile toolbar */}
          {base && !viewJobId && (
            <Toolbar
              className="lg:hidden flex flex-row items-center justify-center gap-1 px-2 py-2 border-t border-white/[0.06] overflow-x-auto"
              tool={tool}
              setTool={setTool}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              canUndo={ops.length > 0}
              canRedo={redoOps.length > 0}
              onUndo={undo}
              onRedo={redo}
              onInvert={invert}
              onClear={clearMask}
              onFit={resetView}
              onZoomIn={() => setZoom((z) => Math.min(8, z * 1.25))}
              onZoomOut={() => setZoom((z) => Math.max(0.5, z / 1.25))}
              zoom={zoom}
              horizontal
            />
          )}

          {/* Result actions */}
          {viewJob && (
            <ResultActions
              job={viewJob}
              onKeepEditing={() => void keepEditing(viewJob.job_id)}
              onBack={() => setViewJobId(null)}
              onRegenerate={async () => {
                try {
                  const j = await regenerate(viewJob.job_id, mode);
                  setHistory((h) => [...h, j.job_id]);
                  setViewJobId(j.job_id);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't regenerate");
                }
              }}
              onSaveToNas={async () => {
                try {
                  await saveToNas(viewJob.job_id);
                  flash("Saved to your NAS");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Couldn't save to NAS");
                }
              }}
              onRetry={() => setViewJobId(null)}
            />
          )}

          {/* History strip */}
          {history.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06] bg-[#12121C]/60 overflow-x-auto">
              <span className="text-[10px] uppercase tracking-wider text-white/30 shrink-0 mr-1">History</span>
              {history.map((id, i) => (
                <HistoryThumb
                  key={id}
                  job={jobs[id]}
                  index={i + 1}
                  active={viewJobId === id}
                  onClick={() => setViewJobId(viewJobId === id ? null : id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.06] bg-[#12121C] flex flex-col max-h-[48vh] lg:max-h-none overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Errors / notices */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-300/60 hover:text-red-300">
                  <X size={13} />
                </button>
              </div>
            )}
            {notice && (
              <div className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/70 text-xs animate-in">
                {notice}
              </div>
            )}

            {/* Quick actions */}
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">Quick actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickAction
                  id="image-edit-remove-bg"
                  icon={<Scissors size={16} />}
                  label="Remove background"
                  disabled={!base || isRunning}
                  onClick={() => void runEdit("remove_background", "Remove the background", { useMask: false })}
                />
                <QuickAction
                  id="image-edit-enhance"
                  icon={<ZoomIn size={16} />}
                  label="Enhance"
                  sub={base ? `Upscale ×${Math.max(base.width, base.height) <= 1024 ? 4 : 2}` : "Upscale"}
                  disabled={!base || isRunning}
                  onClick={onEnhance}
                />
                <QuickAction
                  id="image-edit-erase"
                  icon={<Eraser size={16} />}
                  label="Erase selected"
                  sub={hasMask ? "Uses your brush mask" : "Brush over it first"}
                  disabled={!base || isRunning || !hasMask}
                  onClick={() => void runEdit("erase", "Remove the selected object and fill naturally", { useMask: true })}
                />
                <QuickAction
                  id="image-edit-restyle"
                  icon={<Palette size={16} />}
                  label="Restyle"
                  sub="8 styles"
                  active={showStyles}
                  disabled={!base || isRunning}
                  onClick={() => setShowStyles((v) => !v)}
                />
              </div>
              {showStyles && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 animate-in">
                  {RESTYLE_PRESETS.map((p) => (
                    <button
                      key={p}
                      disabled={!base || isRunning}
                      onClick={() => void runEdit("restyle", p, { useMask: false })}
                      className="px-2.5 py-1.5 rounded-lg text-[11.5px] text-white/70 bg-white/[0.04] border border-white/[0.08] hover:border-[#7C4DFF]/50 hover:text-white hover:bg-[#7C4DFF]/10 transition-colors disabled:opacity-40"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Prompt */}
            <section>
              <label htmlFor="image-edit-prompt" className="block text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">
                Describe your edit
              </label>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] focus-within:border-[#7C4DFF]/50 transition-colors">
                <textarea
                  id="image-edit-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      onGenerate();
                    }
                  }}
                  rows={3}
                  maxLength={1000}
                  placeholder={hasMask ? "What should go in the highlighted area?" : "e.g. Make it look like a rainy evening"}
                  className="w-full bg-transparent resize-none px-3 py-2.5 text-[13.5px] text-white placeholder:text-white/25 focus:outline-none"
                />
              </div>
              {!prompt && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PROMPT_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      onClick={() => setPrompt(idea)}
                      className="px-2 py-1 rounded-md text-[11px] text-white/45 bg-white/[0.03] hover:bg-white/[0.07] hover:text-white/75 transition-colors"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Quality */}
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2.5">Quality</h3>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]" role="radiogroup" aria-label="Quality">
                {QUALITY.map((q) => (
                  <button
                    key={q.mode}
                    role="radio"
                    aria-checked={mode === q.mode}
                    onClick={() => setMode(q.mode)}
                    className={`py-1.5 rounded-lg text-center transition-all ${
                      mode === q.mode ? "img-edit-gradient text-white shadow-md shadow-[#7C4DFF]/20" : "text-white/55 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="block text-xs font-semibold">{q.label}</span>
                    <span className={`block text-[10px] ${mode === q.mode ? "text-white/80" : "text-white/30"}`}>{q.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Generate */}
            <button
              id="image-edit-generate"
              onClick={onGenerate}
              disabled={!base || isRunning || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl img-edit-gradient text-white text-sm font-semibold shadow-lg shadow-[#7C4DFF]/25 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {isRunning ? "Working…" : hasMask ? "Edit selected area" : "Generate edit"}
              {!isRunning && <kbd className="hidden md:inline text-[10px] font-mono text-white/60 ml-1">⌘↵</kbd>}
            </button>

            <p className="text-[10.5px] text-white/25 leading-relaxed">
              Edits run privately on your SphereX GPU with open-source models. While an image is being created, chat replies
              pause for a few seconds.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================
function Toolbar({
  className,
  tool,
  setTool,
  brushSize,
  setBrushSize,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onInvert,
  onClear,
  onFit,
  onZoomIn,
  onZoomOut,
  zoom,
  horizontal = false,
}: {
  className: string;
  tool: Tool;
  setTool: (t: Tool) => void;
  brushSize: number;
  setBrushSize: (n: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInvert: () => void;
  onClear: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoom: number;
  horizontal?: boolean;
}) {
  const sep = <div className={horizontal ? "w-px h-6 bg-white/10 mx-1 shrink-0" : "h-px w-8 bg-white/10 my-1.5 mx-auto"} />;
  return (
    <div className={`${className} items-center gap-1 bg-[#12121C]/70`}>
      <ToolBtn label="Brush (B)" active={tool === "brush"} onClick={() => setTool("brush")}>
        <Brush size={17} />
      </ToolBtn>
      <ToolBtn label="Eraser (E)" active={tool === "eraser"} onClick={() => setTool("eraser")}>
        <Eraser size={17} />
      </ToolBtn>
      <ToolBtn label="Move (H / hold Space)" active={tool === "pan"} onClick={() => setTool("pan")}>
        <Hand size={17} />
      </ToolBtn>
      {sep}
      <div className={`flex ${horizontal ? "flex-row" : "flex-col"} items-center gap-1.5 px-1`} title="Brush size ([ / ])">
        <span
          className="rounded-full bg-[#FF4081]/70 border border-white/40 shrink-0"
          style={{ width: Math.max(6, brushSize / 6), height: Math.max(6, brushSize / 6) }}
        />
        <input
          type="range"
          min={MIN_BRUSH}
          max={MAX_BRUSH}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          aria-label="Brush size"
          className={`accent-[#7C4DFF] ${horizontal ? "w-24" : "w-12 [writing-mode:vertical-lr] [direction:rtl] h-24"}`}
        />
      </div>
      {sep}
      <ToolBtn label="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={17} />
      </ToolBtn>
      <ToolBtn label="Redo (⇧⌘Z)" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={17} />
      </ToolBtn>
      <ToolBtn label="Invert selection (I)" onClick={onInvert}>
        <FlipHorizontal2 size={17} />
      </ToolBtn>
      <ToolBtn label="Clear mask" onClick={onClear} disabled={!canUndo}>
        <Trash2 size={17} />
      </ToolBtn>
      {sep}
      <ToolBtn label="Zoom in" onClick={onZoomIn}>
        <Plus size={17} />
      </ToolBtn>
      <span className="text-[10px] text-white/40 font-mono w-10 text-center shrink-0">{Math.round(zoom * 100)}%</span>
      <ToolBtn label="Zoom out" onClick={onZoomOut}>
        <Minus size={17} />
      </ToolBtn>
      <ToolBtn label="Fit to screen" onClick={onFit}>
        <Maximize size={16} />
      </ToolBtn>
    </div>
  );
}

function ToolBtn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${
        active
          ? "img-edit-gradient text-white shadow-md shadow-[#7C4DFF]/30"
          : "text-white/55 hover:text-white hover:bg-white/[0.07] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
      }`}
    >
      {children}
    </button>
  );
}

function QuickAction({
  id,
  icon,
  label,
  sub,
  disabled,
  active,
  onClick,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  sub?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
        active
          ? "border-[#7C4DFF]/50 bg-[#7C4DFF]/10"
          : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.15] hover:bg-white/[0.06]"
      }`}
    >
      <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#00BCD4]/20 to-[#7C4DFF]/20 text-[#9fe8f2] group-hover:from-[#00BCD4]/30 group-hover:to-[#7C4DFF]/30 transition-colors">
        {icon}
      </span>
      <span className="text-[12.5px] font-medium text-white/85 leading-tight">{label}</span>
      {sub && <span className="text-[10.5px] text-white/35 leading-tight -mt-1">{sub}</span>}
    </button>
  );
}

function EmptyDropzone({ onPick }: { onPick: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <button
        id="image-editor-upload"
        onClick={onPick}
        className="group w-full max-w-md flex flex-col items-center gap-4 px-8 py-12 rounded-3xl border-2 border-dashed border-white/10 hover:border-[#7C4DFF]/50 bg-white/[0.02] hover:bg-[#7C4DFF]/[0.04] transition-all"
      >
        <span className="h-16 w-16 rounded-2xl img-edit-gradient flex items-center justify-center shadow-xl shadow-[#7C4DFF]/30 group-hover:scale-105 transition-transform">
          <Upload size={26} />
        </span>
        <div className="text-center">
          <p className="text-white text-base font-semibold">Choose an image to edit</p>
          <p className="text-white/40 text-sm mt-1">Drop it here, paste it, or click to browse</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 text-[11px] text-white/35">
          {["Remove background", "Erase objects", "Restyle", "Upscale", "Edit with words"].map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-white/[0.04]">
              {t}
            </span>
          ))}
        </div>
      </button>
    </div>
  );
}

function ResultView({
  job,
  fallbackUrl,
  onCancel,
}: {
  job: ImageJob | undefined;
  fallbackUrl: string;
  onCancel: (jobId: string) => void;
}) {
  const done = job?.status === "completed";
  const { url: inputUrl } = useJobImage(job?.job_id, "input");
  const { url: resultUrl } = useJobImage(job?.job_id, "result", done, job?.finished_at ?? null);

  if (job && done && resultUrl) {
    return (
      <div className="absolute inset-4">
        <ImageCompareSlider
          beforeSrc={inputUrl ?? fallbackUrl}
          afterSrc={resultUrl}
          alt={job.instruction || "Edited image"}
          className="h-full w-full rounded-lg"
          checker={job.operation === "remove_background"}
        />
      </div>
    );
  }

  const failed = job && (job.status === "failed" || job.status === "cancelled");
  const pct = Math.round(Math.min(1, Math.max(0, job?.progress ?? 0)) * 100);
  const queued = job?.status === "queued";

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={inputUrl ?? fallbackUrl} alt="" className="max-h-full max-w-full object-contain opacity-30 blur-[3px] rounded-lg" />
      {!failed && <div className="absolute inset-0 img-edit-skeleton opacity-60" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {failed ? (
          <>
            <span className="h-12 w-12 rounded-2xl bg-red-500/15 flex items-center justify-center">
              <AlertCircle size={22} className="text-red-400" />
            </span>
            <div>
              <p className="text-white font-semibold">{job!.status === "cancelled" ? "Edit cancelled" : "This edit didn't work"}</p>
              <p className="text-white/50 text-sm mt-1 max-w-sm">{job!.error || "Try a different prompt or quality."}</p>
            </div>
          </>
        ) : (
          <>
            <span className="relative h-14 w-14 rounded-2xl img-edit-gradient flex items-center justify-center shadow-xl shadow-[#7C4DFF]/40">
              <Sparkles size={24} />
              <span className="absolute inset-0 rounded-2xl img-edit-gradient opacity-50 animate-ping" />
            </span>
            <div>
              <p className="text-white font-semibold">
                {!job
                  ? "Starting…"
                  : queued
                    ? job.queue_position && job.queue_position > 1
                      ? `Waiting in queue · #${job.queue_position}`
                      : "Getting the GPU ready…"
                    : job.stage || "Editing…"}
              </p>
              <p className="text-white/50 text-sm mt-1">
                {job ? OPERATION_LABELS[job.operation] ?? "Edit" : "Edit"}
                {job && job.eta_seconds > 0 ? ` · ${formatEta(job.eta_seconds)} left` : ""}
              </p>
            </div>
            <div className="w-72 max-w-full">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full img-edit-progress" style={{ width: `${Math.max(queued ? 3 : 6, pct)}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10.5px] text-white/35 font-mono">
                <span>{job?.total_steps ? `step ${job.step ?? 0}/${job.total_steps}` : ""}</span>
                <span>{pct}%</span>
              </div>
            </div>
            {job && (
              <button
                onClick={() => onCancel(job.job_id)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/55 hover:text-white hover:bg-white/[0.07] transition-colors"
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResultActions({
  job,
  onKeepEditing,
  onBack,
  onRegenerate,
  onSaveToNas,
  onRetry,
}: {
  job: ImageJob;
  onKeepEditing: () => void;
  onBack: () => void;
  onRegenerate: () => Promise<void>;
  onSaveToNas: () => Promise<void>;
  onRetry: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const done = job.status === "completed";
  const failed = job.status === "failed" || job.status === "cancelled";
  if (!done && !failed) return null;

  const wrap = (name: string, fn: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(name);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2.5 border-t border-white/[0.06] bg-[#12121C]/80">
      {done ? (
        <>
          <button
            id="image-edit-keep-editing"
            onClick={onKeepEditing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl img-edit-gradient text-white text-xs font-semibold shadow-md shadow-[#7C4DFF]/25 hover:brightness-110 transition-all"
          >
            <Wand2 size={14} /> Keep editing
          </button>
          <ActionBtn onClick={onBack} icon={<Brush size={14} />} label="Back to original" />
          <ActionBtn
            onClick={wrap("regen", onRegenerate)}
            icon={busy === "regen" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            label="Regenerate"
          />
          <ActionBtn
            onClick={wrap("dl", async () => {
              const blob = await apiClient.fetchImageJobBlob(job.job_id, "result", job.finished_at ?? undefined);
              downloadBlob(blob, `sphere-edit-${job.job_id.slice(0, 8)}.png`);
            })}
            icon={busy === "dl" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            label="Download"
          />
          <ActionBtn
            onClick={wrap("nas", onSaveToNas)}
            icon={
              busy === "nas" ? <Loader2 size={14} className="animate-spin" /> : job.nas_file_id ? <Check size={14} /> : <HardDriveUpload size={14} />
            }
            label={job.nas_file_id ? "Saved to NAS" : "Save to NAS"}
            disabled={!!job.nas_file_id}
          />
        </>
      ) : (
        <>
          <ActionBtn onClick={onRetry} icon={<Brush size={14} />} label="Back to editing" />
          <ActionBtn
            onClick={wrap("regen", onRegenerate)}
            icon={busy === "regen" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            label="Try again"
          />
        </>
      )}
    </div>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/70 bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-default"
    >
      {icon}
      {label}
    </button>
  );
}

function HistoryThumb({
  job,
  index,
  active,
  onClick,
}: {
  job: ImageJob | undefined;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const done = job?.status === "completed";
  const { url } = useJobImage(job?.job_id, "thumb", done, job?.finished_at ?? null);
  const failed = job && (job.status === "failed" || job.status === "cancelled");
  return (
    <button
      onClick={onClick}
      title={job ? `${index}. ${OPERATION_LABELS[job.operation] ?? "Edit"}${job.instruction ? ` — ${job.instruction}` : ""}` : `Edit ${index}`}
      className={`relative h-12 w-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
        active ? "border-[#7C4DFF] scale-105" : "border-transparent hover:border-white/25"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`h-full w-full flex items-center justify-center ${failed ? "bg-red-500/10" : "img-edit-skeleton"}`}>
          {failed ? <AlertCircle size={14} className="text-red-400/70" /> : <Loader2 size={14} className="animate-spin text-white/40" />}
        </span>
      )}
      <span className="absolute bottom-0 right-0 px-1 text-[9px] font-mono bg-black/70 text-white/70 rounded-tl">{index}</span>
    </button>
  );
}
