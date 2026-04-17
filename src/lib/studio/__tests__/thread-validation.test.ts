import { describe, it, expect } from "vitest";

describe("thread tweet validation", () => {
  const validateTweet = (text: string): { valid: boolean; charCount: number } => {
    const charCount = text.length;
    return { valid: charCount <= 280, charCount };
  };

  it("accepts tweets under 280 characters", () => {
    const result = validateTweet("This is a short tweet.");
    expect(result.valid).toBe(true);
    expect(result.charCount).toBe(22);
  });

  it("accepts tweets at exactly 280 characters", () => {
    const result = validateTweet("x".repeat(280));
    expect(result.valid).toBe(true);
    expect(result.charCount).toBe(280);
  });

  it("rejects tweets over 280 characters", () => {
    const result = validateTweet("x".repeat(281));
    expect(result.valid).toBe(false);
    expect(result.charCount).toBe(281);
  });

  it("correctly counts multi-line tweets", () => {
    const tweet = "Line 1\n\nLine 2\n\nLine 3";
    const result = validateTweet(tweet);
    expect(result.valid).toBe(true);
    expect(result.charCount).toBe(22);
  });
});

describe("thread formatting for copy", () => {
  const formatThread = (
    tweets: Array<{ text: string }>
  ): string => {
    return tweets
      .map((t, i) => `${i + 1}/${tweets.length}\n${t.text}`)
      .join("\n\n");
  };

  it("formats thread with numbering", () => {
    const result = formatThread([
      { text: "First tweet" },
      { text: "Second tweet" },
    ]);
    expect(result).toBe("1/2\nFirst tweet\n\n2/2\nSecond tweet");
  });

  it("handles single tweet", () => {
    const result = formatThread([{ text: "Solo tweet" }]);
    expect(result).toBe("1/1\nSolo tweet");
  });
});
