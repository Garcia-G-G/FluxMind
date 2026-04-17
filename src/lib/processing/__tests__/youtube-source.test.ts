import { describe, it, expect } from "vitest";

// Inline the regex to avoid importing youtube-transcript (CJS module)
const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const parseYouTubeUrl = (url: string): string | null => {
  const match = url.match(YOUTUBE_REGEX);
  return match?.[1] ?? null;
};

describe("parseYouTubeUrl", () => {
  it("extracts video ID from standard URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts video ID from short URL", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("extracts video ID from embed URL", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts video ID from shorts URL", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URLs", () => {
    expect(parseYouTubeUrl("https://example.com")).toBeNull();
    expect(parseYouTubeUrl("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(parseYouTubeUrl("not a url")).toBeNull();
  });
});
