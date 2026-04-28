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
    const { fetchWithTimeout } = await import("@/lib/utils/fetch-timeout");
    const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      timeoutMs: 30_000,
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
  } catch (err) {
    // Don't swallow silently — caller falls back to cheerio when null,
    // but we still want a breadcrumb in the worker log when the upstream
    // dies (timeouts, 5xx, etc.).
    console.warn(`[firecrawl] scrape ${url} failed:`, err);
    return null;
  }
};
