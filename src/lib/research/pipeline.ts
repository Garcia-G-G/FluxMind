import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/models";
import { searchWeb, type SearchResult } from "./web-search";
import { scrapePage, type ScrapedPage } from "./web-scrape";

export type ResearchStep = {
  type: "plan" | "search" | "read" | "synthesize" | "complete" | "error";
  message: string;
  progress: number;
  data?: unknown;
};

export type ResearchOptions = {
  query: string;
  sourceContext: string;
  onStep: (step: ResearchStep) => void;
  language?: "en" | "es";
};

const planSchema = z.object({
  queries: z.array(z.string()),
  reasoning: z.string(),
});

export const runResearchPipeline = async ({
  query,
  sourceContext,
  onStep,
  language = "en",
}: ResearchOptions): Promise<string> => {
  const LANG_NAME = language === "es" ? "Spanish" : "English";
  const langInstr = `IMPORTANT: Write the final report, key takeaways, open questions, and all narrative text in ${LANG_NAME}. Do not mix languages. Web search queries may stay in English if that yields better results, but the synthesized report MUST be in ${LANG_NAME}.`;

  // Step 1: Plan search queries
  onStep({ type: "plan", message: "Planning research queries...", progress: 5 });

  const { object: plan } = await generateObject({
    model: getModel("gemini-2.5-flash"),
    schema: planSchema,
    prompt: `You are a research planning assistant. Based on the user's question and their existing source material, generate 5-8 specific web search queries.

Consider different angles, supporting evidence, counterarguments, recent developments, and statistics.

User's question: ${query}
Existing source summary: ${sourceContext.slice(0, 2000)}

Return search queries and your reasoning.`,
  });

  onStep({
    type: "plan",
    message: `Planned ${plan.queries.length} search queries`,
    progress: 10,
    data: plan,
  });

  // Step 2: Search the web
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (let i = 0; i < plan.queries.length; i++) {
    const searchQuery = plan.queries[i];
    onStep({
      type: "search",
      message: `Searching: "${searchQuery}"`,
      progress: 10 + ((i + 1) / plan.queries.length) * 30,
    });

    const results = await searchWeb(searchQuery, 5);
    for (const result of results) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        allResults.push(result);
      }
    }
  }

  onStep({
    type: "search",
    message: `Found ${allResults.length} unique results`,
    progress: 40,
  });

  // Step 3: Read/scrape top results IN PARALLEL. Was serial — 12 network
  // round-trips at one per iteration = 10-30s of wall-clock time on top of
  // search. Promise.allSettled lets every page race; failed scrapes are
  // simply dropped (we already tolerate partial results).
  const pagesToRead = allResults.slice(0, 12);
  onStep({
    type: "read",
    message: `Reading ${pagesToRead.length} articles in parallel...`,
    progress: 42,
  });

  const scrapeResults = await Promise.allSettled(
    pagesToRead.map((r) => scrapePage(r.url)),
  );
  const scrapedPages: ScrapedPage[] = [];
  for (const settled of scrapeResults) {
    if (settled.status === "fulfilled" && settled.value) {
      scrapedPages.push(settled.value);
    }
  }

  onStep({
    type: "read",
    message: `Read ${scrapedPages.length}/${pagesToRead.length} articles`,
    progress: 68,
  });

  // Step 4: Synthesize report
  onStep({
    type: "synthesize",
    message: "Synthesizing findings into report...",
    progress: 75,
  });

  const webContent = scrapedPages
    .map((p) => `[Web: "${p.title}"](${p.url})\n${p.content}`)
    .join("\n\n---\n\n");

  const { text: report } = await generateText({
    model: getModel("gemini-2.5-flash"),
    prompt: `${langInstr}

You are a senior research analyst. Synthesize the following into a comprehensive research report.

## User's Research Question:
${query}

## User's Existing Sources:
${sourceContext.slice(0, 3000)}

## Web Research Findings:
${webContent || "No web results were available. Base the report on the user's existing sources only."}

Write a thorough, well-structured report that:
1. Directly answers the research question
2. Integrates findings from both the user's sources and web research
3. Identifies agreements, contradictions, and gaps
4. Highlights key insights, patterns, and implications
5. Provides specific data points and examples
6. Cites sources as [Source: "Title"] for user sources and [Web: "Title"](URL) for web sources
7. Ends with Key Takeaways (3-5 bullets), Open Questions, and Further Reading

Write in a professional but accessible tone.`,
  });

  onStep({
    type: "complete",
    message: "Research complete!",
    progress: 100,
  });

  return report;
};
