import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { canvasNodes } from "@/db/schema/canvas";

// GET — load canvas state for a notebook
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notebookId = request.nextUrl.searchParams.get("notebookId");
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    // Verify access
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Load saved canvas snapshot
    const [saved] = await db
      .select({ data: canvasNodes.data })
      .from(canvasNodes)
      .where(
        and(
          eq(canvasNodes.notebookId, notebookId),
          eq(canvasNodes.type, "snapshot" as never)
        )
      );

    return NextResponse.json({ snapshot: saved?.data ?? null });
  } catch (error) {
    console.error("Failed to load canvas:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};

// PUT — save canvas state
export const PUT = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { notebookId, snapshot } = await request.json();
    if (!notebookId || !snapshot) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Canvas snapshots are jsonb — cap them at 5 MB serialised so a runaway
    // tldraw client (or a malicious one) can't fill the DB. Real diagrams
    // rarely exceed 200 KB; 5 MB is generous.
    const snapshotJson = JSON.stringify(snapshot);
    if (snapshotJson.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "snapshot too large (5 MB max)" },
        { status: 413 },
      );
    }

    // Verify access
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, notebookId));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Upsert canvas snapshot — store as a single "snapshot" node
    const [existing] = await db
      .select({ id: canvasNodes.id })
      .from(canvasNodes)
      .where(
        and(
          eq(canvasNodes.notebookId, notebookId),
          eq(canvasNodes.type, "snapshot" as never)
        )
      );

    if (existing) {
      await db
        .update(canvasNodes)
        .set({
          data: snapshot,
          updatedAt: new Date(),
        })
        .where(eq(canvasNodes.id, existing.id));
    } else {
      await db.insert(canvasNodes).values({
        id: createId(),
        notebookId,
        type: "snapshot" as never,
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        data: snapshot,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save canvas:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
