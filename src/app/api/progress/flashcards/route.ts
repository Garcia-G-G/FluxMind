import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { flashcardProgress } from "@/db/schema/progress";
import { calculateSM2 } from "@/lib/study/sm2";

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

    const progress = await db
      .select()
      .from(flashcardProgress)
      .where(
        and(
          eq(flashcardProgress.outputId, outputId),
          eq(flashcardProgress.userId, session.user.id)
        )
      );

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Failed to fetch flashcard progress:", error);
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
    const { outputId, cardIndex, gotIt } = body as {
      outputId: string;
      cardIndex: number;
      gotIt: boolean;
    };

    if (!outputId || cardIndex === undefined || gotIt === undefined) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Find existing progress or create new
    const [existing] = await db
      .select()
      .from(flashcardProgress)
      .where(
        and(
          eq(flashcardProgress.outputId, outputId),
          eq(flashcardProgress.userId, session.user.id),
          eq(flashcardProgress.cardIndex, cardIndex)
        )
      );

    const currentState = existing
      ? {
          repetitions: existing.repetitions,
          easeFactor: existing.easeFactor,
          interval: existing.interval,
        }
      : { repetitions: 0, easeFactor: 2.5, interval: 0 };

    const result = calculateSM2(currentState, gotIt);

    if (existing) {
      const [updated] = await db
        .update(flashcardProgress)
        .set({
          status: result.status,
          easeFactor: result.easeFactor,
          interval: result.interval,
          repetitions: result.repetitions,
          nextReview: result.nextReview,
          updatedAt: new Date(),
        })
        .where(eq(flashcardProgress.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(flashcardProgress)
      .values({
        id: createId(),
        outputId,
        userId: session.user.id,
        cardIndex,
        status: result.status,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReview: result.nextReview,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to save flashcard progress:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
