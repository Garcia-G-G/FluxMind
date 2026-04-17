import * as cheerio from "cheerio";

export type ScrapedPage = {
  url: string;
  title: string;
  content: string;
};

export const scrapePage = async (url: string): Promise<ScrapedPage | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FluxMindBot/1.0; +https://fluxmind.app)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noise
    $("script, style, nav, header, footer, aside, iframe, noscript").remove();
    $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
    $(".sidebar, .nav, .menu, .ad, .advertisement, .cookie").remove();

    // Extract main content
    const article =
      $("article").text() ||
      $("main").text() ||
      $('[role="main"]').text() ||
      $(".content, .post, .entry").text() ||
      $("body").text();

    const title =
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      url;

    // Clean up whitespace
    const content = article
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 5000);

    if (content.length < 50) return null;

    return { url, title, content };
  } catch {
    return null;
  }
};
