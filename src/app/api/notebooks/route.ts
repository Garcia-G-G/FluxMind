import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { desc, asc, ilike, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { createNotebookSchema } from "@/lib/validations/notebook";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get("search") ?? "").slice(0, 100);
    const sort = searchParams.get("sort") ?? "updatedAt";
    const order = searchParams.get("order") ?? "desc";

    const sortColumn =
      sort === "title"
        ? notebooks.title
        : sort === "createdAt"
          ? notebooks.createdAt
          : notebooks.updatedAt;
    const sortOrder = order === "asc" ? asc(sortColumn) : desc(sortColumn);

    const userNotebooks = await db
      .select({
        id: notebooks.id,
        title: notebooks.title,
        description: notebooks.description,
        icon: notebooks.icon,
        color: notebooks.color,
        coverImage: notebooks.coverImage,
        isPublic: notebooks.isPublic,
        settings: notebooks.settings,
        createdAt: notebooks.createdAt,
        updatedAt: notebooks.updatedAt,
        sourceCount: sql<number>`(SELECT COUNT(*) FROM sources WHERE sources.notebook_id = ${notebooks.id})`.as("source_count"),
      })
      .from(notebooks)
      .where(
        search
          ? sql`(${notebooks.userId} = ${session.user.id} OR EXISTS (
              SELECT 1 FROM notebook_collaborators
              WHERE notebook_collaborators.notebook_id = ${notebooks.id}
              AND notebook_collaborators.user_id = ${session.user.id}
            )) AND ${ilike(notebooks.title, `%${search}%`)}`
          : sql`${notebooks.userId} = ${session.user.id} OR EXISTS (
              SELECT 1 FROM notebook_collaborators
              WHERE notebook_collaborators.notebook_id = ${notebooks.id}
              AND notebook_collaborators.user_id = ${session.user.id}
            )`
      )
      .orderBy(sortOrder);

    return NextResponse.json(userNotebooks);
  } catch (error) {
    console.error("Failed to fetch notebooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch notebooks" },
      { status: 500 }
    );
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = createNotebookSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const id = createId();
    const now = new Date();
    const [notebook] = await db
      .insert(notebooks)
      .values({
        id,
        userId: session.user.id,
        title: result.data.title,
        description: result.data.description ?? null,
        icon: result.data.icon ?? "📓",
        color: result.data.color ?? "#6366f1",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(notebook, { status: 201 });
  } catch (error) {
    console.error("Failed to create notebook:", error);
    return NextResponse.json(
      { error: "Failed to create notebook" },
      { status: 500 }
    );
  }
};
