// ============================================================================
// Live browser frame source — ONE WebSocket for the whole app.
//
// The inline card and the full-screen overlay both subscribe to the same
// source, so expanding never opens a second socket. Frames are decoded to
// ImageBitmaps and pushed to subscribers imperatively (canvas refs) — they
// never touch React or Zustand state, so 5–15 fps streaming causes zero
// re-renders.
//
// Lifecycle: ref-counted per item. Subscribing to a different item closes the
// previous socket (only one live view at a time). Unexpected closes reconnect
// with a fresh single-use ticket (bounded backoff). A server "ended" message
// or a 4001/4004 close is terminal.
// ============================================================================

import { apiClient } from "@/lib/api-client";

export type LiveStatus = "connecting" | "live" | "reconnecting" | "ended" | "error";

export interface LiveMeta {
  url?: string;
  title?: string;
  step?: number;
}

export interface FrameListener {
  onFrame?: (bitmap: ImageBitmap) => void;
  onStatus?: (status: LiveStatus) => void;
  onMeta?: (meta: LiveMeta) => void;
  onEnded?: (snapshotId: string | null) => void;
  onAgentView?: (content: string) => void;
}

const MAX_RETRIES = 5;

class FrameSource {
  readonly itemId: string;
  private ws: WebSocket | null = null;
  private listeners = new Set<FrameListener>();
  private lastFrame: ImageBitmap | null = null;
  private status: LiveStatus = "connecting";
  private meta: LiveMeta = {};
  private retries = 0;
  private closed = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private decoding = false;
  private pendingBlob: Blob | null = null;

  constructor(itemId: string) {
    this.itemId = itemId;
    void this.connect();
  }

  get size(): number {
    return this.listeners.size;
  }

  add(l: FrameListener): void {
    this.listeners.add(l);
    l.onStatus?.(this.status);
    if (this.meta.url || this.meta.title) l.onMeta?.(this.meta);
    if (this.lastFrame) l.onFrame?.(this.lastFrame);
  }

  remove(l: FrameListener): void {
    this.listeners.delete(l);
  }

  send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    try {
      this.ws?.close(1000);
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.lastFrame?.close();
    this.lastFrame = null;
    this.listeners.clear();
  }

  private setStatus(s: LiveStatus): void {
    this.status = s;
    this.listeners.forEach((l) => l.onStatus?.(s));
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    this.setStatus(this.retries === 0 ? "connecting" : "reconnecting");
    let url: string | null = null;
    try {
      const { ticket } = await apiClient.createBrowserTicket(this.itemId, "view");
      url = apiClient.browserLiveUrl(this.itemId, ticket);
    } catch {
      url = null;
    }
    if (this.closed) return;
    if (!url) return this.scheduleRetry();

    const ws = new WebSocket(url);
    ws.binaryType = "blob";
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.setStatus("live");
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), 25_000);
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        this.handleJson(ev.data);
      } else if (ev.data instanceof Blob) {
        this.handleFrame(ev.data);
      }
    };

    ws.onclose = (ev) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.ws === ws) this.ws = null;
      if (this.closed || this.status === "ended") return;
      // 4001 = bad/expired ticket (retry once with a fresh one),
      // 4004 = no live browser (task finished) → terminal.
      if (ev.code === 4004) {
        this.setStatus("ended");
        this.listeners.forEach((l) => l.onEnded?.(null));
        return;
      }
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    if (this.closed) return;
    if (this.retries >= MAX_RETRIES) {
      this.setStatus("error");
      return;
    }
    this.retries += 1;
    this.setStatus("reconnecting");
    const delay = Math.min(8000, 500 * 2 ** (this.retries - 1));
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  private handleJson(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg.type) {
      case "hello":
      case "page": {
        this.meta = {
          url: (msg.url as string) ?? this.meta.url,
          title: (msg.title as string) ?? this.meta.title,
          step: (msg.step as number) ?? this.meta.step,
        };
        const m = this.meta;
        this.listeners.forEach((l) => l.onMeta?.(m));
        break;
      }
      case "agent_view": {
        const content = (msg.content as string) ?? "";
        this.listeners.forEach((l) => l.onAgentView?.(content));
        break;
      }
      case "ended": {
        const snap = (msg.snapshot_id as string) ?? null;
        this.setStatus("ended");
        this.listeners.forEach((l) => l.onEnded?.(snap));
        break;
      }
    }
  }

  /** Decode at most one frame at a time; drop intermediate frames if busy. */
  private handleFrame(blob: Blob): void {
    if (this.decoding) {
      this.pendingBlob = blob;
      return;
    }
    this.decoding = true;
    createImageBitmap(blob)
      .then((bmp) => {
        if (this.closed) {
          bmp.close();
          return;
        }
        const prev = this.lastFrame;
        this.lastFrame = bmp;
        this.listeners.forEach((l) => l.onFrame?.(bmp));
        prev?.close();
      })
      .catch(() => {
        /* corrupt frame — skip */
      })
      .finally(() => {
        this.decoding = false;
        const next = this.pendingBlob;
        this.pendingBlob = null;
        if (next) this.handleFrame(next);
      });
  }
}

// ── Singleton registry (one live socket at a time) ──────────────────────

let active: FrameSource | null = null;

/** Subscribe to the live view of a browser item. Returns an unsubscribe fn. */
export function subscribeLive(itemId: string, listener: FrameListener): () => void {
  if (!active || active.itemId !== itemId) {
    active?.close();
    active = new FrameSource(itemId);
  }
  const src = active;
  src.add(listener);
  return () => {
    src.remove(listener);
    // Defer teardown a tick so card→overlay handoff doesn't drop the socket.
    setTimeout(() => {
      if (src.size === 0 && active === src) {
        src.close();
        active = null;
      }
    }, 250);
  };
}

export function sendLive(itemId: string, msg: Record<string, unknown>): void {
  if (active?.itemId === itemId) active.send(msg);
}

/** Draw a bitmap letterboxed into a canvas, sized for the device pixel ratio. */
export function drawLetterboxed(canvas: HTMLCanvasElement, bmp: ImageBitmap): void {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    const scale = Math.min(w / bmp.width, h / bmp.height);
    if (!Number.isFinite(scale) || scale <= 0) return;
    const dw = bmp.width * scale;
    const dh = bmp.height * scale;
    ctx.fillStyle = "#07090d";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } catch {
    /* bitmap was already released — the next frame will repaint */
  }
}
