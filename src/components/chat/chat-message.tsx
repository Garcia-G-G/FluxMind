"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end gap-3"
      >
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground text-sm">
          {content}
        </div>
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10">U</AvatarFallback>
        </Avatar>
      </motion.div>
    );
  }

  const citations = parseCitationsFromText(content);
  const cleanContent = stripCitations(content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 group"
    >
      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs bg-primary text-primary-foreground font-bold">
          F
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ({ children }) => (
                <div className="relative group/code">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {children}
                  </pre>
                </div>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                if (isBlock) return <code className={className}>{children}</code>;
                return (
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
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
          <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5 align-text-bottom" />
        )}

        {!isStreaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onRegenerate}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});

ChatMessage.displayName = "ChatMessage";
