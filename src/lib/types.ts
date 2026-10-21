// ============================================================================
// Sphere AI — TypeScript Type Definitions
// Mirrors the Flutter models (chat_models.dart, account.dart) and
// server types (core/types.py, api/schemas/responses.py)
// ============================================================================

// ── Auth ────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

// ── User ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  preferred_model?: string;
}

export interface Account {
  id: string; // "username@serverUrl"
  username: string;
  email: string;
  serverUrl: string;
  token: string;
  refreshToken?: string;
}

// ── Chat / Conversations ────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title?: string;
  description?: string;
  created_at: string;
  is_pinned?: boolean;
  is_temporary?: boolean;
  message_count?: number;
  last_message_preview?: string;
  /** Structured session metadata for client-side classification */
  metadata?: {
    context_type?: "nas_inplace" | "reminder" | "regular";
    source_file?: {
      file_id: string;
      filename: string;
      file_type: string;
    };
  };
}

export type MessageRole = "user" | "assistant" | "thinking" | "tool_use" | "tool_result" | "system";

/** Industry-standard multimodal content part (OpenAI/Gemini pattern). */
export interface MessagePart {
  type: string; // "text" | "image" | "document" | "audio" | "file"
  content?: string; // For text parts
  file_url?: string; // Server-accessible URL for file parts
  filename?: string; // Original filename
  mime_type?: string; // MIME type
}

export interface Message {
  role: MessageRole;
  content: string;
  thinking_content: string; // Pre-parsed thinking text (structured, not <think> tags)
  created_at: string;
  steps: string[];
  thinking_duration_sec: number;
  image_urls: string[];
  attachments: string[];
  nas_files: NasFileResult[];
  parts: MessagePart[]; // Multimodal content parts
  stream_started_at?: string;
  name?: string;
  /** Protocol v2: web activity items (search / page read / browser task) in order */
  items?: RunItem[];
  /** Protocol v2: sources registered during the run (citation ids are 1-based) */
  sources?: Source[];
  /** Protocol v2: server-validated citations for this answer */
  annotations?: Annotation[];
  /** AI image edits produced during this turn (edit_image tool) */
  image_job_ids?: string[];
}

// ── AI Image Editing ────────────────────────────────────────────────────────
// Mirrors server core/image_jobs.py job snapshot (GET /image-edits/{id}).

export type ImageJobStatus = "queued" | "preparing" | "running" | "completed" | "failed" | "cancelled";
export type ImageEditOperation = "auto" | "edit" | "remove_background" | "upscale" | "erase" | "restyle";
export type ImageEditMode = "fast" | "standard" | "max";

export interface ImageJob {
  job_id: string;
  status: ImageJobStatus;
  stage: string;
  progress: number; // 0..1
  eta_seconds: number;
  step?: number;
  total_steps?: number;
  operation: ImageEditOperation | string;
  mode: ImageEditMode | string;
  instruction: string;
  error?: string | null;
  width?: number | null;
  height?: number | null;
  input_width?: number | null;
  input_height?: number | null;
  model?: string | null;
  seed?: number | null;
  session_id?: string | null;
  parent_job_id?: string | null;
  has_mask?: boolean;
  nas_file_id?: string | null;
  created_at?: number | null;
  finished_at?: number | null;
  duration_seconds?: number | null;
  queue_position?: number | null;
  input_url?: string | null;
  result_url?: string | null;
  thumb_url?: string | null;
}

export const IMAGE_JOB_TERMINAL: ReadonlySet<string> = new Set(["completed", "failed", "cancelled"]);

export interface ImageEditRequest {
  /** Raw image bytes (new uploads, NAS files, chat images) */
  image?: Blob | null;
  /** Continue from a previous result without re-uploading */
  parentJobId?: string | null;
  /** PNG — white = edit, black = keep */
  mask?: Blob | null;
  instruction?: string;
  operation?: ImageEditOperation;
  mode?: ImageEditMode;
  sessionId?: string | null;
  seed?: number | null;
  upscaleFactor?: 2 | 4;
}

// ── Protocol v2: typed run items, sources, citations ────────────────────────
// Mirrors server core/items.py. Every item.* event carries the full snapshot.

export type RunItemKind = "web_search" | "page_read" | "browser_task";
export type RunItemStatus = "queued" | "in_progress" | "completed" | "failed" | "cancelled";
export type RunErrorCode =
  | "TIMEOUT" | "BLOCKED_BY_SITE" | "POLICY_DENIED" | "NEEDS_LOGIN" | "SANDBOX_UNAVAILABLE"
  | "NOT_CONFIGURED" | "PROVIDER_UNAVAILABLE" | "FETCH_FAILED" | "STEP_LIMIT" | "CANCELLED"
  | "INVALID_ARGS" | "INTERNAL";

export interface Source {
  id: number;
  url: string;
  title: string;
  snippet?: string;
  domain?: string;
  favicon?: string;
  item_id?: string | null;
}

export interface BrowserAction {
  type: string;
  label: string;
  element_index?: number | null;
}

export interface RunItemData {
  // browser_task
  phase?: "queued" | "launching" | "navigating" | "acting" | "waiting_for_user" | "blocked_retrying";
  step?: number;
  max_steps?: number;
  url?: string;
  title?: string;
  goal?: string;
  actions?: BrowserAction[];
  snapshot_id?: string | null;
  final_snapshot_id?: string | null;
  final_url?: string;
  queue_position?: number | null;
  live?: boolean;
  sandboxed?: boolean;
  provider?: string;
  steps_taken?: number;
  success?: boolean;
  visited?: { url: string; title?: string }[];
  [key: string]: unknown;
}

export interface RunItem {
  id: string;
  run_id?: string;
  kind: RunItemKind;
  status: RunItemStatus;
  call_id?: string;
  tool?: string;
  args: Record<string, unknown>;
  data: RunItemData;
  sources: Source[];
  error_code?: RunErrorCode | string | null;
  error?: string | null;
  result_summary?: string | null;
  started_at?: number;
  ended_at?: number | null;
}

export interface Annotation {
  type: "url_citation" | "unverified_link";
  source_id?: number;
  url: string;
  title?: string;
  start: number;
  end: number;
}

export interface NasFileResult {
  name: string;
  path: string;
  type: string;
  size?: number;
  thumbnail_url?: string;
}

// ── Stream Events (from server WebSocket/SSE) ───────────────────────────

export type StreamEventType =
  | "thinking"
  | "token"
  | "tool_call"
  | "tool_result"
  | "image"
  | "nas_files"
  | "error"
  | "done"
  | "status"
  | "activity"
  | "session"          // Session ID assignment
  | "title"            // Auto-generated title
  | "iteration_summary"
  | "plan_update"
  | "resume_status"    // Registry resume/replay indicator
  | "truncation_warning" // Input was truncated (Google/OpenAI typed event)
  // Protocol v2
  | "item.created"
  | "item.updated"
  | "item.completed"
  | "item.failed"
  | "item.cancelled"
  | "message.annotations"
  | "approval.requested"
  | "takeover.requested"
  | "takeover.ended"
  // AI image editing
  | "gpu_wait"         // chat is queued behind an image edit (content = banner text)
  | "image_job";       // edit_image tool created/updated a job (data = ImageJob)

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  error?: string;
  image_urls?: string[];
  nas_files?: NasFileResult[];
  session_id?: string;
  title?: string;
  is_truncated?: boolean;
  timestamp?: string;
  // Protocol v2 envelope
  v?: number;
  seq?: number;
  run_id?: string;
  item?: RunItem;
  data?: { annotations?: Annotation[]; sources?: Source[] } & Record<string, unknown>;
}

// ── Sessions ────────────────────────────────────────────────────────────

export interface Session {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string;
}

// ── Agent Metadata ──────────────────────────────────────────────────────

export interface AgentMetadata {
  name: string;
  description: string;
}

// ── Notifications ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface NotificationList {
  notifications: Notification[];
  unread_count: number;
  total: number;
}

// ── Heartbeats / Reminders ──────────────────────────────────────────────

export interface Heartbeat {
  id: string;
  name: string;
  prompt: string;
  type: string;             // "cron" | "heartbeat"
  schedule?: string;        // cron expression (server field name)
  interval?: number;        // interval in seconds for heartbeat type
  enabled: boolean;         // server field name (not is_active)
  recurring?: boolean;
  run_count: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  last_run?: string;
}

// Server: GET /heartbeats/{id}/results — `result` is truncated to 500 chars.
export interface HeartbeatResult {
  id: string;
  result: string | null;
  error: string | null;
  session_id: string | null;
  duration_ms: number | null;
  created_at: string | null;
}

// ── GPU Status ──────────────────────────────────────────────────────────
// Server: GET /gpu/status (GpuStatusResponse)

export type GpuState =
  | "ai_ready"
  | "nas_processing"
  | "swapping_to_ai"
  | "draining_for_image"
  | "swapping_to_image"
  | "image_ready"
  | "unknown";

export interface GpuStatus {
  llama_loaded: boolean;
  nas_processing: boolean;
  active_sessions: number;
  gpu_state: GpuState | string;
  // AI image editing (absent on older servers)
  orchestrator_state?: string | null;
  image_edit_enabled?: boolean;
  /** GPU is owned by image editing — chat replies wait */
  image_busy?: boolean;
  image_queue_length?: number;
  image_running_job?: string | null;
  llm_waiters?: number;
  /** Seconds until chat is available again */
  eta_seconds?: number | null;
  /** Human-readable banner text */
  message?: string | null;
}

// ── Tools ───────────────────────────────────────────────────────────────
// Server: GET /tools/ → { tools: ToolInfo[], total }

export interface ToolInfo {
  name: string;
  description: string;
  // OpenAI-compatible function schema (tools/base_tool.py → to_function_schema)
  schema?: {
    type?: "function";
    function?: {
      name?: string;
      description?: string;
      parameters?: {
        type?: string;
        properties?: Record<string, { type?: string; description?: string; enum?: unknown[] }>;
        required?: string[];
      };
    };
  };
}

// ── Skills ──────────────────────────────────────────────────────────────
// Server: /skills/* — identity comes from the auth token.

/** Built-in filesystem skill (read-only). GET /skills/ → central_skills[] */
export interface CentralSkill {
  name: string;
  description: string;
  category: string;
  active: boolean;
  source: "central";
}

/** Per-user DB skill. GET /skills/user (content truncated) or /skills/user/{id} (full). */
export interface UserSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  triggers: string[] | null;
  example_queries: string[] | null;
  tools_used: string[] | null;
  auto_load: boolean;
  enabled: boolean;
  source: string;            // "manual" | "template" | "api"
  template_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

/** Fields accepted by POST /skills/user and PUT /skills/user/{id}. */
export interface UserSkillInput {
  name?: string;
  description?: string;
  content?: string;
  triggers?: string[];
  example_queries?: string[];
  tools_used?: string[];
  auto_load?: boolean;
  enabled?: boolean;
}

// ── Upload ──────────────────────────────────────────────────────────────

export interface UploadResult {
  id: string;
  filename: string;
  media_type: string;
  stored_path?: string;
  file_url?: string;
  text_preview?: string;
  extracted_text?: string;
  file_size_bytes?: number;
  metadata?: Record<string, unknown>;
  image_urls?: string[];
  image_id?: string;
}

// ── Calendar ────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string | null;
  category: string;
  all_day: boolean;
  recurring: boolean;
  location: string;
  source: string;
}
