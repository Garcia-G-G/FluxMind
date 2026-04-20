"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { OrbitalIcon } from "@/components/shared/orbital-icon";

const InvitePage = ({
  params,
}: {
  params: Promise<{ token: string }>;
}): React.ReactNode => {
  const { token } = use(params);
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (): Promise<void> => {
    setIsAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to accept invite");
      }
      const data = await res.json();
      router.push(`/notebook/${data.notebookId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to accept invite"
      );
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-20">
      <GlassCard padding="lg">
        <div className="flex flex-col items-center text-center">
          <OrbitalIcon icon={Users} size={48} accent="#7c3aed" />
          <h2
            className="text-xl font-semibold mt-4"
            style={{
              background: "var(--fm-accent-gradient-text)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            You&apos;ve been invited
          </h2>
          <p
            className="text-sm mt-2 mb-6"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            Accept the invitation to collaborate on this notebook.
          </p>

          {error && (
            <p
              className="text-sm mb-4"
              style={{ color: "var(--fm-error)" }}
            >
              {error}
            </p>
          )}

          <button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-50 transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--fm-accent-gradient)",
              borderRadius: 12,
              padding: "12px 0",
            }}
          >
            {isAccepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Accept Invitation"
            )}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export default InvitePage;
