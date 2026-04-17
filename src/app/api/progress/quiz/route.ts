import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { quizProgress } from "@/db/schema/progress";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outputId = request.nextUrl.searchParams.get("outputId");
    if (!outputId) {
      return NextResponse.json({ error: "outputId required" }, { status: 400 });
    }

    const attempts = await db
      .select()
      .from(quizProgress)
      .where(
        and(
          eq(quizProgress.outputId, outputId),
          eq(quizProgress.userId, session.user.id)
        )
      )
      .orderBy(desc(quizProgress.createdAt));

    return NextResponse.json(attempts);
  } catch (error) {
    console.error("Failed to fetch quiz progress:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { outputId, score, totalQuestions, answers } = body;

    if (!outputId || score === undefined || !totalQuestions) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const [progress] = await db
      .insert(quizProgress)
      .values({
        id: createId(),
        outputId,
        userId: session.user.id,
        score,
        totalQuestions,
        answers,
        completedAt: new Date(),
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json(progress, { status: 201 });
  } catch (error) {
    console.error("Failed to save quiz progress:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
