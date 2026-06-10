// ============================================================================
// Sphere AI — TypeScript Type Definitions
// Mirrors the Flutter models (chat_models.dart, account.dart) and
// server types (core/types.py, api/schemas/responses.py)
// ============================================================================

// ── Auth ────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
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
  created_at: string;
  steps: string[];
  thinking_duration_sec: number;
  image_urls: string[];
  attachments: string[];
  nas_files: NasFileResult[];
  parts: MessagePart[]; // Multimodal content parts
  stream_started_at?: string;
  name?: string;
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
  | "truncation_warning"; // Input was truncated (Google/OpenAI typed event)

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

// ── GPU Status ──────────────────────────────────────────────────────────

export interface GpuStatus {
  gpu_loaded: boolean;
  vram_used_mb?: number;
  vram_total_mb?: number;
  active_users: number;
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
