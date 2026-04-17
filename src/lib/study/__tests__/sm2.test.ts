import { describe, it, expect } from "vitest";
import { calculateSM2, isDue } from "@/lib/study/sm2";

describe("SM-2 algorithm", () => {
  const newCard = { repetitions: 0, easeFactor: 2.5, interval: 0 };

  it("sets interval to 1 day on first correct answer", () => {
    const result = calculateSM2(newCard, true);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.status).toBe("learning");
  });

  it("sets interval to 6 days on second correct answer", () => {
    const firstResult = calculateSM2(newCard, true);
    const secondResult = calculateSM2(
      {
        repetitions: firstResult.repetitions,
        easeFactor: firstResult.easeFactor,
        interval: firstResult.interval,
      },
      true
    );
    expect(secondResult.interval).toBe(6);
    expect(secondResult.repetitions).toBe(2);
  });

  it("multiplies interval by ease factor on subsequent correct answers", () => {
    const state = { repetitions: 2, easeFactor: 2.5, interval: 6 };
    const result = calculateSM2(state, true);
    expect(result.interval).toBe(15); // 6 * 2.5 = 15
    expect(result.repetitions).toBe(3);
  });

  it("resets to 1 day interval on incorrect answer", () => {
    const state = { repetitions: 5, easeFactor: 2.5, interval: 30 };
    const result = calculateSM2(state, false);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.status).toBe("learning");
  });

  it("decreases ease factor on incorrect answer", () => {
    const result = calculateSM2(newCard, false);
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it("increases ease factor on correct answer", () => {
    const result = calculateSM2(newCard, true);
    expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);
  });

  it("never lets ease factor drop below 1.3", () => {
    let state = newCard;
    for (let i = 0; i < 20; i++) {
      const result = calculateSM2(state, false);
      state = {
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        interval: result.interval,
      };
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("sets mastered status after enough repetitions with long interval", () => {
    let state = newCard;
    for (let i = 0; i < 5; i++) {
      const result = calculateSM2(state, true);
      state = {
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
        interval: result.interval,
      };
    }
    const result = calculateSM2(state, true);
    expect(result.status).toBe("mastered");
    expect(result.interval).toBeGreaterThanOrEqual(21);
  });

  it("sets nextReview to a future date", () => {
    const result = calculateSM2(newCard, true);
    expect(result.nextReview.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("isDue", () => {
  it("returns true when nextReview is null", () => {
    expect(isDue(null)).toBe(true);
  });

  it("returns true when nextReview is in the past", () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isDue(past)).toBe(true);
  });

  it("returns false when nextReview is in the future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    expect(isDue(future)).toBe(false);
  });
});
