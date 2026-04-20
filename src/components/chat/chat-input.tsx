"use client";

import { useRef, useEffect } from "react";
import { Square, ChevronDown, ArrowUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { models } from "@/lib/ai/models";

const providerColors: Record<string, string> = {
  google: "#2563eb",
  anthropic: "#7c3aed",
  openai: "#22c55e",
};

export const ChatInput = ({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onStop,
  selectedModel,
  onModelChange,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}): React.ReactNode => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) onSubmit(e);
    }
  };

  const currentModel = models.find((m) => m.id === selectedModel) ?? models[0];

  return (
    <form
      onSubmit={onSubmit}
      className="p-4"
      style={{ borderTop: "1px solid var(--fm-surface-border)" }}
    >
      <div
        className="flex items-end gap-2 max-w-3xl mx-auto px-4 py-3 rounded-2xl"
        style={{
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
        }}
      >
        {/* Model selector */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0 mb-0.5"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
              color: "var(--fm-text-secondary)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: providerColors[currentModel.provider] }}
            />
            <span className="hidden sm:inline">{currentModel.name}</span>
            <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {models.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => onModelChange(model.id)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: providerColors[model.provider] }}
                  />
                  <div>
                    <p className="text-sm">{model.name}</p>
                    <p className="text-xs" style={{ color: "var(--fm-text-tertiary)" }}>
                      {model.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {model.tier !== "free" && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {model.tier}
                    </Badge>
                  )}
                  {model.id === selectedModel && (
                    <span style={{ color: "var(--fm-accent-violet)" }}>&#10003;</span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Textarea */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your sources..."
            rows={1}
            disabled={isLoading}
            className="w-full resize-none text-sm disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--fm-text)",
              border: "none",
              outline: "none",
              maxHeight: 150,
            }}
          />
        </div>

        {/* Send/Stop button */}
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
              color: "var(--fm-text-secondary)",
            }}
          >
            <Square className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--fm-accent-gradient)" }}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </form>
  );
};
