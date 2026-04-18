import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { outputs } from "@/db/schema/outputs";

export const POST = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [output] = await db
      .select({ id: outputs.id, userId: outputs.userId, isPublic: outputs.isPublic })
      .from(outputs)
      .where(eq(outputs.id, id));

    if (!output || output.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Generate share token and make public
    const shareToken = createId();
    await db
      .update(outputs)
      .set({
        isPublic: true,
        settings: { shareToken },
        updatedAt: new Date(),
      })
      .where(eq(outputs.id, id));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = `${baseUrl}/share/output/${shareToken}`;

    return NextResponse.json({ url, token: shareToken });
  } catch (error) {
    console.error("Share failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
};
