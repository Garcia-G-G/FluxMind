import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Runtime file server for locally-stored uploads (R2-fallback mode).
//
// WHY: Next.js's static file handler for public/* freezes its manifest at
// build time. Files written to public/uploads/ AFTER build (the entire
// local-storage fallback use case) return 404 from the static handler,
// even though they exist on disk. This route reads the file at request
// time so newly-generated media (slides, infographics, narrations,
// videos) serves immediately.
//
// Kept under src/app/uploads/[...path] so the URL scheme emitted by
// lib/storage/r2.ts (`/uploads/<key>`) continues to work unchanged.

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "public", "uploads");

const contentTypeFor = (p: string): string => {
  const ext = path.extname(p).toLowerCase();
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".svg": return "image/svg+xml";
    case ".mp3": return "audio/mpeg";
    case ".wav": return "audio/wav";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".json": return "application/json";
    case ".pdf": return "application/pdf";
    default: return "application/octet-stream";
  }
};

export const GET = async (
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> => {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Resolve requested path and refuse anything that escapes ROOT.
  const rel = segments.map((s) => decodeURIComponent(s)).join("/");
  const absolute = path.resolve(ROOT, rel);
  if (!absolute.startsWith(ROOT + path.sep) && absolute !== ROOT) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const data = await fs.readFile(absolute);
    // Node's Buffer is a Uint8Array subtype, which NextResponse accepts as
    // BodyInit. The cast silences the TS-DOM narrower signature.
    return new NextResponse(data as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(absolute),
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR") {
      return new NextResponse("Not found", { status: 404 });
    }
    console.error("uploads route read failed:", err);
    return new NextResponse("Error reading file", { status: 500 });
  }
};
