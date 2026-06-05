"use client";

// ============================================================================
// Markdown Renderer — Gemini-style clean markdown rendering
// Clean typography, breathable spacing, polished code blocks
// ============================================================================

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState, type ComponentPropsWithoutRef } from "react";
import { Check, Copy } from "lucide-react";
import { apiClient } from "@/lib/api-client";

// Import highlight.js atom-one-dark theme
import "highlight.js/styles/atom-one-dark.css";

interface MarkdownRendererProps {
  content: string;
  dimmed?: boolean;
}

export function MarkdownRenderer({ content, dimmed = false }: MarkdownRendererProps) {
  return (
    <div
      className={`gemini-prose max-w-none ${
        dimmed ? "dimmed" : ""
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // ── Headings ─────────────────────────────────────────────
          h1: ({ children, ...props }) => (
            <h1
              className="text-[1.375rem] font-semibold text-white/90 mt-6 mb-3 leading-tight first:mt-0"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="text-[1.125rem] font-semibold text-white/85 mt-5 mb-2.5 leading-tight first:mt-0"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="text-[1rem] font-semibold text-white/80 mt-4 mb-2 leading-snug first:mt-0"
              {...props}
            >
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4
              className="text-[0.9375rem] font-medium text-white/75 mt-3 mb-1.5 leading-snug first:mt-0"
              {...props}
            >
              {children}
            </h4>
          ),

          // ── Paragraphs ───────────────────────────────────────────
          p: ({ children, ...props }) => (
            <p
              className="text-[0.9375rem] text-white/70 leading-[1.8] my-3 first:mt-0 last:mb-0"
              {...props}
            >
              {children}
            </p>
          ),

          // ── Strong / Bold ────────────────────────────────────────
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-white/85" {...props}>
              {children}
            </strong>
          ),

          // ── Emphasis ─────────────────────────────────────────────
          em: ({ children, ...props }) => (
            <em className="italic text-white/60" {...props}>
              {children}
            </em>
          ),

          // ── Lists ────────────────────────────────────────────────
          ul: ({ children, ...props }) => (
            <ul
              className="my-3 pl-5 space-y-1.5 list-disc marker:text-white/20"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="my-3 pl-5 space-y-1.5 list-decimal marker:text-white/30"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li
              className="text-[0.9375rem] text-white/70 leading-[1.7] pl-1"
              {...props}
            >
              {children}
            </li>
          ),

          // ── Code blocks ──────────────────────────────────────────
          pre: ({ children, ...props }) => (
            <CodeBlock {...props}>{children}</CodeBlock>
          ),
          // Inline code
          code: ({ children, className, ...props }) => {
            if (className) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="text-[var(--color-accent-teal)] bg-white/[0.06] px-1.5 py-0.5 rounded-md text-[0.8125rem] font-mono border border-white/[0.04]"
                {...props}
              >
                {children}
              </code>
            );
          },

          // ── Tables ───────────────────────────────────────────────
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto rounded-xl my-4 border border-white/[0.06]">
              <table className="w-full text-[0.8125rem]" {...props}>{children}</table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-white/[0.03]" {...props}>{children}</thead>
          ),
          th: ({ children, ...props }) => (
            <th
              className="text-left text-white/50 font-semibold text-[0.75rem] uppercase tracking-wider px-4 py-2.5 border-b border-white/[0.08]"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="text-white/60 px-4 py-2.5 border-b border-white/[0.03]"
              {...props}
            >
              {children}
            </td>
          ),
          tr: ({ children, ...props }) => (
            <tr className="hover:bg-white/[0.02] transition-colors" {...props}>
              {children}
            </tr>
          ),

          // ── Blockquote ───────────────────────────────────────────
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="my-4 pl-4 border-l-[3px] border-[var(--color-accent-purple)]/40 text-white/50 italic"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // ── Horizontal Rule ──────────────────────────────────────
          hr: ({ ...props }) => (
            <hr className="my-6 border-white/[0.06]" {...props} />
          ),

          // ── Links ────────────────────────────────────────────────
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent-teal)] underline decoration-[var(--color-accent-teal)]/30 hover:decoration-[var(--color-accent-teal)] underline-offset-2 transition-all"
              {...props}
            >
              {children}
            </a>
          ),

          // ── Images ───────────────────────────────────────────────
          img: ({ src, alt, ...props }) => {
            const resolvedSrc = src ? apiClient.resolveFileUrl(String(src)) : "";
            return (
            <span className="block my-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedSrc}
                alt={alt || ""}
                className="rounded-xl max-w-full border border-white/[0.08] shadow-lg"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                {...props}
              />
            </span>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── Code Block with Copy Button ─────────────────────────────────────────
// Gemini-style: rounded, dark bg, language label top-left, copy top-right
function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const [copied, setCopied] = useState(false);

  const getCodeText = (): string => {
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === "string") return node;
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (node && typeof node === "object" && "props" in node) {
        const el = node as React.ReactElement<{ children?: React.ReactNode }>;
        return extractText(el.props.children);
      }
      return "";
    };
    return extractText(children);
  };

  const handleCopy = () => {
    const text = getCodeText();
    let ok = false;
    // Try modern Clipboard API first (requires secure context)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      ok = true;
    } else {
      // Fallback: hidden textarea + execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Extract language from code element's className
  const codeElement = children as React.ReactElement<{ className?: string }>;
  const langMatch = codeElement?.props?.className?.match(/language-(\w+)/);
  const language = langMatch ? langMatch[1] : null;

  return (
    <div className="relative group rounded-xl overflow-hidden my-4 bg-[#0c1018] border border-white/[0.06]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.025] border-b border-white/[0.04]">
        <span className="text-[10px] text-white/25 font-mono uppercase tracking-widest">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-all ${
            copied
              ? "text-green-400 bg-green-400/10"
              : "text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
          }`}
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre
        className="!bg-transparent !m-0 overflow-x-auto px-4 py-3.5 text-[0.8125rem] leading-[1.6]"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
}
