import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ModelConfig = {
  id: string;
  name: string;
  provider: "google" | "anthropic" | "openai";
  description: string;
  tier: "free" | "pro" | "ultra";
};

export const models: ModelConfig[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast and efficient",
    tier: "free",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Best balance of speed and quality",
    tier: "free",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Excellent reasoning and writing",
    tier: "pro",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Strong all-around performance",
    tier: "pro",
  },
  {
    id: "claude-opus",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Most capable, deep analysis",
    tier: "ultra",
  },
];

export const getModel = (modelId: string): LanguageModel => {
  switch (modelId) {
    case "gemini-2.5-flash":
      return google("gemini-2.5-flash-preview-05-20");
    case "gemini-2.5-pro":
      return google("gemini-2.5-pro-preview-06-05");
    case "claude-sonnet":
      return anthropic("claude-sonnet-4-6-20250514");
    case "claude-opus":
      return anthropic("claude-opus-4-6-20250514");
    case "gpt-4o":
      return openai("gpt-4o");
    default:
      return google("gemini-2.5-flash-preview-05-20");
  }
};

export const getModelConfig = (modelId: string): ModelConfig => {
  return models.find((m) => m.id === modelId) ?? models[0];
};
