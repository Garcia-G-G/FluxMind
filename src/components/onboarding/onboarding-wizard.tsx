"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, BookOpen, Upload, ChevronRight, Check } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { useCreateNotebook } from "@/hooks/use-notebooks";
import { useSession } from "@/lib/auth-client";

const STORAGE_KEY = "fluxmind:onboarding-complete";

const steps = [
  { id: 1, icon: Sparkles, label: "Welcome" },
  { id: 2, icon: BookOpen, label: "Notebook" },
  { id: 3, icon: Upload, label: "Source" },
];

export const OnboardingWizard = (): React.ReactNode => {
  const router = useRouter();
  const { data: session } = useSession();
  const createNotebook = useCreateNotebook();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [notebookTitle, setNotebookTitle] = useState("");
  const [createdNotebookId, setCreatedNotebookId] = useState<string | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) setShow(true);
  }, []);

  const complete = (): void => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
    if (createdNotebookId) {
      router.push(`/notebook/${createdNotebookId}`);
    }
  };

  const handleCreateNotebook = async (): Promise<void> => {
    if (!notebookTitle.trim()) return;
    try {
      const notebook = await createNotebook.mutateAsync({
        title: notebookTitle,
      });
      setCreatedNotebookId(notebook.id);
      setStep(3);
    } catch {
      // Error handled by mutation
    }
  };

  if (!show) return null;

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-lg px-4">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium"
                style={{
                  background: step > s.id ? "var(--fm-accent-gradient)" : step === s.id ? "var(--fm-surface)" : "transparent",
                  border: step >= s.id ? "none" : "2px solid var(--fm-surface-border)",
                  color: step > s.id ? "white" : "var(--fm-text-secondary)",
                  boxShadow: step === s.id ? "0 0 0 2px var(--fm-accent-violet), 0 0 0 4px var(--fm-glow-violet)" : undefined,
                }}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              {i < steps.length - 1 && (
                <div className="w-8 h-0.5" style={{ background: step > s.id ? "var(--fm-accent-violet)" : "var(--fm-surface-border)" }} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <GlassCard padding="lg">
              {step === 1 && (
                <div className="text-center">
                  <h2
                    className="text-2xl font-bold mb-2"
                    style={{
                      background: "var(--fm-accent-gradient-text)",
                      backgroundSize: "200% auto",
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      animation: "gradientShift 3s linear infinite",
                    }}
                  >
                    Welcome to FluxMind, {firstName}!
                  </h2>
                  <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
                    Upload any source, chat with AI, and generate podcasts, slides, quizzes, and more. Let&apos;s get you set up.
                  </p>
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 mx-auto px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--fm-accent-gradient)", borderRadius: 12 }}
                  >
                    Get Started <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--fm-text)" }}>Create your first notebook</h2>
                  <p className="text-sm mb-4" style={{ color: "var(--fm-text-secondary)" }}>Notebooks organize your sources, chats, and outputs.</p>
                  <input
                    value={notebookTitle}
                    onChange={(e) => setNotebookTitle(e.target.value)}
                    placeholder="e.g. AI Research, History Notes..."
                    autoFocus
                    className="w-full mb-4"
                    style={{
                      background: "var(--fm-input-bg)",
                      border: "1px solid var(--fm-input-border)",
                      borderRadius: 10,
                      color: "var(--fm-text)",
                      padding: "10px 14px",
                      fontSize: 14,
                      outline: "none",
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateNotebook(); }}
                  />
                  <button
                    onClick={handleCreateNotebook}
                    disabled={!notebookTitle.trim() || createNotebook.isPending}
                    className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-50 transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--fm-accent-gradient)", borderRadius: 12, padding: "12px 0" }}
                  >
                    Create Notebook <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="text-center">
                  <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--fm-text)" }}>Add your first source</h2>
                  <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
                    You can upload PDFs, paste URLs, or add YouTube links from inside your notebook.
                  </p>
                  <button
                    onClick={complete}
                    className="flex items-center gap-2 mx-auto px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--fm-accent-gradient)", borderRadius: 12 }}
                  >
                    Go to Notebook <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={complete}
                    className="block mx-auto mt-3 text-xs"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    Skip for now
                  </button>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
