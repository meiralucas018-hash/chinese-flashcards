import * as flashcardDb from "@/lib/flashcard-db";
import type { QuizPerformanceEvent, QuizSkillType } from "@/types";

const QUIZ_SKILLS: QuizSkillType[] = ["meaning", "pinyin", "audio", "writing"];

export interface QuizMetricSummary {
  attempts: number;
  correct: number;
  missed: number;
  cleanRecall: number;
  slowRecall: number;
  approximate: number;
  accuracy: number;
}

export interface QuizDeckSummary extends QuizMetricSummary {
  deckId: string;
  bySkill: Record<QuizSkillType, QuizMetricSummary>;
}

export interface QuizMissedCardSummary {
  deckId: string;
  cardId: string;
  misses: number;
  attempts: number;
  missRate: number;
}

export interface QuizWeakSkillSummary {
  deckId: string;
  skillType: QuizSkillType;
  attempts: number;
  accuracy: number;
}

export interface QuizTrendPoint {
  date: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface QuizStatisticsSnapshot {
  eventsCount: number;
  overall: QuizMetricSummary;
  bySkill: Record<QuizSkillType, QuizMetricSummary>;
  byDeck: Record<string, QuizDeckSummary>;
  mostMissedCards: QuizMissedCardSummary[];
  weakestSkillByDeck: Record<string, QuizWeakSkillSummary | null>;
  trendByDay: QuizTrendPoint[];
  insights: string[];
}

export interface QuizStatisticsFilters {
  deckId?: string;
  cardId?: string;
  skillType?: QuizSkillType;
  fromTimestamp?: number;
  toTimestamp?: number;
}

function toAccuracy(correct: number, attempts: number): number {
  if (attempts <= 0) {
    return 0;
  }
  return correct / attempts;
}

function createEmptyMetric(): QuizMetricSummary {
  return {
    attempts: 0,
    correct: 0,
    missed: 0,
    cleanRecall: 0,
    slowRecall: 0,
    approximate: 0,
    accuracy: 0,
  };
}

function finalizeMetric(metric: QuizMetricSummary): QuizMetricSummary {
  return {
    ...metric,
    accuracy: toAccuracy(metric.correct, metric.attempts),
  };
}

function addEventToMetric(
  metric: QuizMetricSummary,
  event: QuizPerformanceEvent,
): QuizMetricSummary {
  const next: QuizMetricSummary = {
    ...metric,
    attempts: metric.attempts + 1,
    correct: metric.correct + (event.isCorrect ? 1 : 0),
    missed: metric.missed + (event.isCorrect ? 0 : 1),
    cleanRecall: metric.cleanRecall + (event.isCleanRecall ? 1 : 0),
    slowRecall:
      metric.slowRecall + (event.assessment === "recalled_slowly" ? 1 : 0),
    approximate: metric.approximate + (event.assessment === "approximate" ? 1 : 0),
  };

  next.accuracy = toAccuracy(next.correct, next.attempts);
  return next;
}

function collectInsights(
  overall: QuizMetricSummary,
  bySkill: Record<QuizSkillType, QuizMetricSummary>,
): string[] {
  const insights: string[] = [];
  const meaning = bySkill.meaning;
  const pinyin = bySkill.pinyin;
  const audio = bySkill.audio;
  const writing = bySkill.writing;

  if (
    meaning.attempts >= 3 &&
    pinyin.attempts >= 3 &&
    meaning.accuracy - pinyin.accuracy >= 0.12
  ) {
    insights.push("Meaning recall is stronger than pinyin recall.");
  }

  if (
    audio.attempts >= 3 &&
    meaning.attempts >= 3 &&
    pinyin.attempts >= 3 &&
    audio.accuracy + 0.12 < Math.min(meaning.accuracy, pinyin.accuracy)
  ) {
    insights.push("Audio prompts are causing more misses than text prompts.");
  }

  const recognitionAttempts = meaning.attempts + pinyin.attempts + audio.attempts;
  const recognitionCorrect = meaning.correct + pinyin.correct + audio.correct;
  const recognitionAccuracy = toAccuracy(recognitionCorrect, recognitionAttempts);
  if (
    writing.attempts >= 3 &&
    recognitionAttempts >= 6 &&
    recognitionAccuracy - writing.accuracy >= 0.12
  ) {
    insights.push("Recognition is stronger than writing production.");
  }

  if (overall.correct > 0) {
    const slowRecallShare = overall.slowRecall / overall.correct;
    if (slowRecallShare >= 0.35) {
      insights.push("Recall is often correct but slow, so fluency can improve.");
    }
  }

  return insights;
}

export function buildQuizStatistics(
  events: QuizPerformanceEvent[],
  options?: { topMissedLimit?: number },
): QuizStatisticsSnapshot {
  const topMissedLimit = Math.max(1, options?.topMissedLimit ?? 6);
  let overall = createEmptyMetric();
  const bySkill: Record<QuizSkillType, QuizMetricSummary> = {
    meaning: createEmptyMetric(),
    pinyin: createEmptyMetric(),
    audio: createEmptyMetric(),
    writing: createEmptyMetric(),
  };
  const byDeck: Record<string, QuizDeckSummary> = {};
  const missedByCard = new Map<string, QuizMissedCardSummary>();
  const dailyMap = new Map<string, { attempts: number; correct: number }>();

  for (const event of events) {
    overall = addEventToMetric(overall, event);
    bySkill[event.skillType] = addEventToMetric(bySkill[event.skillType], event);

    if (!byDeck[event.deckId]) {
      byDeck[event.deckId] = {
        deckId: event.deckId,
        ...createEmptyMetric(),
        bySkill: {
          meaning: createEmptyMetric(),
          pinyin: createEmptyMetric(),
          audio: createEmptyMetric(),
          writing: createEmptyMetric(),
        },
      };
    }

    byDeck[event.deckId] = {
      ...byDeck[event.deckId],
      ...addEventToMetric(byDeck[event.deckId], event),
      bySkill: {
        ...byDeck[event.deckId].bySkill,
        [event.skillType]: addEventToMetric(
          byDeck[event.deckId].bySkill[event.skillType],
          event,
        ),
      },
    };

    const missedCardKey = `${event.deckId}:${event.cardId}`;
    const previousMissedCard = missedByCard.get(missedCardKey) || {
      deckId: event.deckId,
      cardId: event.cardId,
      misses: 0,
      attempts: 0,
      missRate: 0,
    };
    const nextMissedCard: QuizMissedCardSummary = {
      ...previousMissedCard,
      attempts: previousMissedCard.attempts + 1,
      misses: previousMissedCard.misses + (event.isCorrect ? 0 : 1),
      missRate: 0,
    };
    nextMissedCard.missRate = toAccuracy(
      nextMissedCard.misses,
      nextMissedCard.attempts,
    );
    missedByCard.set(missedCardKey, nextMissedCard);

    const day = new Date(event.timestamp).toISOString().slice(0, 10);
    const previousDay = dailyMap.get(day) || { attempts: 0, correct: 0 };
    dailyMap.set(day, {
      attempts: previousDay.attempts + 1,
      correct: previousDay.correct + (event.isCorrect ? 1 : 0),
    });
  }

  const finalizedOverall = finalizeMetric(overall);

  const finalizedBySkill: Record<QuizSkillType, QuizMetricSummary> = {
    meaning: finalizeMetric(bySkill.meaning),
    pinyin: finalizeMetric(bySkill.pinyin),
    audio: finalizeMetric(bySkill.audio),
    writing: finalizeMetric(bySkill.writing),
  };

  const weakestSkillByDeck: Record<string, QuizWeakSkillSummary | null> = {};

  for (const deckId of Object.keys(byDeck)) {
    const deck = byDeck[deckId];
    const finalizedDeckBySkill: Record<QuizSkillType, QuizMetricSummary> = {
      meaning: finalizeMetric(deck.bySkill.meaning),
      pinyin: finalizeMetric(deck.bySkill.pinyin),
      audio: finalizeMetric(deck.bySkill.audio),
      writing: finalizeMetric(deck.bySkill.writing),
    };

    byDeck[deckId] = {
      ...finalizeMetric(deck),
      deckId,
      bySkill: finalizedDeckBySkill,
    };

    const weakest = QUIZ_SKILLS
      .map((skillType) => ({
        skillType,
        attempts: finalizedDeckBySkill[skillType].attempts,
        accuracy: finalizedDeckBySkill[skillType].accuracy,
      }))
      .filter((entry) => entry.attempts > 0)
      .sort((a, b) => a.accuracy - b.accuracy)[0];

    weakestSkillByDeck[deckId] = weakest
      ? {
          deckId,
          skillType: weakest.skillType,
          attempts: weakest.attempts,
          accuracy: weakest.accuracy,
        }
      : null;
  }

  const mostMissedCards = [...missedByCard.values()]
    .filter((entry) => entry.attempts > 0)
    .map((entry) => ({
      ...entry,
      missRate: entry.misses / entry.attempts,
    }))
    .sort((a, b) => {
      if (b.misses !== a.misses) {
        return b.misses - a.misses;
      }
      return b.missRate - a.missRate;
    })
    .slice(0, topMissedLimit);

  const trendByDay = [...dailyMap.entries()]
    .map(([date, value]) => ({
      date,
      attempts: value.attempts,
      correct: value.correct,
      accuracy: toAccuracy(value.correct, value.attempts),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    eventsCount: events.length,
    overall: finalizedOverall,
    bySkill: finalizedBySkill,
    byDeck,
    mostMissedCards,
    weakestSkillByDeck,
    trendByDay,
    insights: collectInsights(finalizedOverall, finalizedBySkill),
  };
}

export async function getQuizStatistics(
  filters: QuizStatisticsFilters = {},
): Promise<QuizStatisticsSnapshot> {
  const events = await flashcardDb.getQuizPerformanceEvents(filters);
  return buildQuizStatistics(events);
}
