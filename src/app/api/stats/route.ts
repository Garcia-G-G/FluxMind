import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { count, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { conversations } from "@/db/schema/conversations";
import { outputs } from "@/db/schema/outputs";

export const GET = async (): Promise<NextResponse> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [nbRes, srcRes, convRes, outRes] = await Promise.all([
    db
      .select({ value: count() })
      .from(notebooks)
      .where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(sources)
      .innerJoin(notebooks, eq(sources.notebookId, notebooks.id))
      .where(eq(notebooks.userId, userId)),
    db
      .select({ value: count() })
      .from(conversations)
      .where(eq(conversations.userId, userId)),
    db
      .select({ value: count() })
      .from(outputs)
      .where(eq(outputs.userId, userId)),
  ]);

  return NextResponse.json({
    notebooks: nbRes[0]?.value ?? 0,
    sources: srcRes[0]?.value ?? 0,
    conversations: convRes[0]?.value ?? 0,
    outputs: outRes[0]?.value ?? 0,
  });
};
