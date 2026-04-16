import { describe, it, expect } from "vitest";
import {
  createNotebookSchema,
  updateNotebookSchema,
} from "@/lib/validations/notebook";

describe("createNotebookSchema", () => {
  it("accepts valid input", () => {
    const result = createNotebookSchema.safeParse({
      title: "My Research",
      description: "About AI",
      icon: "🧠",
      color: "#3b82f6",
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal input (title only)", () => {
    const result = createNotebookSchema.safeParse({
      title: "Quick Notes",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createNotebookSchema.safeParse({
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const result = createNotebookSchema.safeParse({
      title: "Test",
      color: "red",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid hex color", () => {
    const result = createNotebookSchema.safeParse({
      title: "Test",
      color: "#ff00ff",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateNotebookSchema", () => {
  it("accepts partial update", () => {
    const result = updateNotebookSchema.safeParse({
      title: "Updated Title",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateNotebookSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts null description (clear field)", () => {
    const result = updateNotebookSchema.safeParse({
      description: null,
    });
    expect(result.success).toBe(true);
  });
});
