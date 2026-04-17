import * as cheerio from "cheerio";

export type UrlMetadata = {
  title: string;
  description: string;
  favicon: string;
  url: string;
};

export const fetchUrlMetadata = async (
  url: string
): Promise<UrlMetadata> => {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FluxMindBot/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    url;
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";
  const origin = new URL(url).origin;
  const favicon =
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    `${origin}/favicon.ico`;

  return {
    title: title.slice(0, 200),
    description: description.slice(0, 500),
    favicon: favicon.startsWith("http") ? favicon : `${origin}${favicon}`,
    url,
  };
};

export const scrapeUrlContent = async (url: string): Promise<string> => {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FluxMindBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, header, footer, aside, iframe, noscript").remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  const text =
    $("article").text() || $("main").text() || $('[role="main"]').text() || $("body").text();

  return text.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
};
