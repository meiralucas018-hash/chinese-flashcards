// SM-2 Spaced Repetition Algorithm Implementation
// Based on the SuperMemo SM-2 algorithm

import type { Card, Rating, SRSResult } from "@/types";

export const RATING_SHORTCUTS: Record<"1" | "2" | "3" | "4", Rating> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

export function getRatingFromShortcut(key: string): Rating | null {
  if (key in RATING_SHORTCUTS) {
    return RATING_SHORTCUTS[key as keyof typeof RATING_SHORTCUTS];
  }

  return null;
}

/**
 * Calculate the next review parameters based on user rating
 * @param card The card being reviewed
 * @param rating The user's rating (again, hard, good, easy)
 * @returns The new SRS parameters
 */
export function calculateNextReview(card: Card, rating: Rating): SRSResult {
  let { interval, repetition, easeFactor } = card;

  // Adjust ease factor based on rating
  const easeFactorAdjustments: Record<Rating, number> = {
    again: -0.2,
    hard: -0.15,
    good: 0,
    easy: 0.15,
  };

  easeFactor = Math.max(1.3, easeFactor + easeFactorAdjustments[rating]);

  // Calculate new interval
  switch (rating) {
    case "again":
      // Reset - start over from the beginning
      repetition = 0;
      interval = 1; // 1 day
      break;

    case "hard":
      // Slightly increase interval
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 2;
      } else {
        interval = Math.round(interval * 1.2);
      }
      repetition += 1;
      break;

    case "good":
      // Normal interval increase
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 3;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetition += 1;
      break;

    case "easy":
      // Aggressive interval increase
      if (repetition === 0) {
        interval = 2;
      } else if (repetition === 1) {
        interval = 5;
      } else {
        interval = Math.round(interval * easeFactor * 1.3);
      }
      repetition += 1;
      // Bonus ease factor increase for easy
      easeFactor = Math.min(2.5, easeFactor + 0.1);
      break;
  }

  return { interval, repetition, easeFactor };
}

/**
 * Check if a card is due for review
 * @param card The card to check
 * @returns True if the card is due
 */
export function isCardDue(card: Card): boolean {
  return Date.now() >= card.nextReview;
}

/**
 * Get cards due for review from a deck
 * @param cards All cards
 * @param deckId The deck ID to filter by (optional)
 * @returns Cards that are due for review, sorted by due date
 */
export function getDueCards(cards: Card[], deckId?: string): Card[] {
  const now = Date.now();
  let dueCards = cards.filter((card) => card.nextReview <= now);

  if (deckId) {
    dueCards = dueCards.filter((card) => card.deckId === deckId);
  }

  // Sort by due date (oldest first)
  return dueCards.sort((a, b) => a.nextReview - b.nextReview);
}

/**
 * Calculate the next review timestamp
 * @param interval Interval in days
 * @returns Timestamp in milliseconds
 */
export function calculateNextReviewTime(interval: number): number {
  return Date.now() + interval * 24 * 60 * 60 * 1000;
}

/**
 * Get a human-readable description of when the next review is
 * @param nextReview The next review timestamp
 * @returns Human-readable string
 */
export function getNextReviewDescription(nextReview: number): string {
  const now = Date.now();
  const diff = nextReview - now;

  if (diff <= 0) return "Due now";

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Less than a minute";
  if (minutes < 60) return `In ${minutes} minute${minutes > 1 ? "s" : ""}`;
  if (hours < 24) return `In ${hours} hour${hours > 1 ? "s" : ""}`;
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * Initialize a new card with default SRS values
 */
export function initializeNewCard(): Pick<
  Card,
  "interval" | "repetition" | "easeFactor" | "nextReview" | "lastReview"
> {
  return {
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: Date.now(),
    lastReview: 0,
  };
}
