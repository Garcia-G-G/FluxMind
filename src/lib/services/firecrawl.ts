export type FirecrawlResult = {
  url: string;
  content: string;
};

export const scrapeWithFirecrawl = async (
  url: string,
  maxChars = 8000
): Promise<FirecrawlResult | null> => {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    // Fall back to our existing cheerio scraper
    const { scrapePage } = await import("@/lib/research/web-scrape");
    const result = await scrapePage(url);
    if (!result) return null;
    return {
      url: result.url,
      content: result.content.slice(0, maxChars),
    };
  }

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = (data.data?.markdown ?? "").slice(0, maxChars);

    return content.length > 50 ? { url, content } : null;
  } catch {
    return null;
  }
};
