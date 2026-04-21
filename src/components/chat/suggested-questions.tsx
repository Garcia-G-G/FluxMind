"use client";

import { MessageSquare } from "lucide-react";

const DEFAULT_SUGGESTIONS = [
  "What are the main topics covered in my sources?",
  "Summarize the key findings across all documents",
  "What are the most important takeaways?",
  "Are there any contradictions between the sources?",
];

export const SuggestedQuestions = ({
  onSelect,
}: {
  onSelect: (question: string) => void;
}): React.ReactNode => {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center px-4">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <MessageSquare className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-medium mb-1">Chat with your sources</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Ask questions about your uploaded documents. Answers will be grounded in
        your sources with citations.
      </p>
      <div className="grid gap-2 w-full">
        {DEFAULT_SUGGESTIONS.map((question, i) => (
          <button
            key={question}
            onClick={() => onSelect(question)}
            className="text-left px-4 py-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-sm text-muted-foreground hover:text-foreground fm-stagger-item"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};
