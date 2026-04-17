import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks, notebookCollaborators } from "@/db/schema/notebooks";
import { users } from "@/db/schema/users";

// GET — list collaborators
export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, id));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const collaborators = await db
      .select({
        userId: notebookCollaborators.userId,
        role: notebookCollaborators.role,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(notebookCollaborators)
      .innerJoin(users, eq(notebookCollaborators.userId, users.id))
      .where(eq(notebookCollaborators.notebookId, id));

    return NextResponse.json(collaborators);
  } catch (error) {
    console.error("Failed to fetch collaborators:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};

// POST — add collaborator by email
export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { email, role = "editor" } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    // Verify ownership
    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, id));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Find user by email
    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot add yourself" },
        { status: 400 }
      );
    }

    // Check if already a collaborator
    const [existing] = await db
      .select()
      .from(notebookCollaborators)
      .where(
        and(
          eq(notebookCollaborators.notebookId, id),
          eq(notebookCollaborators.userId, targetUser.id)
        )
      );

    if (existing) {
      // Update role
      await db
        .update(notebookCollaborators)
        .set({ role: role as "viewer" | "editor" | "owner" })
        .where(
          and(
            eq(notebookCollaborators.notebookId, id),
            eq(notebookCollaborators.userId, targetUser.id)
          )
        );
    } else {
      await db.insert(notebookCollaborators).values({
        notebookId: id,
        userId: targetUser.id,
        role: role as "viewer" | "editor" | "owner",
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Failed to add collaborator:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};

// DELETE — remove collaborator
export const DELETE = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { userId: targetUserId } = await request.json();

    const [notebook] = await db
      .select({ userId: notebooks.userId })
      .from(notebooks)
      .where(eq(notebooks.id, id));

    if (!notebook || notebook.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .delete(notebookCollaborators)
      .where(
        and(
          eq(notebookCollaborators.notebookId, id),
          eq(notebookCollaborators.userId, targetUserId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove collaborator:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
