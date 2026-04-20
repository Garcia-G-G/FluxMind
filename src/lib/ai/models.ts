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
    description: "Fast and efficient",
    tier: "free",
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Best balance of speed and quality",
    tier: "pro",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Excellent reasoning and writing",
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

const hasGoogleKey = (): boolean => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const hasAnthropicKey = (): boolean => !!process.env.ANTHROPIC_API_KEY;
const hasOpenAIKey = (): boolean => !!process.env.OPENAI_API_KEY;

const pickAvailableFallback = (): LanguageModel => {
  if (hasOpenAIKey()) return openai("gpt-4o-mini");
  if (hasAnthropicKey()) return anthropic("claude-sonnet-4-6-20250514");
  if (hasGoogleKey()) return google("gemini-2.5-flash-preview-05-20");
  // No keys at all — return OpenAI; the SDK will surface a clear error downstream.
  return openai("gpt-4o-mini");
};

export const getModel = (modelId: string): LanguageModel => {
  switch (modelId) {
    case "gemini-2.5-flash":
      return hasGoogleKey() ? google("gemini-2.5-flash-preview-05-20") : pickAvailableFallback();
    case "gemini-2.5-pro":
      return hasGoogleKey() ? google("gemini-2.5-pro-preview-06-05") : pickAvailableFallback();
    case "claude-sonnet":
      return hasAnthropicKey() ? anthropic("claude-sonnet-4-6-20250514") : pickAvailableFallback();
    case "claude-opus":
      return hasAnthropicKey() ? anthropic("claude-opus-4-6-20250514") : pickAvailableFallback();
    case "gpt-4o":
      return hasOpenAIKey() ? openai("gpt-4o") : pickAvailableFallback();
    case "gpt-4o-mini":
      return hasOpenAIKey() ? openai("gpt-4o-mini") : pickAvailableFallback();
    default:
      return pickAvailableFallback();
  }
};

export const getModelConfig = (modelId: string): ModelConfig => {
  return models.find((m) => m.id === modelId) ?? models[0];
};
