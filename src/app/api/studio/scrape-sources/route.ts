import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { scrapePage } from "@/lib/research/web-scrape";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const maxDuration = 60;

export type ScrapedResult = {
  url: string;
  title: string;
  content: string;
  error?: string;
};

const MAX_URLS = 25;
const MAX_CONTENT_CHARS = 5000;

export const POST = async (
  request: NextRequest,
): Promise<NextResponse> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const limited = await checkRateLimit({
      userId: session.user.id,
      bucket: "studio.scrape",
      ...RATE_LIMITS.scrapeSources,
    });
    if (limited) return limited;

    const body = await request.json();
    const rawUrls: unknown = body?.urls;
    if (!Array.isArray(rawUrls)) {
      return NextResponse.json(
        { error: "urls must be an array", results: [] },
        { status: 400 },
      );
    }

    const urls: string[] = rawUrls
      .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      .slice(0, MAX_URLS);

    const results: ScrapedResult[] = await Promise.all(
      urls.map(async (url): Promise<ScrapedResult> => {
        try {
          const page = await scrapePage(url);
          if (!page) {
            return { url, title: "", content: "", error: "scrape failed" };
          }
          return {
            url: page.url,
            title: page.title,
            content: page.content.slice(0, MAX_CONTENT_CHARS),
          };
        } catch {
          return { url, title: "", content: "", error: "scrape failed" };
        }
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("scrape-sources failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "unexpected error",
        results: [] as ScrapedResult[],
      },
      { status: 500 },
    );
  }
};
