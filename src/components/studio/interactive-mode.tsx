"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  Volume2,
  Send,
  X,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InteractiveState =
  | "idle"
  | "inviting"
  | "listening"
  | "processing"
  | "speaking"
  | "transition";

export const InteractiveMode = ({
  notebookId,
  onPause,
  onResume,
}: {
  notebookId: string;
  onPause: () => void;
  onResume: () => void;
}): React.ReactNode => {
  const [state, setState] = useState<InteractiveState>("idle");
  const [textInput, setTextInput] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  // Mic-based STT is deferred to a future iteration — the UI falls back to
  // a text-input mode for now. We keep the `isRecording` flag so the
  // existing button state still renders, but the recorder code path is
  // gone (the captured blob was never sent anywhere, and the setTimeout
  // chain in submitQuestion leaked across unmount).
  const [isRecording, setIsRecording] = useState(false);
  const [useTextInput, setUseTextInput] = useState(false);

  // Track every setTimeout we schedule so we can cancel them on unmount —
  // without this, navigating away while in `speaking`/`transition` fires
  // setState on an unmounted component and calls onResume on a stale ref.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const scheduleTimer = useCallback(
    (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
      const id = setTimeout(() => {
        timersRef.current.delete(id);
        fn();
      }, ms);
      timersRef.current.add(id);
      return id;
    },
    [],
  );
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };
  }, []);

  const startInteractive = useCallback((): void => {
    onPause();
    setState("inviting");
    // Simulate host invitation (would be TTS in production)
    scheduleTimer(() => setState("listening"), 1500);
  }, [onPause, scheduleTimer]);

  const startRecording = useCallback((): void => {
    // Mic STT not yet wired — fall straight to the text input UI. When we
    // wire Whisper / ElevenLabs STT, the navigator.mediaDevices flow
    // belongs here behind a feature flag.
    setUseTextInput(true);
  }, []);

  const stopRecording = useCallback((): void => {
    setIsRecording(false);
  }, []);

  const submitQuestion = useCallback(
    async (question: string): Promise<void> => {
      if (!question.trim()) return;
      setState("processing");
      setTextInput("");

      try {
        const res = await fetch("/api/studio/audio/interactive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, notebookId }),
        });

        if (!res.ok) throw new Error("Failed to get answer");

        const data = await res.json();
        setAnswer(data.answer);
        setState("speaking");

        // In production: play TTS audio of the answer
        // Simulate speaking duration based on answer length
        const speakDuration = Math.max(3000, data.answer.length * 40);
        scheduleTimer(() => {
          setState("transition");
          scheduleTimer(() => {
            setState("idle");
            setAnswer(null);
            setUseTextInput(false);
            onResume();
          }, 1500);
        }, speakDuration);
      } catch (error) {
        console.error("Interactive Q&A failed:", error);
        setState("idle");
        setAnswer(null);
        onResume();
      }
    },
    [notebookId, onResume, scheduleTimer],
  );

  const cancel = useCallback((): void => {
    if (isRecording) stopRecording();
    setState("idle");
    setAnswer(null);
    setTextInput("");
    setUseTextInput(false);
    onResume();
  }, [isRecording, stopRecording, onResume]);

  if (state === "idle") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={startInteractive}
        className="gap-1.5"
      >
        <MessageSquare className="h-4 w-4" />
        Join
      </Button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="border border-border rounded-lg p-4 bg-card"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {state === "inviting" && (
              <>
                <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">
                  Got a question? Go ahead!
                </span>
              </>
            )}
            {state === "listening" && (
              <>
                <Mic className="h-4 w-4 text-red-500 animate-pulse" />
                <span className="text-sm font-medium">Listening...</span>
              </>
            )}
            {state === "processing" && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Thinking...</span>
              </>
            )}
            {state === "speaking" && (
              <>
                <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium">Answering...</span>
              </>
            )}
            {state === "transition" && (
              <span className="text-sm font-medium text-muted-foreground">
                Back to the podcast...
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={cancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {state === "listening" && (
          <div className="space-y-3">
            {!useTextInput && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={isRecording ? "destructive" : "default"}
                  onClick={isRecording ? stopRecording : startRecording}
                  className="gap-1.5"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Record
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUseTextInput(true)}
                >
                  Type instead
                </Button>
              </div>
            )}
            {useTextInput && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitQuestion(textInput);
                }}
              >
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your question..."
                  className="h-9 text-sm"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!textInput.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        )}

        {(state === "speaking" || state === "transition") && answer && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {answer}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
