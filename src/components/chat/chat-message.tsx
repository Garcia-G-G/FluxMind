"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, RotateCcw } from "lucide-react";
import { Citation, type CitationData } from "@/components/chat/citation";

const CITATION_REGEX = /\[Source:\s*"([^"]+)"(?:\s*p\.(\d+))?\]/g;

const parseCitationsFromText = (text: string): CitationData[] => {
  const citations: CitationData[] = [];
  const seen = new Set<string>();
  let match;
  const regex = new RegExp(CITATION_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    const title = match[1];
    const page = match[2] ? parseInt(match[2], 10) : null;
    const key = `${title}:${page}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({ sourceTitle: title, pageNumber: page, sourceId: null });
    }
  }
  return citations;
};

const stripCitations = (text: string): string => {
  return text.replace(CITATION_REGEX, "").replace(/\s{2,}/g, " ").trim();
};

export const ChatMessage = memo(({
  role,
  content,
  isStreaming,
  onRegenerate,
}: {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}): React.ReactNode => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (role === "user") {
    return (
      <div className="flex justify-end fm-fade-in">
        <div
          className="max-w-[80%] px-4 py-2.5 text-sm text-white"
          style={{
            background: "linear-gradient(135deg, var(--fm-accent-orange), var(--fm-accent-rose), var(--fm-accent-violet))",
            borderRadius: "20px 20px 6px 20px",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  const citations = parseCitationsFromText(content);
  const cleanContent = stripCitations(content);

  return (
    <div className="flex gap-3 group fm-fade-in">
      {/* AI avatar */}
      <div
        className="h-7 w-7 rounded-full p-[2px] shrink-0 mt-0.5"
        style={{ background: "var(--fm-accent-gradient)" }}
      >
        <div
          className="h-full w-full rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: "var(--fm-surface)", color: "var(--fm-text)" }}
        >
          F
        </div>
      </div>

      <div
        className="flex-1 min-w-0 max-w-[80%] px-4 py-3"
        style={{
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
          borderRadius: "20px 20px 20px 6px",
        }}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" style={{ color: "var(--fm-text)" }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ({ children }) => (
                <pre
                  className="overflow-x-auto rounded-lg p-3 text-xs"
                  style={{ background: "var(--fm-bg-tertiary)" }}
                >
                  {children}
                </pre>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                if (isBlock) return <code className={className}>{children}</code>;
                return (
                  <code
                    className="rounded px-1 py-0.5 text-xs"
                    style={{ background: "var(--fm-bg-tertiary)" }}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {cleanContent}
          </ReactMarkdown>
        </div>

        {citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {citations.map((citation, i) => (
              <Citation key={`${citation.sourceTitle}-${i}`} citation={citation} index={i} />
            ))}
          </div>
        )}

        {isStreaming && (
          <div className="flex items-center gap-1 mt-2">
            {[0, 0.2, 0.4].map((delay, i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full"
                style={{
                  background: "var(--fm-accent-violet)",
                  animation: `typingPulse 1.4s ease-in-out infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {!isStreaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors"
              style={{ color: "var(--fm-text-tertiary)" }}
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {onRegenerate && (
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors"
                style={{ color: "var(--fm-text-tertiary)" }}
                onClick={onRegenerate}
              >
                <RotateCcw className="h-3 w-3" />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = "ChatMessage";
