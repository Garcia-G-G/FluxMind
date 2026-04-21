import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { updateNotebookSchema } from "@/lib/validations/notebook";
import { cacheDel, statsCacheKey } from "@/lib/cache/redis";

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = updateNotebookSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, id));

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [updated] = await db
      .update(notebooks)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(notebooks.id, id))
      .returning();

    // Title/icon edits don't change counts, but we invalidate anyway for
    // simplicity — the cache is cheap to rebuild.
    try {
      await cacheDel(statsCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update notebook:", error);
    return NextResponse.json(
      { error: "Failed to update notebook" },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [existing] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, id));

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.delete(notebooks).where(eq(notebooks.id, id));

    // Deleting a notebook cascades through sources/outputs/conversations,
    // so every counted entity in the stats payload may have changed.
    try {
      await cacheDel(statsCacheKey(session.user.id));
    } catch {
      /* no-op */
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete notebook:", error);
    return NextResponse.json(
      { error: "Failed to delete notebook" },
      { status: 500 }
    );
  }
};
