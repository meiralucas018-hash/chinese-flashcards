import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Clock3,
  Layers3,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Card as CardType,
  Deck,
  QuizPerformanceEvent,
  QuizSkillType,
  ReviewPerformanceEvent,
} from "@/types";
import * as flashcardDb from "@/lib/flashcard-db";
import { buildQuizStatistics } from "@/lib/quiz-statistics";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map((value) => Number(value));
  return new Date(year, month - 1, day);
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }
  return `${Math.round(value * 100)}%`;
}

function formatRelativeDate(timestamp: number | null): string {
  if (!timestamp) {
    return "Not studied";
  }

  const deltaDays = Math.floor((startOfToday() - startOfTodayFor(timestamp)) / DAY_MS);
  if (deltaDays <= 0) {
    return "Today";
  }
  if (deltaDays === 1) {
    return "Yesterday";
  }
  return `${deltaDays} days ago`;
}

function startOfTodayFor(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return numerator / denominator;
}

function formatStudyDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0m";
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${rest}m`;
}

type TrendMetric = "reviews" | "quizAccuracy" | "studyMinutes" | "retention";

interface StatisticsViewProps {
  decks: Deck[];
  cards: CardType[];
  deckStatsMap: Record<string, { total: number; due: number; learned: number }>;
}

export default function StatisticsView({
  decks,
  cards,
  deckStatsMap,
}: StatisticsViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [quizEvents, setQuizEvents] = useState<QuizPerformanceEvent[]>([]);
  const [reviewEvents, setReviewEvents] = useState<ReviewPerformanceEvent[]>([]);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("quizAccuracy");

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const [loadedQuizEvents, loadedReviewEvents] = await Promise.all([
          flashcardDb.getQuizPerformanceEvents(),
          flashcardDb.getReviewPerformanceEvents(),
        ]);
        if (!isMounted) {
          return;
        }
        setQuizEvents(loadedQuizEvents);
        setReviewEvents(loadedReviewEvents);
      } catch (error) {
        console.error("Failed to load statistics data:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [cards.length, decks.length]);

  const cardMap = useMemo(() => {
    const map = new Map<string, CardType>();
    for (const card of cards) {
      map.set(card.id, card);
    }
    return map;
  }, [cards]);

  const quizSnapshot = useMemo(
    () => buildQuizStatistics(quizEvents, { topMissedLimit: 8 }),
    [quizEvents],
  );

  const now = Date.now();
  const todayStart = startOfToday();
  const tomorrowStart = todayStart + DAY_MS;
  const weekAhead = todayStart + DAY_MS * 7;

  const reviewsToday = useMemo(
    () => reviewEvents.filter((event) => event.timestamp >= todayStart),
    [reviewEvents, todayStart],
  );
  const quizToday = useMemo(
    () => quizEvents.filter((event) => event.timestamp >= todayStart),
    [quizEvents, todayStart],
  );

  const dueCompletedToday = useMemo(
    () => new Set(reviewsToday.map((event) => event.cardId)).size,
    [reviewsToday],
  );

  const reviewAccuracy = useMemo(() => {
    const successful = reviewEvents.filter((event) => event.isSuccess).length;
    return safeRatio(successful, reviewEvents.length);
  }, [reviewEvents]);

  const quizAccuracy = quizSnapshot.overall.accuracy || null;
  const averageAccuracy = useMemo(() => {
    if (reviewAccuracy !== null && quizAccuracy !== null) {
      return (reviewAccuracy + quizAccuracy) / 2;
    }
    if (reviewAccuracy !== null) {
      return reviewAccuracy;
    }
    if (quizAccuracy !== null) {
      return quizAccuracy;
    }
    return null;
  }, [quizAccuracy, reviewAccuracy]);

  const estimatedStudyMinutesToday = Math.round(
    reviewsToday.length * 0.65 + quizToday.length * 0.45,
  );

  const studyStreakDays = useMemo(() => {
    const activeDays = new Set<string>([
      ...reviewEvents.map((event) => toDayKey(event.timestamp)),
      ...quizEvents.map((event) => toDayKey(event.timestamp)),
    ]);

    let streak = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const checkDay = new Date(todayStart - offset * DAY_MS);
      const key = toDayKey(checkDay.getTime());
      if (!activeDays.has(key)) {
        break;
      }
      streak += 1;
    }

    return streak;
  }, [quizEvents, reviewEvents, todayStart]);

  const trendData = useMemo(() => {
    const byDay = new Map<
      string,
      {
        reviews: number;
        reviewSuccess: number;
        quizAttempts: number;
        quizCorrect: number;
      }
    >();

    for (const event of reviewEvents) {
      const key = toDayKey(event.timestamp);
      const current = byDay.get(key) || {
        reviews: 0,
        reviewSuccess: 0,
        quizAttempts: 0,
        quizCorrect: 0,
      };
      current.reviews += 1;
      current.reviewSuccess += event.isSuccess ? 1 : 0;
      byDay.set(key, current);
    }

    for (const event of quizEvents) {
      const key = toDayKey(event.timestamp);
      const current = byDay.get(key) || {
        reviews: 0,
        reviewSuccess: 0,
        quizAttempts: 0,
        quizCorrect: 0,
      };
      current.quizAttempts += 1;
      current.quizCorrect += event.isCorrect ? 1 : 0;
      byDay.set(key, current);
    }

    const output: Array<{
      key: string;
      label: string;
      reviews: number;
      quizAccuracy: number;
      studyMinutes: number;
      retention: number;
    }> = [];

    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(todayStart - offset * DAY_MS);
      const key = toDayKey(date.getTime());
      const values = byDay.get(key) || {
        reviews: 0,
        reviewSuccess: 0,
        quizAttempts: 0,
        quizCorrect: 0,
      };

      output.push({
        key,
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        reviews: values.reviews,
        quizAccuracy:
          values.quizAttempts > 0 ? (values.quizCorrect / values.quizAttempts) * 100 : 0,
        studyMinutes: Math.round(values.reviews * 0.65 + values.quizAttempts * 0.45),
        retention: values.reviews > 0 ? (values.reviewSuccess / values.reviews) * 100 : 0,
      });
    }

    return output;
  }, [quizEvents, reviewEvents, todayStart]);

  const trendMetricOptions: Record<
    TrendMetric,
    { label: string; dataKey: keyof (typeof trendData)[number]; suffix: string; domain?: [number, number] }
  > = {
    reviews: { label: "Reviews per day", dataKey: "reviews", suffix: "" },
    quizAccuracy: {
      label: "Quiz accuracy",
      dataKey: "quizAccuracy",
      suffix: "%",
      domain: [0, 100],
    },
    studyMinutes: { label: "Study time", dataKey: "studyMinutes", suffix: "m" },
    retention: {
      label: "Retention",
      dataKey: "retention",
      suffix: "%",
      domain: [0, 100],
    },
  };

  const selectedTrendMetric = trendMetricOptions[trendMetric];

  const deckRows = useMemo(() => {
    return decks.map((deck) => {
      const stats = deckStatsMap[deck.id] || { total: 0, due: 0, learned: 0 };
      const deckReviewEvents = reviewEvents.filter((event) => event.deckId === deck.id);
      const deckQuiz = quizSnapshot.byDeck[deck.id];
      const reviewAccuracyRatio = safeRatio(
        deckReviewEvents.filter((event) => event.isSuccess).length,
        deckReviewEvents.length,
      );
      const quizAccuracyRatio = deckQuiz?.accuracy ?? null;
      const latestReview =
        deckReviewEvents.length > 0 ? deckReviewEvents[0].timestamp : null;
      const latestQuiz =
        deckQuiz && deckQuiz.attempts > 0
          ? quizEvents.find((event) => event.deckId === deck.id)?.timestamp || null
          : null;
      const lastStudiedTimestamp = Math.max(
        latestReview || 0,
        latestQuiz || 0,
        0,
      );

      return {
        deck,
        stats,
        reviewAttempts: deckReviewEvents.length,
        reviewAccuracyRatio,
        quizAttempts: deckQuiz?.attempts || 0,
        quizAccuracyRatio,
        mastery:
          stats.total > 0 ? Math.round((stats.learned / stats.total) * 100) : 0,
        lastStudiedTimestamp: lastStudiedTimestamp || null,
      };
    });
  }, [deckStatsMap, decks, quizEvents, quizSnapshot.byDeck, reviewEvents]);

  const weakestSkill = useMemo(() => {
    const skills: Array<{ skill: QuizSkillType; accuracy: number; attempts: number }> = [
      {
        skill: "meaning",
        accuracy: quizSnapshot.bySkill.meaning.accuracy,
        attempts: quizSnapshot.bySkill.meaning.attempts,
      },
      {
        skill: "pinyin",
        accuracy: quizSnapshot.bySkill.pinyin.accuracy,
        attempts: quizSnapshot.bySkill.pinyin.attempts,
      },
      {
        skill: "audio",
        accuracy: quizSnapshot.bySkill.audio.accuracy,
        attempts: quizSnapshot.bySkill.audio.attempts,
      },
      {
        skill: "writing",
        accuracy: quizSnapshot.bySkill.writing.accuracy,
        attempts: quizSnapshot.bySkill.writing.attempts,
      },
    ];

    return skills
      .filter((skill) => skill.attempts > 0)
      .sort((a, b) => a.accuracy - b.accuracy)[0];
  }, [quizSnapshot.bySkill]);

  const weakestDeck = useMemo(() => {
    return deckRows
      .filter((row) => row.stats.total > 0)
      .map((row) => {
        const review = row.reviewAccuracyRatio ?? 0;
        const quiz = row.quizAccuracyRatio ?? 0;
        const score =
          row.reviewAttempts > 0 || row.quizAttempts > 0
            ? review * 0.5 + quiz * 0.5
            : row.mastery / 100;
        return { row, score };
      })
      .sort((a, b) => a.score - b.score)[0];
  }, [deckRows]);

  const failedVerificationCards = useMemo(() => {
    const failedCycles = new Map<string, { cardId: string; deckId: string; count: number }>();
    const seenFailedCycleIds = new Set<string>();

    for (const event of quizEvents) {
      if (event.cyclePassed || !event.cycleId || seenFailedCycleIds.has(event.cycleId)) {
        continue;
      }
      seenFailedCycleIds.add(event.cycleId);
      const current = failedCycles.get(event.cardId) || {
        cardId: event.cardId,
        deckId: event.deckId,
        count: 0,
      };
      current.count += 1;
      failedCycles.set(event.cardId, current);
    }

    return [...failedCycles.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [quizEvents]);

  const repeatedQuizLoopCards = useMemo(() => {
    const cycleMap = new Map<
      string,
      { cardId: string; deckId: string; studyLoopCount: number; cyclePassed: boolean }
    >();

    for (const event of quizEvents) {
      if (!event.cycleId) {
        continue;
      }
      if (!cycleMap.has(event.cycleId)) {
        cycleMap.set(event.cycleId, {
          cardId: event.cardId,
          deckId: event.deckId,
          studyLoopCount: event.studyLoopCount,
          cyclePassed: event.cyclePassed,
        });
      }
    }

    const byCard = new Map<string, { deckId: string; maxLoopCount: number }>();
    for (const cycle of cycleMap.values()) {
      if (!cycle.cyclePassed || cycle.studyLoopCount <= 1) {
        continue;
      }
      const current = byCard.get(cycle.cardId) || {
        deckId: cycle.deckId,
        maxLoopCount: 1,
      };
      byCard.set(cycle.cardId, {
        deckId: cycle.deckId,
        maxLoopCount: Math.max(current.maxLoopCount, cycle.studyLoopCount),
      });
    }

    return [...byCard.entries()]
      .map(([cardId, value]) => ({ cardId, ...value }))
      .sort((a, b) => b.maxLoopCount - a.maxLoopCount)
      .slice(0, 6);
  }, [quizEvents]);

  const dueToday = cards.filter(
    (card) => card.nextReview >= todayStart && card.nextReview < tomorrowStart,
  ).length;
  const dueTomorrow = cards.filter(
    (card) =>
      card.nextReview >= tomorrowStart && card.nextReview < tomorrowStart + DAY_MS,
  ).length;
  const dueThisWeek = cards.filter(
    (card) => card.nextReview >= todayStart && card.nextReview < weekAhead,
  ).length;
  const recentNewCards = cards.filter(
    (card) => card.createdAt >= now - DAY_MS * 7,
  ).length;

  const forecastRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; due: number }> = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const start = todayStart + dayOffset * DAY_MS;
      const end = start + DAY_MS;
      const due = cards.filter(
        (card) => card.nextReview >= start && card.nextReview < end,
      ).length;
      const key = toDayKey(start);
      rows.push({
        key,
        label: fromDayKey(key).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        due,
      });
    }
    return rows;
  }, [cards, todayStart]);

  const projectedWeeklyLoad = dueThisWeek + Math.round(recentNewCards * 0.6);

  const insightLines = useMemo(() => {
    const lines = [...quizSnapshot.insights];
    if (studyStreakDays >= 5) {
      lines.push("Your review consistency is strong this week.");
    }
    if (weakestDeck && weakestDeck.row.stats.total > 0) {
      lines.push(
        `${weakestDeck.row.deck.name} needs attention with lower recent performance.`,
      );
    }
    if (dueToday > dueCompletedToday) {
      lines.push(`You still have ${dueToday - dueCompletedToday} due cards pending today.`);
    }
    if (weakestSkill) {
      lines.push(
        `${weakestSkill.skill} is currently your weakest quiz area.`,
      );
    }

    return lines.filter((line, index, array) => array.indexOf(line) === index).slice(0, 5);
  }, [
    dueCompletedToday,
    dueToday,
    quizSnapshot.insights,
    studyStreakDays,
    weakestDeck,
    weakestSkill,
  ]);

  if (isLoading) {
    return (
      <div className="app-panel mx-auto w-full max-w-5xl rounded-[28px] p-8 text-center text-slate-400">
        Loading statistics...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="app-panel mx-auto w-full max-w-5xl rounded-[30px] p-4 sm:p-5">
        <div className="app-surface rounded-[22px] p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
            Statistics
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-[2rem]">
            Performance Command Center
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">
            Track review consistency, diagnose weak skills, and choose what to
            improve next across your decks.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Reviews today" value={`${reviewsToday.length}`} icon={Activity} />
          <StatCard label="Study streak" value={`${studyStreakDays} days`} icon={TrendingUp} />
          <StatCard
            label="Average retention / accuracy"
            value={formatPercent(averageAccuracy)}
            icon={Target}
          />
          <StatCard label="Due completed" value={`${dueCompletedToday}`} icon={CalendarClock} />
          <StatCard
            label="Time studied"
            value={formatStudyDuration(estimatedStudyMinutesToday)}
            icon={Clock3}
          />
        </div>
      </section>

      <section className="app-panel mx-auto w-full max-w-5xl rounded-[30px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
              Performance Over Time
            </p>
            <p className="mt-1 text-sm text-slate-300">Last 14 days</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              ["reviews", "quizAccuracy", "studyMinutes", "retention"] as TrendMetric[]
            ).map((option) => (
              <Button
                key={option}
                variant="outline"
                size="sm"
                onClick={() => setTrendMetric(option)}
                className={
                  trendMetric === option ? "app-action-neon h-8" : "app-action h-8"
                }
              >
                {trendMetricOptions[option].label}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4 app-surface rounded-2xl p-3 sm:p-4">
          <div className="mb-3 text-xs uppercase tracking-[0.16em] text-slate-500">
            {selectedTrendMetric.label}
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(203,213,225,0.55)" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  stroke="rgba(203,213,225,0.45)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  domain={selectedTrendMetric.domain}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(8,10,12,0.96)",
                    border: "1px solid rgba(124,236,255,0.18)",
                    borderRadius: "12px",
                    color: "#dbe7f2",
                  }}
                  labelStyle={{ color: "#9fb7ca" }}
                  formatter={(value: number) => `${Math.round(value)}${selectedTrendMetric.suffix}`}
                />
                <Line
                  type="monotone"
                  dataKey={selectedTrendMetric.dataKey}
                  stroke="#7cecff"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#0b1116", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="app-panel mx-auto w-full max-w-5xl rounded-[30px] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Deck Comparison</p>
            <p className="mt-1 text-sm text-slate-300">Review and quiz performance by deck</p>
          </div>
          <Layers3 className="h-4 w-4 text-cyan-200/70" />
        </div>
        <div className="space-y-3">
          {deckRows.map((row) => (
            <div key={row.deck.id} className="app-surface rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-semibold text-slate-100">{row.deck.name}</p>
                <p className="text-xs text-slate-500">
                  Last studied: {formatRelativeDate(row.lastStudiedTimestamp)}
                </p>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-3 lg:grid-cols-6">
                <div>{row.stats.total} cards</div>
                <div>{row.stats.due} due</div>
                <div>Review: {formatPercent(row.reviewAccuracyRatio)}</div>
                <div>Quiz: {formatPercent(row.quizAccuracyRatio)}</div>
                <div>Mastery: {row.mastery}%</div>
                <div>{row.reviewAttempts + row.quizAttempts} attempts</div>
              </div>
              <div className="mt-3">
                <Progress value={row.mastery} className="h-1.5 bg-slate-800/85" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-2">
        <section className="app-panel rounded-[30px] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Quiz Diagnostics</p>
              <p className="mt-1 text-sm text-slate-300">Skill verification breakdown</p>
            </div>
            <BarChart3 className="h-4 w-4 text-cyan-200/70" />
          </div>
          <div className="space-y-3">
            <DiagnosticRow label="Overall accuracy" value={quizSnapshot.overall.accuracy} attempts={quizSnapshot.overall.attempts} />
            <DiagnosticRow label="Meaning" value={quizSnapshot.bySkill.meaning.accuracy} attempts={quizSnapshot.bySkill.meaning.attempts} />
            <DiagnosticRow label="Pinyin" value={quizSnapshot.bySkill.pinyin.accuracy} attempts={quizSnapshot.bySkill.pinyin.attempts} />
            <DiagnosticRow label="Audio" value={quizSnapshot.bySkill.audio.accuracy} attempts={quizSnapshot.bySkill.audio.attempts} />
            <DiagnosticRow label="Writing" value={quizSnapshot.bySkill.writing.accuracy} attempts={quizSnapshot.bySkill.writing.attempts} />
          </div>
        </section>

        <section className="app-panel rounded-[30px] p-4 sm:p-5">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Weak Areas</p>
            <p className="mt-1 text-sm text-slate-300">Cards and skills needing attention</p>
          </div>

          <div className="app-surface rounded-2xl p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Most missed in quiz</p>
            <div className="mt-2 space-y-2">
              {quizSnapshot.mostMissedCards.slice(0, 4).map((item) => (
                <div key={`${item.deckId}-${item.cardId}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{cardMap.get(item.cardId)?.front || "Unknown card"}</span>
                  <span className="text-slate-400">{item.misses} misses</span>
                </div>
              ))}
              {quizSnapshot.mostMissedCards.length === 0 && (
                <p className="text-sm text-slate-500">No missed quiz cards yet.</p>
              )}
            </div>
          </div>

          <div className="mt-3 app-surface rounded-2xl p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Cards failing verification cycles</p>
            <div className="mt-2 space-y-2">
              {failedVerificationCards.slice(0, 4).map((entry) => (
                <div key={`fail-cycle-${entry.cardId}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{cardMap.get(entry.cardId)?.front || "Unknown card"}</span>
                  <span className="text-slate-400">{entry.count} failed cycles</span>
                </div>
              ))}
              {failedVerificationCards.length === 0 && (
                <p className="text-sm text-slate-500">No failed verification cycles yet.</p>
              )}
            </div>
          </div>

          <div className="mt-3 app-surface rounded-2xl p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Cards needing repeated study-quiz loops</p>
            <div className="mt-2 space-y-2">
              {repeatedQuizLoopCards.slice(0, 4).map((entry) => (
                <div key={`loop-${entry.cardId}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{cardMap.get(entry.cardId)?.front || "Unknown card"}</span>
                  <span className="text-slate-400">{entry.maxLoopCount} loops</span>
                </div>
              ))}
              {repeatedQuizLoopCards.length === 0 && (
                <p className="text-sm text-slate-500">No repeated study-quiz loops yet.</p>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="app-surface rounded-2xl p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weakest deck</p>
              <p className="mt-2 text-sm text-slate-200">
                {weakestDeck ? weakestDeck.row.deck.name : "Insufficient data"}
              </p>
            </div>
            <div className="app-surface rounded-2xl p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Weakest quiz type</p>
              <p className="mt-2 text-sm text-slate-200">
                {weakestSkill ? weakestSkill.skill : "Insufficient data"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[1.2fr,1fr]">
        <section className="app-panel rounded-[30px] p-4 sm:p-5">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Workload Forecast</p>
            <p className="mt-1 text-sm text-slate-300">Plan upcoming review load</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <ForecastMetric label="Due today" value={`${dueToday}`} />
            <ForecastMetric label="Due tomorrow" value={`${dueTomorrow}`} />
            <ForecastMetric label="Due this week" value={`${dueThisWeek}`} />
            <ForecastMetric label="Recent new cards" value={`${recentNewCards}`} />
            <ForecastMetric label="Projected weekly load" value={`${projectedWeeklyLoad}`} />
          </div>

          <div className="mt-4 app-surface rounded-2xl p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next 7 days</p>
            <div className="mt-3 space-y-2">
              {forecastRows.map((row) => {
                const max = Math.max(...forecastRows.map((item) => item.due), 1);
                const width = (row.due / max) * 100;
                return (
                  <div key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                        <span>{row.label}</span>
                        <span>{row.due}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800/90">
                        <div
                          className="h-1.5 rounded-full bg-cyan-300/75"
                          style={{
                            width: `${row.due === 0 ? 0 : Math.max(6, width)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="app-panel rounded-[30px] p-4 sm:p-5">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Insights</p>
            <p className="mt-1 text-sm text-slate-300">Interpretation across review and quiz signals</p>
          </div>
          <div className="app-surface rounded-2xl p-4">
            <ul className="space-y-2 text-sm leading-6 text-slate-200">
              {insightLines.map((line, index) => (
                <li key={`${line}-${index}`} className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                  {line}
                </li>
              ))}
              {insightLines.length === 0 && (
                <li className="text-slate-500">
                  Complete a few review and quiz sessions to unlock personalized insights.
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="app-surface rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <Icon className="h-3.5 w-3.5 text-cyan-200/80" />
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function DiagnosticRow({
  label,
  value,
  attempts,
}: {
  label: string;
  value: number;
  attempts: number;
}) {
  const percent = Math.round((value || 0) * 100);
  return (
    <div className="app-surface rounded-2xl p-3">
      <div className="flex items-center justify-between text-sm text-slate-200">
        <span>{label}</span>
        <span>{attempts} attempts</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={percent} className="h-1.5 flex-1 bg-slate-800/85" />
        <span className="text-xs text-slate-400">{percent}%</span>
      </div>
    </div>
  );
}

function ForecastMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-surface rounded-2xl p-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-100">{value}</p>
    </div>
  );
}
