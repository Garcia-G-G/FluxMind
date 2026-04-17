import { describe, it, expect } from "vitest";
import { load } from "cheerio";

describe("HTML content extraction", () => {
  const extractContent = (html: string): string => {
    const $ = load(html);
    $("script, style, nav, header, footer, aside, iframe, noscript").remove();

    const text =
      $("article").text() ||
      $("main").text() ||
      $("body").text();

    return text.replace(/\s+/g, " ").trim().slice(0, 5000);
  };

  it("extracts text from article tags", () => {
    const html = `
      <html><body>
        <nav>Navigation</nav>
        <article><p>Main content here</p></article>
        <footer>Footer</footer>
      </body></html>
    `;
    const content = extractContent(html);
    expect(content).toContain("Main content");
    expect(content).not.toContain("Navigation");
    expect(content).not.toContain("Footer");
  });

  it("falls back to body if no article/main", () => {
    const html = `<html><body><div>Some content</div></body></html>`;
    const content = extractContent(html);
    expect(content).toContain("Some content");
  });

  it("removes script and style tags", () => {
    const html = `
      <html><body>
        <script>alert('xss')</script>
        <style>.hidden { display: none }</style>
        <p>Visible content</p>
      </body></html>
    `;
    const content = extractContent(html);
    expect(content).toContain("Visible content");
    expect(content).not.toContain("alert");
    expect(content).not.toContain("display");
  });

  it("truncates to 5000 characters", () => {
    const html = `<html><body><p>${"x".repeat(10000)}</p></body></html>`;
    const content = extractContent(html);
    expect(content.length).toBeLessThanOrEqual(5000);
  });
});

describe("search result deduplication", () => {
  it("deduplicates URLs across queries", () => {
    const results = [
      { title: "A", url: "https://example.com/1", snippet: "..." },
      { title: "B", url: "https://example.com/2", snippet: "..." },
      { title: "C", url: "https://example.com/1", snippet: "..." },
      { title: "D", url: "https://example.com/3", snippet: "..." },
    ];

    const seen = new Set<string>();
    const deduplicated = results.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    expect(deduplicated).toHaveLength(3);
  });
});
