export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export const searchWeb = async (
  query: string,
  count = 5
): Promise<SearchResult[]> => {
  const apiKey = process.env.SERPER_API_KEY;

  if (apiKey) {
    // Use Serper API if available — 10s timeout so a stalled search doesn't
    // block the route handler that called us.
    const { fetchWithTimeout } = await import("@/lib/utils/fetch-timeout");
    const res = await fetchWithTimeout("https://google.serper.dev/search", {
      method: "POST",
      timeoutMs: 10_000,
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: count }),
    });

    if (res.ok) {
      const data = await res.json();
      return (data.organic ?? []).slice(0, count).map(
        (r: { title: string; link: string; snippet: string }) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
        })
      );
    }
  }

  // Fallback: return empty results if no search API configured
  console.warn("No search API configured (SERPER_API_KEY). Skipping web search.");
  return [];
};
