import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { notebooks } from "@/db/schema/notebooks";

/**
 * Detail endpoint for a single output, including the full `content` jsonb
 * payload. The list endpoint (GET /api/outputs) intentionally omits this
 * column to keep dashboard loads small — use this route when the UI actually
 * needs to render the quiz/flashcards/slides body.
 *
 * Access rules:
 *   - Authenticated session required.
 *   - The caller must either own the output directly (output.userId) OR
 *     own the parent notebook. Owning the notebook is a superset in
 *     almost every case, but we check both to tolerate future shared /
 *     collaborator outputs without a schema change.
 */
export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [row] = await db
      .select({
        id: outputs.id,
        notebookId: outputs.notebookId,
        userId: outputs.userId,
        type: outputs.type,
        title: outputs.title,
        content: outputs.content,
        fileUrl: outputs.fileUrl,
        thumbnailUrl: outputs.thumbnailUrl,
        settings: outputs.settings,
        isPublic: outputs.isPublic,
        likes: outputs.likes,
        duration: outputs.duration,
        status: outputs.status,
        createdAt: outputs.createdAt,
        updatedAt: outputs.updatedAt,
        notebookOwnerId: notebooks.userId,
      })
      .from(outputs)
      .innerJoin(notebooks, eq(outputs.notebookId, notebooks.id))
      .where(eq(outputs.id, id));

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const callerOwnsOutput = row.userId === session.user.id;
    const callerOwnsNotebook = row.notebookOwnerId === session.user.id;

    if (!callerOwnsOutput && !callerOwnsNotebook) {
      // Deliberately 404 (not 403) so we don't leak existence of private
      // outputs to unauthorized callers.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Strip the internal join column before returning.
    const { notebookOwnerId: _notebookOwnerId, ...payload } = row;
    void _notebookOwnerId;
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to fetch output:", error);
    return NextResponse.json(
      { error: "Failed to fetch output" },
      { status: 500 },
    );
  }
};
