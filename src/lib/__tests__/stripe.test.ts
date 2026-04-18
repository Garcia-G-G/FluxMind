import { describe, it, expect } from "vitest";
import { PLANS, isWithinLimit } from "@/lib/billing/plans";

describe("plan limits", () => {
  it("all plans have required limit fields", () => {
    for (const [, plan] of Object.entries(PLANS)) {
      expect(plan.name).toBeTruthy();
      expect(plan.limits.notebooks).toBeDefined();
      expect(plan.limits.sourcesPerNotebook).toBeDefined();
      expect(plan.limits.chatPerDay).toBeDefined();
      expect(plan.limits.studioOutputsPerDay).toBeDefined();
      expect(plan.limits.deepResearchPerMonth).toBeDefined();
      expect(plan.limits.storageMB).toBeDefined();
    }
  });

  it("free plan has the most restrictive limits", () => {
    expect(PLANS.free.limits.notebooks).toBeLessThan(PLANS.pro.limits.notebooks);
    expect(PLANS.free.limits.chatPerDay).toBeLessThan(PLANS.pro.limits.chatPerDay);
  });

  it("ultra plan has unlimited where expected", () => {
    expect(PLANS.ultra.limits.notebooks).toBe(-1);
    expect(PLANS.ultra.limits.chatPerDay).toBe(-1);
    expect(PLANS.ultra.limits.deepResearchPerMonth).toBe(-1);
  });

  it("free plan price is 0", () => {
    expect(PLANS.free.price).toBe(0);
  });

  it("pro plan is cheaper than ultra", () => {
    expect(PLANS.pro.price).toBeLessThan(PLANS.ultra.price);
  });
});

describe("isWithinLimit", () => {
  it("returns true when under limit", () => {
    expect(isWithinLimit(3, 5)).toBe(true);
  });

  it("returns false when at limit", () => {
    expect(isWithinLimit(5, 5)).toBe(false);
  });

  it("returns false when over limit", () => {
    expect(isWithinLimit(6, 5)).toBe(false);
  });

  it("returns true for unlimited (-1)", () => {
    expect(isWithinLimit(999999, -1)).toBe(true);
  });
});
