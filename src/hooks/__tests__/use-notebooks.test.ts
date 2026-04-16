import { describe, it, expect } from "vitest";

describe("notebook search filtering", () => {
  const notebooks = [
    { id: "1", title: "AI Research", description: "Machine learning papers" },
    { id: "2", title: "Physics Notes", description: "Quantum mechanics" },
    { id: "3", title: "Math Foundations", description: "Linear algebra" },
    { id: "4", title: "AI Ethics", description: "Responsible AI" },
  ];

  const filterBySearch = (
    items: typeof notebooks,
    query: string
  ): typeof notebooks => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter(
      (n) =>
        n.title.toLowerCase().includes(lower) ||
        n.description.toLowerCase().includes(lower)
    );
  };

  it("returns all notebooks when search is empty", () => {
    expect(filterBySearch(notebooks, "")).toHaveLength(4);
  });

  it("filters by title match", () => {
    const result = filterBySearch(notebooks, "AI");
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("AI Research");
    expect(result[1].title).toBe("AI Ethics");
  });

  it("filters case-insensitively", () => {
    const result = filterBySearch(notebooks, "physics");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Physics Notes");
  });

  it("filters by description match", () => {
    const result = filterBySearch(notebooks, "quantum");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Physics Notes");
  });

  it("returns empty for no match", () => {
    const result = filterBySearch(notebooks, "chemistry");
    expect(result).toHaveLength(0);
  });
});
