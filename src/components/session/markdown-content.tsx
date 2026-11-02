"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

/** Event types whose content is prose that may contain markdown. */
const MARKDOWN_TEXT_TYPES = new Set(["user.message", "assistant.message", "assistant.thinking"]);

/** The markdown-capable text of an event, or null if it carries none. */
export function markdownText(type: string, data: Record<string, unknown>): string | null {
  if (!MARKDOWN_TEXT_TYPES.has(type)) return null;
  const content = (data.content as string) || "";
  return content || null;
}

// Syntax that renders differently from its source. Plain prose — even across
// several lines — matches none of these, so the preview toggle stays hidden
// when raw and rendered output would look the same.
const MARKDOWN_PATTERNS: RegExp[] = [
  /```/, // fenced code
  /`[^`\n]+`/, // inline code
  /\*\*[^\s*][^*\n]*\*\*/, // **bold**
  /__[^\s_][^_\n]*__/, // __bold__
  /(^|[\s(])\*[^\s*][^*\n]*\*(?=[\s).,!?:;]|$)/, // *italic*
  /(^|[\s(])_[^\s_][^_\n]*_(?=[\s).,!?:;]|$)/, // _italic_
  /^#{1,6}\s+\S/m, // heading
  /^\s*([-*+]|\d+\.)\s+\S/m, // list item
  /^\s*>\s+\S/m, // blockquote
  /\[[^\]]+\]\([^)]+\)/, // link
  /~~[^~\n]+~~/, // strikethrough
  /^\s*\|.+\|\s*$/m, // table row
  /^\s*(-{3,}|\*{3,}|_{3,})\s*$/m, // thematic break
];

/** Whether rendering `text` as markdown would differ from showing it verbatim. */
export function hasRenderableMarkdown(text: string): boolean {
  return MARKDOWN_PATTERNS.some((re) => re.test(text));
}

/**
 * Renders a message/reasoning body, either as its raw source or as rendered
 * markdown. The raw/preview switch itself lives in the event footer; this is
 * just the body it controls.
 */
export function MessageMarkdown({
  content,
  showPreview,
  previewChars,
  controlClassName,
  rawClassName = "text-sm text-foreground whitespace-pre-wrap leading-relaxed",
}: {
  content: string;
  /** Rendered markdown when true, verbatim source when false. */
  showPreview: boolean;
  previewChars: number;
  /** Colour for the show-more link. */
  controlClassName: string;
  /** Classes for the raw text block (thinking uses italic muted). */
  rawClassName?: string;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const hasMore = content.length > previewChars;
  const shown = expanded ? content : content.slice(0, previewChars);
  const shownWithEllipsis = hasMore && !expanded ? `${shown}…` : shown;

  return (
    <div className="space-y-1.5">
      {showPreview ? (
        <div className={rawClassName.includes("italic") ? "text-sm text-muted-foreground italic" : "text-sm text-foreground"}>
          <Markdown>{shownWithEllipsis}</Markdown>
        </div>
      ) : (
        <div className={rawClassName}>
          {shown}
          {hasMore && !expanded && "…"}
        </div>
      )}
      {hasMore && (
        <Button
          variant="link"
          size="xs"
          onClick={() => setExpanded(!expanded)}
          className={`h-auto px-0 font-normal ${controlClassName}`}
        >
          {expanded ? t("timeline.showLess") : t("timeline.showMore", { count: content.length })}
        </Button>
      )}
    </div>
  );
}

/** react-markdown with GFM and compact, theme-aware element styling. */
function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mb-2 mt-1 text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-1 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-1 text-sm font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-1 text-sm font-semibold">{children}</h4>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-600 underline underline-offset-2 hover:text-sky-500 dark:text-sky-400"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 italic text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2 border-border" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  code: ({ className, children }) => {
    // Fenced blocks carry a `language-*` class; everything else is inline.
    if (className?.includes("language-")) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground [overflow-wrap:anywhere]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-muted p-2 font-mono text-xs leading-relaxed text-foreground last:mb-0 [overflow-wrap:anywhere]">
      {children as ReactNode}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};
