import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ModelConfig = {
  id: string;
  name: string;
  provider: "openai";
  description: string;
  tier: "free" | "pro" | "ultra";
};

export const models: ModelConfig[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Strong all-around performance",
    tier: "free",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Fast and cost-efficient",
    tier: "free",
  },
];

const hasOpenAIKey = (): boolean => !!process.env.OPENAI_API_KEY;

export const getModel = (modelId: string): LanguageModel => {
  // OpenAI-only. Unknown ids fall back to the fastest default.
  if (!hasOpenAIKey()) {
    // No key configured — return a model that will surface a clear error downstream
    return openai("gpt-4o-mini");
  }
  switch (modelId) {
    case "gpt-4o":
      return openai("gpt-4o");
    case "gpt-4o-mini":
      return openai("gpt-4o-mini");
    default:
      return openai("gpt-4o-mini");
  }
};

export const getModelConfig = (modelId: string): ModelConfig => {
  return models.find((m) => m.id === modelId) ?? models[0];
};
