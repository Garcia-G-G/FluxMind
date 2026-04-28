"use client";

/**
 * Lazy-loadable markdown renderer for assistant messages.
 *
 * Splitting this out lets the parent <ChatMessage> import it via
 * `next/dynamic` so react-markdown + remark-gfm aren't pulled into the
 * initial notebook bundle. They're ~80 KB combined and only matter once
 * the user sees an assistant reply.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const MarkdownBody = ({
  content,
}: {
  content: string;
}): React.ReactNode => (
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
    {content}
  </ReactMarkdown>
);

export default MarkdownBody;
