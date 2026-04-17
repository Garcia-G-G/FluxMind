"use client";

import { useState, useRef, useCallback } from "react";
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
  const [isRecording, setIsRecording] = useState(false);
  const [useTextInput, setUseTextInput] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startInteractive = useCallback((): void => {
    onPause();
    setState("inviting");
    // Simulate host invitation (would be TTS in production)
    setTimeout(() => setState("listening"), 1500);
  }, [onPause]);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4",
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current);
        // In production: send blob to STT API (Whisper/ElevenLabs)
        // For now, fall back to text input
        console.log("Recorded audio blob:", blob.size, "bytes");
        setUseTextInput(true);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // Microphone not available, use text input
      setUseTextInput(true);
    }
  }, []);

  const stopRecording = useCallback((): void => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
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
        setTimeout(() => {
          setState("transition");
          setTimeout(() => {
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
    [notebookId, onResume]
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
