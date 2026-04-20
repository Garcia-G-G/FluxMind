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

  const results = await db
    .select({
      id: outputs.id,
      type: outputs.type,
      title: outputs.title,
      status: outputs.status,
      createdAt: outputs.createdAt,
      updatedAt: outputs.updatedAt,
      content: outputs.content,
      fileUrl: outputs.fileUrl,
      thumbnailUrl: outputs.thumbnailUrl,
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
