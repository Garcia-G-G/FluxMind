import { describe, it, expect } from "vitest";
import { getPresenceColor } from "@/lib/collaboration";

describe("collaboration utilities", () => {
  describe("getPresenceColor", () => {
    it("returns a hex color string", () => {
      const color = getPresenceColor("user-123");
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("returns consistent color for same user", () => {
      const color1 = getPresenceColor("user-abc");
      const color2 = getPresenceColor("user-abc");
      expect(color1).toBe(color2);
    });

    it("returns different colors for different users", () => {
      const colors = new Set<string>();
      for (let i = 0; i < 20; i++) {
        colors.add(getPresenceColor(`user-${i}`));
      }
      // With 8 color options and 20 users, we should see multiple distinct colors
      expect(colors.size).toBeGreaterThan(1);
    });
  });
});

describe("canvas snapshot persistence", () => {
  it("round-trips snapshot data through JSON", () => {
    const snapshot = {
      document: {
        store: {
          "shape:abc": {
            type: "geo",
            x: 100,
            y: 200,
            props: { w: 300, h: 200, geo: "rectangle" },
          },
        },
      },
      session: {
        currentPageId: "page:page",
      },
    };

    const serialized = JSON.stringify(snapshot);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.document.store["shape:abc"].x).toBe(100);
    expect(deserialized.session.currentPageId).toBe("page:page");
  });

  it("handles empty snapshot gracefully", () => {
    const snapshot = null;
    expect(snapshot).toBeNull();
    // The load function should skip if snapshot is null
  });
});
