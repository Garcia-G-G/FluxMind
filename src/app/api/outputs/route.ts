import { headers } from "next/headers";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";
import { NextResponse } from "next/server";

export const GET = async (req: Request): Promise<NextResponse> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get("notebookId");

  if (!notebookId) {
    return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  }

  // List view never needs the `content` jsonb column — quiz/flashcards/
  // slides payloads can reach tens of KB each, and multiplying that by
  // every row makes the list endpoint an order of magnitude bigger than
  // it needs to be. Clients fetch `content` lazily via GET /api/outputs/[id].
  const results = await db
    .select({
      id: outputs.id,
      notebookId: outputs.notebookId,
      type: outputs.type,
      title: outputs.title,
      status: outputs.status,
      fileUrl: outputs.fileUrl,
      thumbnailUrl: outputs.thumbnailUrl,
      createdAt: outputs.createdAt,
      updatedAt: outputs.updatedAt,
    })
    .from(outputs)
    .where(
      and(
        eq(outputs.notebookId, notebookId),
        eq(outputs.userId, session.user.id),
      ),
    )
    .orderBy(desc(outputs.createdAt));

  return NextResponse.json(results);
};
