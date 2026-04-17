import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";

export type StudioContext = {
  userId: string;
  notebookId: string;
  notebookTitle: string;
  sourceContext: string;
};

export const getStudioContext = async (
  notebookId: string
): Promise<StudioContext | { error: string; status: number }> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  const [notebook] = await db
    .select({ userId: notebooks.userId, title: notebooks.title })
    .from(notebooks)
    .where(eq(notebooks.id, notebookId));

  if (!notebook || notebook.userId !== session.user.id) {
    return { error: "Not found", status: 404 };
  }

  const notebookSources = await db
    .select({ title: sources.title, rawText: sources.rawText })
    .from(sources)
    .where(eq(sources.notebookId, notebookId));

  const sourceContext = notebookSources
    .filter((s) => s.rawText)
    .map((s) => `[${s.title}]\n${s.rawText!.slice(0, 5000)}`)
    .join("\n\n---\n\n");

  if (!sourceContext.trim()) {
    return { error: "No processed sources available", status: 400 };
  }

  return {
    userId: session.user.id,
    notebookId,
    notebookTitle: notebook.title,
    sourceContext,
  };
};

export const isError = (
  ctx: StudioContext | { error: string; status: number }
): ctx is { error: string; status: number } => {
  return "error" in ctx;
};
