// ============================================================================
// Sphere AI — Chat Store (Zustand)
// Port of chat_provider.dart (832 lines → TypeScript)
// Manages messages, streaming, conversation state, and structured response parsing
// ============================================================================

import { create } from "zustand";
import type { Message, MessagePart, Conversation, NasFileResult } from "@/lib/types";
import { apiClient, ApiClientError } from "@/lib/api-client";

interface ChatState {
  // Current conversation
  conversationId: string | null;
  currentTitle: string | null;
  messages: Message[];
  isTemporaryMode: boolean;
  description: string | null;

  // Streaming state
  isLoading: boolean;
  isResuming: boolean;        // True when replaying buffered events from registry
  currentActivity: string | null;
  iterationSummaries: string[];
  errorMessage: string | null;
  truncationWarning: string | null;  // Shown when input was truncated (Google/OpenAI typed event)

  // Upload progress (null when not uploading)
  uploadProgress: { current: number; total: number; filename: string } | null;

  // Conversation list
  conversations: Conversation[];
  isLoadingHistory: boolean;

  // Abort controller for stopping generation
  abortController: AbortController | null;

  // ── Actions ─────────────────────────────────────────────────────────
  sendMessage: (
    message: string,
    options?: {
      agent?: string;
      model?: string;
      images?: string[];
      attachments?: File[];
      /** Already-uploaded file refs for retry (skip re-upload). Google pattern. */
      fileParts?: Array<{ file_url: string; filename: string; media_type: string; mime_type?: string }>;
    }
  ) => Promise<void>;
  stopGeneration: () => void;
  cancelRun: () => Promise<void>;   // Cancel via registry + abort controller
  /**
   * Called on browser pagehide/beforeunload.
   * Releases the local SSE connection so the browser can close cleanly,
   * but does NOT send a cancel to the server — the run keeps going.
   * On the next page open, loadConversation auto-resumes (Gemini pattern).
   */
  handlePageHide: () => void;
  loadConversation: (conversationId: string) => Promise<void>;
  newChat: (temporary?: boolean, description?: string) => void;
  deleteConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  togglePin: (conversationId: string, isPinned: boolean) => void;
  loadConversations: () => Promise<void>;
  clearError: () => void;
  clearTruncationWarning: () => void;
  retryMessage: (assistantMessageIndex: number) => void;
}

// ── State-Machine Structured Response Parser ──────────────────────
// Port of _parseStructuredResponse() from chat_provider.dart
// A robust tag-aware parser that correctly handles unclosed XML tags
// during streaming. Prevents <reasoning> content from flickering in the
// visible response area. Industry pattern: Claude/ChatGPT/Gemini all
// use structured tag parsing for reasoning/response separation.
function parseStructuredContent(raw: string): string {
  // Valid tags that switch parser state
  const tags = [
    "<reasoning>", "</reasoning>",
    "<think>", "</think>",
    "<thought>", "</thought>",
    "<tool_call>", "</tool_call>",
    "<response>", "</response>",
  ];

  let visible = "";
  let reasoning = "";
  let currentTag = "none";
  let pos = 0;

  while (pos < raw.length) {
    // Find the next complete tag
    let nextTagPos = -1;
    let nextTag = "";
    for (const t of tags) {
      const idx = raw.indexOf(t, pos);
      if (idx !== -1 && (nextTagPos === -1 || idx < nextTagPos)) {
        nextTagPos = idx;
        nextTag = t;
      }
    }

    if (nextTagPos === -1) {
      // No more completed tags found — append the rest
      const chunk = raw.substring(pos);
      if (
        currentTag === "<reasoning>" ||
        currentTag === "<think>" ||
        currentTag === "<thought>" ||
        currentTag === "<tool_call>"
      ) {
        reasoning += chunk;
      } else {
        // Visible text. Prevent partial tags at the end of the stream
        // (like "<reaso") from flickering before they close.
        let finalChunk = chunk;
        const partialTagMatch = finalChunk.match(/<\/?[a-zA-Z_]*$/);
        if (partialTagMatch) {
          finalChunk = finalChunk.substring(0, partialTagMatch.index!);
        }
        visible += finalChunk;
      }
      break;
    }

    // Process text before the tag
    const chunk = raw.substring(pos, nextTagPos);
    if (
      currentTag === "<reasoning>" ||
      currentTag === "<think>" ||
      currentTag === "<thought>" ||
      currentTag === "<tool_call>"
    ) {
      reasoning += chunk;
    } else if (currentTag === "none" || currentTag === "<response>") {
      visible += chunk;
    }

    // State transition
    if (nextTag.startsWith("</")) {
      currentTag = "none";
    } else {
      currentTag = nextTag;
    }

    pos = nextTagPos + nextTag.length;
  }

  // Strip markdown section headers injected by the agent engine
  visible = visible.replace(/## USER QUERY:\s*/gm, "").trim();
  visible = visible.replace(/^## FINAL ANSWER:?\s*/gm, "").trim();
  visible = visible.replace(/^## ASSISTANT:?\s*/gm, "").trim();

  // Reconstruct: put reasoning into <think> tags for ThinkingBlock
  let result = visible.trim();
  if (reasoning.trim()) {
    result = `<think>\n${reasoning.trim()}\n</think>\n${result}`;
  }

  return result.trim();
}

// Strip incomplete image markdown that arrives during streaming
function stripIncompleteImageMarkdown(text: string): string {
  // Remove incomplete ![... patterns at the end during streaming
  return text.replace(/!\[[^\]]*$/, "").replace(/!\[[^\]]*\]\([^)]*$/, "");
}

/**
 * Infer media_type from a browser File object for optimistic rendering.
 * Maps to the same types the server uses: "image", "document", "audio", "video", "text".
 */
function mediaTypeFromFile(file: File): string {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";

  // Extension-based fallback
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() || ""
    : "";

  const docExts = ["pdf", "doc", "docx", "xlsx", "xls", "csv", "ppt", "pptx"];
  if (docExts.includes(ext)) return "document";

  const codeExts = ["py", "js", "ts", "tsx", "jsx", "dart", "java", "c", "cpp", "h", "rs", "go", "rb", "swift", "kt"];
  const textExts = ["txt", "md", "json", "xml", "yaml", "yml", "html", "css", "log", "ini", "toml"];
  if (codeExts.includes(ext) || textExts.includes(ext)) return "text";

  if (mime.startsWith("text/")) return "text";
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("spreadsheet")) return "document";

  return "document"; // Safe fallback for unknown types
}

export const useChatStore = create<ChatState>()((set, get) => {
  // ── pagehide: browser close / tab navigate (Google / Claude pattern) ────────
  // Release the SSE connection so the browser can unload cleanly,
  // but do NOT cancel the server run. The agent keeps generating;
  // when the user reopens the tab, loadConversation() auto-resumes.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      const controller = get().abortController;
      if (controller) {
        controller.abort();
        // Intentionally NOT calling cancelAgentRun — server keeps running
        set({ abortController: null, isLoading: false, isResuming: false });
      }
    });

    // ── visibilitychange: auto-resume on tab/app return (Google/Claude/OpenAI pattern) ──
    // When user switches tabs or navigates to another chat and returns,
    // check if the server has completed or is still running, and act accordingly.
    // This is exactly what ChatGPT does: silently reload state on tab focus.
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible") return;
      const { conversationId, isLoading, abortController } = get();
      if (!conversationId || isLoading) return; // Already streaming or no conversation

      try {
        const runStatus = await apiClient.getRunStatus(conversationId);
        if (runStatus.has_active_run) {
          // Server is still generating — auto-resume the stream
          console.log(`[Chat] Tab visible: active run detected — auto-resuming`);
          get().loadConversation(conversationId);
        } else if (runStatus.status === "done" || runStatus.status === "error") {
          // Run completed while we were away — reload messages from DB
          console.log(`[Chat] Tab visible: run completed (${runStatus.status}) — reloading messages`);
          try {
            const data = await apiClient.getConversation(conversationId);
            const rawMessages: Message[] = data.messages.map((m) => ({
              ...m,
              role: normalizeRole(m.role || "assistant"),
              content: parseStructuredContent(m.content || ""),
              created_at: m.created_at || new Date().toISOString(),
              steps: m.steps || [],
              thinking_duration_sec: m.thinking_duration_sec || 0,
              image_urls: m.image_urls || [],
              attachments: m.attachments || [],
              nas_files: m.nas_files || [],
              parts: m.parts || [],
            }));
            set({
              messages: groupBlocksIntoTurns(rawMessages),
              errorMessage: null,
            });
          } catch {
            // Silent — keep current state
          }
        }
      } catch {
        // run-status check failed — non-critical
      }
    });
  }

  return {
  conversationId: null,
  currentTitle: null,
  messages: [],
  isTemporaryMode: false,
  description: null,
  isLoading: false,
  isResuming: false,
  currentActivity: null,
  iterationSummaries: [],
  errorMessage: null,
  truncationWarning: null,
  uploadProgress: null,
  conversations: [],
  isLoadingHistory: false,
  abortController: null,

  sendMessage: async (message, options) => {
    const { conversationId, isTemporaryMode, description, messages } = get();

    // ── Build optimistic MessageParts from local File objects ─────────
    // Industry pattern (ChatGPT/Gemini/Claude): show file chips IMMEDIATELY
    // using local file info (optimistic UI). Server-confirmed data replaces
    // these after upload finishes.
    const optimisticParts: MessagePart[] = [];

    if (options?.attachments && options.attachments.length > 0) {
      for (const file of options.attachments) {
        optimisticParts.push({
          type: mediaTypeFromFile(file),
          filename: file.name,
          file_url: undefined,  // Will be filled after upload
          mime_type: file.type || undefined,
        });
      }
    } else if (options?.fileParts && options.fileParts.length > 0) {
      // Retry path: already have server-confirmed parts
      for (const fp of options.fileParts) {
        optimisticParts.push({
          type: fp.media_type,
          filename: fp.filename,
          file_url: fp.file_url,
          mime_type: fp.mime_type,
        });
      }
    }

    // Add text part if message is not empty
    if (message.trim()) {
      optimisticParts.push({ type: "text", content: message });
    }

    // Add user message immediately with optimistic parts
    const userMessage: Message = {
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
      steps: [],
      thinking_duration_sec: 0,
      image_urls: [],
      attachments: [],
      nas_files: [],
      parts: optimisticParts.length > 0 ? optimisticParts : [],
    };

    // Create placeholder assistant message
    const assistantMessage: Message = {
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      steps: [],
      thinking_duration_sec: 0,
      image_urls: [],
      attachments: [],
      nas_files: [],
      parts: [],
      stream_started_at: new Date().toISOString(),
    };

    set({
      messages: [...messages, userMessage, assistantMessage],
      isLoading: true,
      currentActivity: null,
      iterationSummaries: [],
      errorMessage: null,
      truncationWarning: null,
    });

    const abortController = new AbortController();
    set({ abortController });

    // Upload attachments and build structured file parts (industry standard)
    // ── File parts: use pre-built refs (retry) or upload new files ──
    // Industry pattern (Google/OpenAI): retry references existing uploaded
    // files by their server URL instead of re-uploading. New messages upload
    // fresh files via the upload API.
    const fileParts: Array<{ file_url: string; filename: string; media_type: string; mime_type?: string }> = [];
    let documentContext = "";

    // Path 1: Pre-built file_parts from retry (already uploaded — no re-upload)
    if (options?.fileParts && options.fileParts.length > 0) {
      fileParts.push(...options.fileParts);
    }
    // Path 2: Fresh file uploads
    else if (options?.attachments && options.attachments.length > 0) {
      const totalFiles = options.attachments.length;
      set({ currentActivity: "Uploading files...", uploadProgress: { current: 0, total: totalFiles, filename: options.attachments[0].name } });
      for (let _fileIdx = 0; _fileIdx < options.attachments.length; _fileIdx++) {
        const file = options.attachments[_fileIdx];
        set({ uploadProgress: { current: _fileIdx + 1, total: totalFiles, filename: file.name } });
        try {
          const result = await apiClient.uploadFile(file);
          const fileUrl = result.file_url || result.stored_path || "";

          // Build structured file part
          if (fileUrl) {
            fileParts.push({
              file_url: fileUrl,
              filename: result.filename,
              media_type: result.media_type || "file",
              mime_type: (result.metadata?.content_type as string) || "",
            });
          }

          // For documents with extracted text, prepend as LLM context
          if (result.media_type !== "image" && result.extracted_text) {
            documentContext +=
              `--- File: ${result.filename} ---\n` +
              `${result.extracted_text.slice(0, 6000)}\n` +
              `--- End ---\n\n`;
          }
        } catch {
          // Continue even if one upload fails
        }
      }
      set({ currentActivity: null, uploadProgress: null });

      // ── Update user message with server-confirmed file parts ──────
      // Replace optimistic parts (no file_url) with real server data.
      // This ensures DB-restored messages have correct URLs.
      if (fileParts.length > 0) {
        const confirmedParts: MessagePart[] = [];
        for (const fp of fileParts) {
          confirmedParts.push({
            type: fp.media_type,
            filename: fp.filename,
            file_url: fp.file_url,
            mime_type: fp.mime_type,
          });
        }
        if (message.trim()) {
          confirmedParts.push({ type: "text", content: message });
        }

        const currentMessages = get().messages;
        // User message is at index (currentMessages.length - 2)
        // (assistant placeholder is last)
        const userMsgIdx = currentMessages.length - 2;
        if (userMsgIdx >= 0 && currentMessages[userMsgIdx].role === "user") {
          const updatedUser = { ...currentMessages[userMsgIdx], parts: confirmedParts };
          set({
            messages: [
              ...currentMessages.slice(0, userMsgIdx),
              updatedUser,
              ...currentMessages.slice(userMsgIdx + 1),
            ],
          });
        }
      }
    }

    // Build clean message — no text markers
    const finalMessage = documentContext ? documentContext + message : message;


    let accumulatedContent = "";
    const accumulatedSteps: string[] = [];
    let accumulatedImageUrls: string[] = [];
    let accumulatedNasFiles: NasFileResult[] = [];
    let sessionId = conversationId;
    let title = get().currentTitle;

    const MAX_RETRIES = 5;
    let retryCount = 0;
    let hasReceivedData = false;

    /**
     * Check if an error is a network-level failure that warrants a retry.
     * Returns false for HTTP errors, user abort, and API errors.
     */
    const isRetryableNetworkError = (err: unknown): boolean => {
      // User abort — never retry
      if (err instanceof Error && err.name === "AbortError") return false;
      // HTTP error from our API client (401, 429, 503, etc.) — don't retry
      if (err instanceof ApiClientError) return false;
      // TypeError is what fetch throws on network failure (connection lost)
      if (err instanceof TypeError) return true;
      // Other network-related errors
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return msg.includes("network") ||
               msg.includes("fetch") ||
               msg.includes("connection") ||
               msg.includes("aborted");
      }
      return false;
    };

    try {
    while (retryCount <= MAX_RETRIES) {
      try {
        const stream = apiClient.streamMessage(finalMessage, sessionId || undefined, {
          agent: options?.agent,
          model: options?.model,
          images: options?.images,
          file_parts: fileParts.length > 0 ? fileParts : undefined,
          isTemporary: isTemporaryMode,
          description: description || undefined,
          signal: abortController.signal,
        });

        for await (const event of stream) {
          if (abortController.signal.aborted) break;
          hasReceivedData = true;

          switch (event.type) {
            case "token":
              accumulatedContent += event.content || "";
              break;

            case "thinking":
              accumulatedContent += event.content || "";
              break;

            case "session":
              sessionId = event.session_id || sessionId;
              set({ conversationId: sessionId });
              break;

            case "title":
              title = event.title || title;
              set({ currentTitle: title });
              break;

            case "status":
              // Detect resume/replay status events from the run registry
              {
                const statusContent = event.content || "";
                if (
                  statusContent.includes("Resuming") ||
                  statusContent.includes("Caught up") ||
                  statusContent.includes("Replaying") ||
                  statusContent.includes("Catching up")
                ) {
                  // Server is replaying buffered events from a previous connection
                  // Reset accumulators so the snapshot builds cleanly
                  accumulatedContent = "";
                  accumulatedSteps.length = 0;
                  accumulatedImageUrls = [];
                  accumulatedNasFiles = [];
                  set({ isResuming: true, currentActivity: statusContent });
                }
              }
              break;

            case "activity":
              set({ currentActivity: event.content || null });
              break;

            case "iteration_summary":
              set({
                iterationSummaries: [
                  ...get().iterationSummaries,
                  event.content || "",
                ],
              });
              break;

            case "tool_call":
              accumulatedSteps.push(
                `🔧 ${event.tool || "Tool"}`
              );
              break;

            case "tool_result":
              const hasError =
                (event.content || "").includes("❌") ||
                (event.content || "").includes("failed");
              accumulatedSteps.push(
                hasError ? "⚠️ Tool error" : "✅ Tool completed"
              );
              break;

            case "image":
              if (event.image_urls) {
                accumulatedImageUrls = [
                  ...accumulatedImageUrls,
                  ...event.image_urls,
                ];
              }
              break;

            case "nas_files":
              if (event.nas_files) {
                accumulatedNasFiles = [
                  ...accumulatedNasFiles,
                  ...event.nas_files,
                ];
              }
              break;

            case "error":
              set({ errorMessage: event.error || "An error occurred" });
              break;

            case "truncation_warning":
              set({ truncationWarning: event.content || null });
              break;

            case "done":
              // Stream complete
              break;
          }

          // Update the assistant message in place
          const currentMessages = get().messages;
          const parsed = parseStructuredContent(accumulatedContent);
          const displayContent = get().isLoading
            ? stripIncompleteImageMarkdown(parsed)
            : parsed;

          const updatedAssistant: Message = {
            ...currentMessages[currentMessages.length - 1],
            content: displayContent,
            steps: [...accumulatedSteps],
            image_urls: [...accumulatedImageUrls],
            nas_files: [...accumulatedNasFiles],
          };

          set({
            messages: [
              ...currentMessages.slice(0, -1),
              updatedAssistant,
            ],
          });
        }
        break; // Stream completed successfully — exit retry loop

      } catch (err) {
        // Only retry if: we received data + error is network-level + user didn't abort
        const shouldRetry = hasReceivedData &&
          isRetryableNetworkError(err) &&
          !abortController.signal.aborted &&
          retryCount < MAX_RETRIES;

        if (!shouldRetry) {
          // Non-retryable or retries exhausted — let existing error handling deal with it
          if ((err as Error).name !== "AbortError") {
            // Detect concurrency limit errors
            if (err instanceof ApiClientError) {
              if (err.status === 429) {
                set({
                  errorMessage: "Too many active requests. Please wait for a previous response to finish.",
                });
              } else if (err.status === 503) {
                set({
                  errorMessage: "Server is at capacity. Please try again shortly.",
                });
              } else {
                set({ errorMessage: err.message });
              }
            } else {
              set({
                errorMessage:
                  err instanceof Error ? err.message : "Stream failed",
              });
            }
          }
          break; // Exit retry loop
        }

        // Silent retry with exponential backoff
        retryCount++;
        const delaySec = Math.pow(2, retryCount - 1); // 1, 2, 4, 8, 16
        set({ currentActivity: `🔄 Reconnecting... (attempt ${retryCount}/${MAX_RETRIES})` });
        await new Promise(r => setTimeout(r, delaySec * 1000));
      }
    } // end while
    } finally {
      // Finalize: clean the content and compute thinking duration
      const finalMessages = get().messages;
      const lastMsg = finalMessages[finalMessages.length - 1];
      const streamStarted = lastMsg?.stream_started_at
        ? new Date(lastMsg.stream_started_at)
        : null;
      const thinkingDuration = streamStarted
        ? Math.round((Date.now() - streamStarted.getTime()) / 1000)
        : 0;

      const finalContent = parseStructuredContent(accumulatedContent);
      const hasThinking =
        finalContent.includes("<think>") && finalContent.includes("</think>");

      set({
        messages: [
          ...finalMessages.slice(0, -1),
          {
            ...lastMsg,
            content: finalContent,
            steps: [...accumulatedSteps],
            image_urls: [...accumulatedImageUrls],
            nas_files: [...accumulatedNasFiles],
            thinking_duration_sec: hasThinking ? thinkingDuration : 0,
          },
        ],
        isLoading: false,
        isResuming: false,
        currentActivity: null,
        uploadProgress: null,
        abortController: null,
      });

      // Refresh conversation list
      get().loadConversations();
    }
  },

  stopGeneration: () => {
    const { abortController, conversationId } = get();
    if (abortController) {
      abortController.abort();
      // User explicitly pressed Stop — cancel the server run
      if (conversationId) {
        apiClient.cancelAgentRun(conversationId).catch(() => {});
      }
      set({ isLoading: false, isResuming: false, abortController: null });
    }
  },

  handlePageHide: () => {
    // Browser is closing / navigating away.
    // Abort the local fetch connection so the browser unloads cleanly.
    // Do NOT call cancelAgentRun — the server run continues and the user
    // will auto-resume on next open (Gemini / Claude pattern).
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isLoading: false, isResuming: false });
    }
  },

  cancelRun: async () => {
    const { conversationId, abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    if (conversationId) {
      try {
        await apiClient.cancelAgentRun(conversationId);
      } catch {
        // Non-critical
      }
    }
    set({ isLoading: false, isResuming: false, abortController: null });
  },

  loadConversation: async (conversationId) => {
    // Use isLoadingHistory (not isLoading) to avoid triggering streaming UI
    // on the last assistant message. isLoading is only set when actually
    // resuming an active run. This matches the Flutter pattern and prevents
    // the 3-second "thinking" flash on conversation reload.
    set({ isLoadingHistory: true, errorMessage: null });
    try {
      const data = await apiClient.getConversation(conversationId);
      // Normalize server roles to UI roles and group blocks into turns
      const rawMessages: Message[] = data.messages.map((m) => ({
        ...m,
        role: normalizeRole(m.role || "assistant"),
        content: parseStructuredContent(m.content || ""),
        created_at: m.created_at || new Date().toISOString(),
        steps: m.steps || [],
        thinking_duration_sec: m.thinking_duration_sec || 0,
        image_urls: m.image_urls || [],
        attachments: m.attachments || [],
        nas_files: m.nas_files || [],
        parts: m.parts || [],
      }));

      set({
        conversationId,
        currentTitle: data.title,
        messages: groupBlocksIntoTurns(rawMessages),
        isLoading: false,
        isLoadingHistory: false,
        isTemporaryMode: false,
      });

      // ── Gemini-style auto-resume ─────────────────────────────────
      // Check if the server has an active generation for this session.
      // If yes, auto-reattach to the live SSE stream.
      try {
        const runStatus = await apiClient.getRunStatus(conversationId);
        if (runStatus.has_active_run) {
          console.log(`[Chat] Active run detected for session ${conversationId} — auto-resuming`);
          // Start resume: add placeholder and stream from server
          const currentMessages = get().messages;
          const assistantPlaceholder: Message = {
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            steps: [],
            thinking_duration_sec: 0,
            image_urls: [],
            attachments: [],
            nas_files: [],
            parts: [],
            stream_started_at: new Date().toISOString(),
          };

          const abortController = new AbortController();
          set({
            messages: [...currentMessages, assistantPlaceholder],
            isLoading: true,
            isResuming: true,
            currentActivity: "💭 Resuming generation...",
            iterationSummaries: [],
            abortController,
          });

          let accumulatedContent = "";
          const accumulatedSteps: string[] = [];
          let accumulatedImageUrls: string[] = [];
          let accumulatedNasFiles: NasFileResult[] = [];

          try {
            const stream = apiClient.streamMessage("", conversationId, {
              signal: abortController.signal,
            });

            for await (const event of stream) {
              if (abortController.signal.aborted) break;

              switch (event.type) {
                case "token":
                  accumulatedContent += event.content || "";
                  break;
                case "activity":
                  set({ currentActivity: event.content || null });
                  break;
                case "status": {
                  const statusContent = event.content || "";
                  if (
                    statusContent.includes("Resuming") ||
                    statusContent.includes("Caught up") ||
                    statusContent.includes("Replaying")
                  ) {
                    accumulatedContent = "";
                    accumulatedSteps.length = 0;
                    accumulatedImageUrls = [];
                    accumulatedNasFiles = [];
                    set({ isResuming: true, currentActivity: statusContent });
                  }
                  break;
                }
                case "iteration_summary":
                  set({
                    iterationSummaries: [
                      ...get().iterationSummaries,
                      event.content || "",
                    ],
                  });
                  break;
                case "tool_call":
                  accumulatedSteps.push(`🔧 ${event.tool || "Tool"}`);
                  break;
                case "image":
                  if (event.image_urls) {
                    accumulatedImageUrls = [...accumulatedImageUrls, ...event.image_urls];
                  }
                  break;
                case "nas_files":
                  if (event.nas_files) {
                    accumulatedNasFiles = [...accumulatedNasFiles, ...event.nas_files];
                  }
                  break;
                case "error":
                  if (event.error && event.error !== "[Generation Stopped]") {
                    set({ errorMessage: event.error });
                  }
                  break;
                case "truncation_warning":
                  set({ truncationWarning: event.content || null });
                  break;
                case "done":
                  break;
              }

              // Update assistant message in place
              const msgs = get().messages;
              const parsed = parseStructuredContent(accumulatedContent);
              const displayContent = get().isLoading
                ? stripIncompleteImageMarkdown(parsed)
                : parsed;

              set({
                messages: [
                  ...msgs.slice(0, -1),
                  {
                    ...msgs[msgs.length - 1],
                    content: displayContent,
                    steps: [...accumulatedSteps],
                    image_urls: [...accumulatedImageUrls],
                    nas_files: [...accumulatedNasFiles],
                  },
                ],
              });
            }
          } catch (err) {
            console.log("[Chat] Resume stream error:", err);
            // On error, try reloading messages from DB
            try {
              const freshData = await apiClient.getConversation(conversationId);
              const freshMessages: Message[] = freshData.messages.map((m) => ({
                ...m,
                role: normalizeRole(m.role || "assistant"),
                content: parseStructuredContent(m.content || ""),
                created_at: m.created_at || new Date().toISOString(),
                steps: m.steps || [],
                thinking_duration_sec: m.thinking_duration_sec || 0,
                image_urls: m.image_urls || [],
                attachments: m.attachments || [],
                nas_files: m.nas_files || [],
              }));
              set({ messages: groupBlocksIntoTurns(freshMessages) });
            } catch {
              // Silent — keep whatever we have
            }
          } finally {
            // Finalize: compute thinking duration and clear loading state
            const finalMessages = get().messages;
            const lastMsg = finalMessages[finalMessages.length - 1];
            const streamStarted = lastMsg?.stream_started_at
              ? new Date(lastMsg.stream_started_at)
              : null;
            const thinkingDuration = streamStarted
              ? Math.round((Date.now() - streamStarted.getTime()) / 1000)
              : 0;

            const finalContent = parseStructuredContent(accumulatedContent);
            const hasThinking =
              finalContent.includes("<think>") && finalContent.includes("</think>");

            if (accumulatedContent) {
              set({
                messages: [
                  ...finalMessages.slice(0, -1),
                  {
                    ...lastMsg,
                    content: finalContent,
                    steps: [...accumulatedSteps],
                    image_urls: [...accumulatedImageUrls],
                    nas_files: [...accumulatedNasFiles],
                    thinking_duration_sec: hasThinking ? thinkingDuration : 0,
                  },
                ],
              });
            }

            set({
              isLoading: false,
              isResuming: false,
              currentActivity: null,
              abortController: null,
              iterationSummaries: [],
            });
          }
        }
      } catch {
        // run-status check failed — non-critical, just skip resume
      }
    } catch (err) {
      set({
        isLoading: false,
        isLoadingHistory: false,
        errorMessage: err instanceof Error ? err.message : "Failed to load conversation",
      });
    }
  },

  newChat: (temporary = false, desc) => {
    set({
      conversationId: null,
      currentTitle: null,
      messages: [],
      isTemporaryMode: temporary,
      description: desc || null,
      isLoading: false,
      isResuming: false,
      currentActivity: null,
      iterationSummaries: [],
      errorMessage: null,
    });
  },

  deleteConversation: async (conversationId) => {
    try {
      await apiClient.deleteConversation(conversationId);
      const { conversations, conversationId: currentId } = get();
      set({
        conversations: conversations.filter((c) => c.id !== conversationId),
      });
      if (currentId === conversationId) {
        get().newChat();
      }
    } catch (err) {
      set({
        errorMessage:
          err instanceof Error ? err.message : "Failed to delete",
      });
    }
  },

  renameConversation: async (conversationId, title) => {
    try {
      await apiClient.renameSession(conversationId, title);
      const { conversations, conversationId: currentId } = get();
      set({
        conversations: conversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c
        ),
        ...(currentId === conversationId ? { currentTitle: title } : {}),
      });
    } catch {
      // Silent failure for rename
    }
  },

  togglePin: (conversationId, isPinned) => {
    // Pin state is local-only (matches Flutter SharedPreferences pattern)
    const { conversations } = get();
    set({
      conversations: conversations.map((c) =>
        c.id === conversationId ? { ...c, is_pinned: !isPinned } : c
      ),
    });
    // Persist to localStorage
    if (typeof window !== "undefined") {
      const pinned = JSON.parse(
        localStorage.getItem("sphere_pinned") || "[]"
      ) as string[];
      if (isPinned) {
        localStorage.setItem(
          "sphere_pinned",
          JSON.stringify(pinned.filter((id) => id !== conversationId))
        );
      } else {
        localStorage.setItem(
          "sphere_pinned",
          JSON.stringify([...pinned, conversationId])
        );
      }
    }
  },

  loadConversations: async () => {
    set({ isLoadingHistory: true });
    try {
      const data = await apiClient.getConversations();
      let conversations = data.conversations || [];

      // Apply local pin state
      if (typeof window !== "undefined") {
        const pinned = JSON.parse(
          localStorage.getItem("sphere_pinned") || "[]"
        ) as string[];
        conversations = conversations.map((c) => ({
          ...c,
          is_pinned: pinned.includes(c.id),
        }));
      }

      // Sort: pinned first, then by date
      conversations.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      set({ conversations, isLoadingHistory: false });
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  clearError: () => set({ errorMessage: null }),

  clearTruncationWarning: () => set({ truncationWarning: null }),

  retryMessage: (assistantMessageIndex: number) => {
    const { messages, isLoading, sendMessage } = get();
    if (isLoading) return; // Don't retry while streaming
    if (assistantMessageIndex < 0 || assistantMessageIndex >= messages.length) return;

    // Find the preceding user message
    let userIndex = -1;
    for (let i = assistantMessageIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userIndex = i;
        break;
      }
    }
    if (userIndex < 0) return;

    const userMsg = messages[userIndex];

    // ── Extract clean user text (Google/OpenAI retry pattern) ──
    // Use structured parts (preferred) to get the clean text without
    // injected metadata markers like [Uploaded Image: ...].
    let cleanText = userMsg.content;
    if (userMsg.parts && userMsg.parts.length > 0) {
      const textParts = userMsg.parts.filter((p) => p.type === "text");
      if (textParts.length > 0) {
        cleanText = textParts.map((p) => p.content || "").join("\n").trim();
      }
    }

    // ── Reference existing uploaded files (no re-upload) ──
    // Industry pattern: Google/Anthropic retry sends file references,
    // not raw File objects. The files are already on the server.
    const existingFileParts = userMsg.parts
      ?.filter((p) => p.type !== "text" && p.file_url)
      .map((p) => ({
        file_url: p.file_url!,
        filename: p.filename || "file",
        media_type: p.type || "file",
        mime_type: p.mime_type,
      })) || [];

    // Also check legacy image_urls (older messages without parts)
    if (existingFileParts.length === 0 && userMsg.image_urls && userMsg.image_urls.length > 0) {
      for (const url of userMsg.image_urls) {
        existingFileParts.push({
          file_url: url,
          filename: "image",
          media_type: "image",
          mime_type: undefined,
        });
      }
    }

    // Clear error state and truncate conversation
    set({ messages: messages.slice(0, userIndex), errorMessage: null });

    // Re-send with original text + existing file references
    sendMessage(cleanText, {
      fileParts: existingFileParts.length > 0 ? existingFileParts : undefined,
    });
  },
};
});

// ── Role Normalization ────────────────────────────────────────────────
// Server uses roles like user_query, final_answer, thinking, tool_use, tool_result.
// UI only understands: user, assistant, thinking, tool_use, tool_result, system.
function normalizeRole(role: string): Message["role"] {
  switch (role) {
    case "user_query":
      return "user";
    case "final_answer":
      return "assistant";
    case "user":
    case "assistant":
    case "thinking":
    case "tool_use":
    case "tool_result":
    case "system":
      return role as Message["role"];
    default:
      return "assistant";
  }
}

// ── Group Blocks Into Turns ───────────────────────────────────────────
// Port of Message.groupBlocksIntoTurns() from chat_models.dart
// Server persists structured blocks: user_query, thinking, tool_use, tool_result, final_answer
// After normalizeRole(), these become: user, thinking, tool_use, tool_result, assistant
function groupBlocksIntoTurns(blocks: Message[]): Message[] {
  const result: Message[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.role === "user") {
      result.push(block);
      i++;
      continue;
    }

    // Skip system messages
    if (block.role === "system") {
      i++;
      continue;
    }

    if (["thinking", "tool_use", "tool_result", "assistant"].includes(block.role)) {
      const steps: string[] = [];
      let thinkingDuration = 0;
      let thinkContent = "";
      let assistantContent = "";
      let foundAssistant = false;
      let turnImageUrls: string[] = [];

      while (i < blocks.length) {
        const b = blocks[i];
        if (b.role === "thinking") {
          // Accumulate thinking content and compute duration from actual content length
          thinkContent += (thinkContent ? "\n" : "") + b.content;
          // Use metadata duration if available, otherwise estimate from content
          if (b.thinking_duration_sec > 0) {
            thinkingDuration = b.thinking_duration_sec;
          } else if (thinkContent.length > 0) {
            // Estimate: ~1s per 100 chars of thinking, minimum 1s
            thinkingDuration = Math.max(1, Math.round(thinkContent.length / 100));
          }
          i++;
        } else if (b.role === "tool_use") {
          // Use the `name` field (tool name like "analyze_image", "web_search")
          // Falls back to content, then generic "tool"
          const toolName = b.name || b.content || "tool";
          // Format as readable label: "Running analyze_image"
          const displayName = toolName.replace(/_/g, "_");
          steps.push(`🔧 Running ${displayName}`);
          i++;
        } else if (b.role === "tool_result") {
          const hasError = b.content.includes("❌") || b.content.includes("failed") || b.content.includes("Error");
          if (hasError) {
            steps.push("⚠️ Tool encountered an error");
          } else {
            steps.push("✅ Tool completed");
          }
          i++;
        } else if (b.role === "assistant") {
          // This is the actual response (was final_answer on server, normalized to assistant)
          const sanitized = b.content;
          if (sanitized.includes("<think>")) {
            // Content has embedded thinking — use it directly
            assistantContent = sanitized;
          } else if (thinkContent) {
            // We have thinking from THINKING blocks — wrap and prepend
            assistantContent = `<think>\n${thinkContent}\n</think>\n${sanitized}`;
          } else {
            assistantContent = sanitized;
          }
          // Carry over image URLs from the final answer block
          if (b.image_urls && b.image_urls.length > 0) {
            turnImageUrls = [...turnImageUrls, ...b.image_urls];
          }
          foundAssistant = true;
          i++;
          break;
        } else {
          // Hit a different role (user, system) — stop grouping
          break;
        }
      }

      // If we collected thinking/tool blocks but never found an assistant block,
      // still show the thinking content
      if (!foundAssistant && thinkContent) {
        assistantContent = `<think>\n${thinkContent}\n</think>`;
      }

      if (assistantContent || steps.length > 0) {
        result.push({
          role: "assistant",
          content: assistantContent.trim(),
          created_at: block.created_at,
          steps,
          thinking_duration_sec: thinkingDuration,
          image_urls: turnImageUrls,
          attachments: [],
          nas_files: [],
          parts: [],
        });
      }
      continue;
    }

    // Fallback: push as-is
    result.push(block);
    i++;
  }

  return result;
}
