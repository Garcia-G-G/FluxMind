import { describe, it, expect } from "vitest";
import { models, getModelConfig } from "@/lib/ai/models";

describe("models config", () => {
  it("has at least one free tier model", () => {
    const free = models.filter((m) => m.tier === "free");
    expect(free.length).toBeGreaterThan(0);
  });

  it("each model has required fields", () => {
    for (const model of models) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toMatch(/^(openai|google)$/);
      expect(model.tier).toMatch(/^(free|pro|ultra)$/);
    }
  });

  it("getModelConfig returns a valid model for a known id", () => {
    const config = getModelConfig("gpt-4o");
    expect(config.id).toBe("gpt-4o");
    expect(config.provider).toBe("openai");
  });

  it("getModelConfig falls back to first model for unknown id", () => {
    const config = getModelConfig("nonexistent");
    expect(config.id).toBe(models[0].id);
  });
});
