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
    // Use Serper API if available
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
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
