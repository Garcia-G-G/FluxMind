"use client";

import { useState, useCallback } from "react";
import {
  Search,
  CheckCircle,
  Loader2,
  XCircle,
  Download,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

type StepStatus = "pending" | "active" | "done" | "error";

type ProgressStep = {
  label: string;
  status: StepStatus;
  detail?: string;
};

const StepIcon = ({ status }: { status: StepStatus }): React.ReactNode => {
  switch (status) {
    case "done":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "active":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted" />;
  }
};

export const DeepResearch = ({
  notebookId,
}: {
  notebookId: string;
}): React.ReactNode => {
  const [query, setQuery] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProgressStep[]>([
    { label: "Planning research queries", status: "pending" },
    { label: "Searching the web", status: "pending" },
    { label: "Reading top results", status: "pending" },
    { label: "Synthesizing findings", status: "pending" },
  ]);

  const updateStep = useCallback(
    (index: number, status: StepStatus, detail?: string) => {
      setSteps((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status, detail } : s))
      );
    },
    []
  );

  const startResearch = useCallback(async (): Promise<void> => {
    if (!query.trim() || isRunning) return;
    setIsRunning(true);
    setReport(null);
    setSteps([
      { label: "Planning research queries", status: "pending" },
      { label: "Searching the web", status: "pending" },
      { label: "Reading top results", status: "pending" },
      { label: "Synthesizing findings", status: "pending" },
    ]);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, notebookId }),
      });

      if (!res.ok) throw new Error("Research request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const step = JSON.parse(line.slice(6));
            switch (step.type) {
              case "plan":
                updateStep(0, step.progress >= 10 ? "done" : "active", step.message);
                if (step.progress >= 10) updateStep(1, "active");
                break;
              case "search":
                updateStep(1, step.progress >= 40 ? "done" : "active", step.message);
                if (step.progress >= 40) updateStep(2, "active");
                break;
              case "read":
                updateStep(2, step.progress >= 70 ? "done" : "active", step.message);
                if (step.progress >= 70) updateStep(3, "active");
                break;
              case "synthesize":
                updateStep(3, "active", step.message);
                break;
              case "complete":
                updateStep(3, "done", "Complete!");
                if (step.data?.report) setReport(step.data.report);
                break;
              case "error":
                for (let i = 0; i < 4; i++) {
                  setSteps((prev) =>
                    prev.map((s, idx) =>
                      idx === i && s.status === "active"
                        ? { ...s, status: "error", detail: step.message }
                        : s
                    )
                  );
                }
                break;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error("Research failed:", error);
    } finally {
      setIsRunning(false);
    }
  }, [query, notebookId, isRunning, updateStep]);

  const handleExportMarkdown = (): void => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `research-${query.slice(0, 30).replace(/\s+/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Deep Research</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Go beyond your sources — search the web, read articles, and synthesize a
        comprehensive research report.
      </p>

      {/* Query input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startResearch();
        }}
        className="flex gap-2 mb-6"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you like to research?"
            disabled={isRunning}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
        <Button type="submit" disabled={!query.trim() || isRunning}>
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Research"
          )}
        </Button>
      </form>

      {/* Progress steps */}
      {(isRunning || report) && (
        <div className="space-y-2 mb-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <StepIcon status={step.status} />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    step.status === "active"
                      ? "text-foreground font-medium"
                      : step.status === "done"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p className="text-xs text-muted-foreground truncate">
                    {step.detail}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Report */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Research Report</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMarkdown}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Markdown
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {report}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
