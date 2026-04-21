import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type ModelConfig = {
  id: string;
  name: string;
  provider: "openai" | "google";
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
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast, long-context structured generation",
    tier: "pro",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Deepest reasoning for studio content",
    tier: "ultra",
  },
];

const hasOpenAIKey = (): boolean => !!process.env.OPENAI_API_KEY;
const hasGoogleKey = (): boolean =>
  !!process.env.GOOGLE_GENERATIVE_AI_API_KEY || !!process.env.GEMINI_API_KEY;

export const getModel = (modelId: string): LanguageModel => {
  switch (modelId) {
    case "gpt-4o":
      return openai("gpt-4o");
    case "gpt-4o-mini":
      return openai("gpt-4o-mini");
    case "gemini-2.5-flash":
      // If Google isn't configured, degrade to gpt-4o (not mini) so studio
      // content generators that ask for Flash still get a capable model.
      return hasGoogleKey()
        ? google("gemini-2.5-flash")
        : openai(hasOpenAIKey() ? "gpt-4o" : "gpt-4o-mini");
    case "gemini-2.5-pro":
      return hasGoogleKey()
        ? google("gemini-2.5-pro")
        : openai(hasOpenAIKey() ? "gpt-4o" : "gpt-4o-mini");
    default:
      return openai(hasOpenAIKey() ? "gpt-4o-mini" : "gpt-4o-mini");
  }
};

export const getModelConfig = (modelId: string): ModelConfig => {
  return models.find((m) => m.id === modelId) ?? models[0];
};
