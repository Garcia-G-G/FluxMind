"use client";

import { useRef, useEffect } from "react";
import { Send, Square, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { models } from "@/lib/ai/models";

const providerIcons: Record<string, string> = {
  google: "G",
  anthropic: "A",
  openai: "O",
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
      if (input.trim() && !isLoading) {
        onSubmit(e);
      }
    }
  };

  const currentModel = models.find((m) => m.id === selectedModel) ?? models[0];

  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-input text-xs text-muted-foreground hover:bg-accent transition-colors shrink-0 cursor-pointer mb-0.5">
            <span className="font-medium">{providerIcons[currentModel.provider]}</span>
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
                  <span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-xs font-medium">
                    {providerIcons[model.provider]}
                  </span>
                  <div>
                    <p className="text-sm">{model.name}</p>
                    <p className="text-xs text-muted-foreground">{model.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {model.tier !== "free" && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {model.tier}
                    </Badge>
                  )}
                  {model.id === selectedModel && (
                    <span className="text-primary text-sm">&#10003;</span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your sources..."
            rows={1}
            disabled={isLoading}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            style={{ maxHeight: 150 }}
          />
        </div>

        {isLoading ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onStop}
            className="shrink-0 mb-0.5"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim()}
            className="shrink-0 mb-0.5"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </form>
  );
};
