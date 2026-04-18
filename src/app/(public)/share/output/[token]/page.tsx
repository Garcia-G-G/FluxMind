import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { GlassCard } from "@/components/shared/glass-card";
import { AnimatedBackground } from "@/components/shared/animated-background";

const renderContent = (
  type: string,
  content: Record<string, unknown>
): React.ReactNode => {
  // Thread type
  if (type === "thread" && Array.isArray(content.tweets)) {
    return (
      <div className="space-y-3">
        {(content.tweets as Array<{ text: string }>).map((t, i) => (
          <div
            key={i}
            className="p-3 rounded-xl text-sm"
            style={{
              background: "var(--fm-surface)",
              border: "1px solid var(--fm-surface-border)",
              color: "var(--fm-text)",
            }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: "var(--fm-accent-violet)" }}
            >
              {i + 1}/{(content.tweets as unknown[]).length}
            </span>
            <p className="mt-1">{t.text}</p>
          </div>
        ))}
      </div>
    );
  }

  // Quiz type
  if (type === "quiz" && Array.isArray(content.questions)) {
    return (
      <div className="space-y-4">
        {(content.questions as Array<{ question: string }>).map((q, i) => (
          <p
            key={i}
            className="font-medium text-sm"
            style={{ color: "var(--fm-text)" }}
          >
            {i + 1}. {q.question}
          </p>
        ))}
      </div>
    );
  }

  // Fallback: formatted JSON
  return (
    <pre
      className="text-xs whitespace-pre-wrap"
      style={{
        background: "var(--fm-surface)",
        borderRadius: 12,
        padding: 16,
        color: "var(--fm-text-secondary)",
      }}
    >
      {JSON.stringify(content, null, 2)}
    </pre>
  );
};

const SharedOutputPage = async ({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.ReactNode> => {
  const { token } = await params;

  const [output] = await db
    .select()
    .from(outputs)
    .where(
      sql`${outputs.isPublic} = true AND ${outputs.settings}->>'shareToken' = ${token}`
    );

  if (!output) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AnimatedBackground />
        <div className="relative z-10">
          <GlassCard padding="lg">
            <h1
              className="text-xl font-bold mb-2"
              style={{ color: "var(--fm-text)" }}
            >
              Not Found
            </h1>
            <p style={{ color: "var(--fm-text-secondary)" }}>
              This shared output does not exist or has been removed.
            </p>
          </GlassCard>
        </div>
      </div>
    );
  }

  const content = (output.content ?? {}) as Record<string, unknown>;

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />
      <div className="relative z-10 max-w-3xl mx-auto py-12 px-4">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold"
            style={{
              background: "var(--fm-accent-gradient-text)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {output.title}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            Shared from FluxMind
          </p>
        </div>

        <GlassCard padding="lg">{renderContent(output.type, content)}</GlassCard>

        <p
          className="text-center text-xs mt-8"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          Created with FluxMind
        </p>
      </div>
    </div>
  );
};

export default SharedOutputPage;
