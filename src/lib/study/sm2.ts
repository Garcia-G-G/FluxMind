/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo SM-2 algorithm by Piotr Wozniak
 *
 * Quality ratings:
 *   gotIt = true  → quality 4 (correct with some hesitation)
 *   gotIt = false → quality 1 (incorrect, remembered upon seeing answer)
 */

export type SM2State = {
  repetitions: number;
  easeFactor: number;
  interval: number; // days
};

export type SM2Result = SM2State & {
  nextReview: Date;
  status: "new" | "learning" | "review" | "mastered";
};

export const calculateSM2 = (
  current: SM2State,
  gotIt: boolean
): SM2Result => {
  const quality = gotIt ? 4 : 1;
  let { repetitions, easeFactor, interval } = current;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor (minimum 1.3)
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate next review date
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  // Determine status
  let status: SM2Result["status"];
  if (repetitions === 0) {
    status = "learning";
  } else if (repetitions <= 2) {
    status = "learning";
  } else if (interval >= 21) {
    status = "mastered";
  } else {
    status = "review";
  }

  return { repetitions, easeFactor, interval, nextReview, status };
};

export const isDue = (nextReview: Date | null): boolean => {
  if (!nextReview) return true;
  return new Date() >= nextReview;
};
