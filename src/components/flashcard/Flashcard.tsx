"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  CircleHelp,
  GraduationCap,
  RotateCw,
  Undo2,
  Volume2,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  deriveCoreExample,
  deriveCorePair,
  deriveDisplayPairs,
  deriveRelatedExamples,
} from "@/lib/flashcard-practice";
import * as flashcardDb from "@/lib/flashcard-db";
import { convertPinyinTones, getToneColor } from "@/lib/pinyin";
import { cancelSpeech, speakText } from "@/lib/tts";
import {
  calculateNextReview,
  calculateNextReviewTime,
} from "@/lib/srs";
import { Progress } from "@/components/ui/progress";
import type {
  Card as CardType,
  CardExample,
  QuizAssessmentResult,
  QuizPerformanceEvent,
  QuizPerformanceInput,
  QuizSkillType,
  Rating,
} from "@/types";
import type { PairItem } from "@/lib/ai/types";
import type { SpeakTextOptions } from "@/lib/tts";
import PracticeCanvas from "./PracticeCanvas";

interface FlashcardProps {
  card: CardType;
  onRate: (cardId: string, rating: Rating, updates: Partial<CardType>) => void;
  onRecordQuizResult?: (input: QuizPerformanceInput) => void | Promise<void>;
  onTTS?: (text: string, options?: Partial<SpeakTextOptions>) => void;
  hasDedicatedChineseVoice?: boolean;
  previewMode?: boolean;
  sessionProgress?: {
    current: number;
    total: number;
  };
  onExitSession?: () => void;
}

type PracticeRevealMode =
  | "hidden"
  | "character"
  | "meaning"
  | "audio"
  | "pinyin";
type StudyCueMode = Exclude<PracticeRevealMode, "hidden">;
type FlashcardView = "flashcard" | "quiz" | "related";
type QuizSelfAssessment = "study_again" | "recalled_slowly" | "recalled_cleanly";

interface QuizAxisCycleResult {
  key: string;
  label: string;
  skillType: QuizSkillType;
  assessment: QuizSelfAssessment;
  score: number;
  revealCount: number;
  audioReplayCount: number;
}

interface QuizCycleResult {
  axes: QuizAxisCycleResult[];
  totalScore: number;
  passed: boolean;
  failedSkills: QuizSkillType[];
}

const QUIZ_ASSESSMENT_SCORE: Record<QuizSelfAssessment, number> = {
  study_again: 0,
  recalled_slowly: 1,
  recalled_cleanly: 2,
};

const VIEWED_CARD_STORAGE_KEY = "neonlang:viewed-cards-v1";
const WEAK_SKILL_PRIORITY: QuizSkillType[] = [
  "meaning",
  "pinyin",
  "audio",
  "writing",
];

function getPriorityIndex(skillType: QuizSkillType): number {
  return WEAK_SKILL_PRIORITY.indexOf(skillType);
}

function getViewedCardSet(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(VIEWED_CARD_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((value) => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function markCardViewed(cardId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const viewedCards = getViewedCardSet();
  const viewedBefore = viewedCards.has(cardId);
  if (!viewedBefore) {
    viewedCards.add(cardId);
    window.localStorage.setItem(
      VIEWED_CARD_STORAGE_KEY,
      JSON.stringify([...viewedCards]),
    );
  }

  return viewedBefore;
}

function getQuizEventAxisScore(event: QuizPerformanceEvent): number {
  if (event.axisScore >= 0 && event.axisScore <= 2) {
    return event.axisScore;
  }

  if (event.assessment === "missed") {
    return 0;
  }
  if (event.assessment === "recalled_slowly" || event.assessment === "approximate") {
    return 1;
  }
  return 2;
}

function chooseDeterministicWeakSkill(
  candidates: QuizSkillType[],
  events: QuizPerformanceEvent[],
): QuizSkillType | null {
  if (candidates.length === 0) {
    return null;
  }

  const weaknessMap = new Map<
    QuizSkillType,
    { weaknessScore: number; latestWeakTimestamp: number }
  >();
  for (const candidate of candidates) {
    weaknessMap.set(candidate, { weaknessScore: 0, latestWeakTimestamp: 0 });
  }

  for (const event of events) {
    if (!weaknessMap.has(event.skillType)) {
      continue;
    }
    const current = weaknessMap.get(event.skillType)!;
    const axisScore = getQuizEventAxisScore(event);
    const weakness = 2 - axisScore;
    current.weaknessScore += weakness;
    if (weakness > 0) {
      current.latestWeakTimestamp = Math.max(
        current.latestWeakTimestamp,
        event.timestamp,
      );
    }
    weaknessMap.set(event.skillType, current);
  }

  const sorted = [...candidates].sort((left, right) => {
    const leftScore = weaknessMap.get(left) || {
      weaknessScore: 0,
      latestWeakTimestamp: 0,
    };
    const rightScore = weaknessMap.get(right) || {
      weaknessScore: 0,
      latestWeakTimestamp: 0,
    };
    if (rightScore.weaknessScore !== leftScore.weaknessScore) {
      return rightScore.weaknessScore - leftScore.weaknessScore;
    }
    if (rightScore.latestWeakTimestamp !== leftScore.latestWeakTimestamp) {
      return rightScore.latestWeakTimestamp - leftScore.latestWeakTimestamp;
    }
    return getPriorityIndex(left) - getPriorityIndex(right);
  });

  return sorted[0] || null;
}

function deriveWeakSkillFromHistory(
  events: QuizPerformanceEvent[],
): QuizSkillType | null {
  if (events.length === 0) {
    return null;
  }

  const latestCycleId = events[0].cycleId;
  const latestCycleEvents = events.filter((event) => event.cycleId === latestCycleId);
  const latestFailedSkills = [
    ...new Set(
      latestCycleEvents
        .filter((event) => event.assessment === "missed")
        .map((event) => event.skillType),
    ),
  ];

  if (latestFailedSkills.length > 0) {
    return chooseDeterministicWeakSkill(latestFailedSkills, events);
  }

  const recentEvents = events.slice(0, 40);
  const perSkill = new Map<
    QuizSkillType,
    { attempts: number; score: number; weakCount: number; lastWeak: number }
  >();

  for (const event of recentEvents) {
    const axisScore = getQuizEventAxisScore(event);
    const current = perSkill.get(event.skillType) || {
      attempts: 0,
      score: 0,
      weakCount: 0,
      lastWeak: 0,
    };
    current.attempts += 1;
    current.score += axisScore;
    if (axisScore < 2) {
      current.weakCount += 1;
      current.lastWeak = Math.max(current.lastWeak, event.timestamp);
    }
    perSkill.set(event.skillType, current);
  }

  const candidates = [...perSkill.entries()]
    .filter(([, value]) => value.attempts > 0)
    .sort((left, right) => {
      const leftAvg = left[1].score / left[1].attempts;
      const rightAvg = right[1].score / right[1].attempts;
      if (leftAvg !== rightAvg) {
        return leftAvg - rightAvg;
      }
      if (right[1].weakCount !== left[1].weakCount) {
        return right[1].weakCount - left[1].weakCount;
      }
      if (right[1].lastWeak !== left[1].lastWeak) {
        return right[1].lastWeak - left[1].lastWeak;
      }
      return getPriorityIndex(left[0]) - getPriorityIndex(right[0]);
    });

  return candidates[0]?.[0] || null;
}

function mapWeakSkillToCue(skillType: QuizSkillType): StudyCueMode {
  if (skillType === "meaning") {
    return "meaning";
  }
  if (skillType === "pinyin") {
    return "pinyin";
  }
  if (skillType === "audio") {
    return "audio";
  }
  return "character";
}

function mapQuizAssessmentToStorage(
  assessment: QuizSelfAssessment,
): QuizAssessmentResult {
  if (assessment === "study_again") {
    return "missed";
  }
  if (assessment === "recalled_slowly") {
    return "recalled_slowly";
  }
  return "recalled_cleanly";
}

function formatQuizSkillLabel(skillType: QuizSkillType): string {
  if (skillType === "meaning") {
    return "Meaning";
  }
  if (skillType === "pinyin") {
    return "Written pinyin";
  }
  if (skillType === "audio") {
    return "Spoken pinyin";
  }
  return "Writing";
}

function mapQuizScoreToRating(score: number): Rating {
  if (score >= 8) {
    return "easy";
  }
  if (score >= 6) {
    return "good";
  }
  return "hard";
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}

function normalizeGrammarUsageLabel(
  grammarName: string | undefined,
  wordClass: string,
): string {
  const trimmed = (grammarName || "").trim();
  if (!trimmed) {
    return "";
  }

  if (
    wordClass.trim().toLowerCase() === "adverb" &&
    trimmed.toLowerCase() === "verb usage"
  ) {
    return "adverb usage";
  }

  return trimmed;
}

function formatPatternText(value: string): string {
  return value.replace(/\+/g, " + ");
}

function sanitizeDisplayMeaning(value: string, word: string): string {
  const trimmed = value.trim();
  if (!trimmed || !word.trim()) {
    return trimmed;
  }

  const escapedWord = escapeRegExp(word.trim());

  return trimmed
    .replace(
      new RegExp(`^${escapedWord}\\s*(?:means|is|refers to)\\s+`, "i"),
      "",
    )
    .replace(new RegExp(`^${escapedWord}\\s*[:：-]\\s*`, "i"), "")
    .trim();
}

function derivePatternLabel(input: {
  grammar: CardExample["grammar"][number] | null;
  pair: PairItem | null;
  wordClass: string;
}): string {
  const normalizedLabel = normalizeGrammarUsageLabel(
    input.grammar?.grammarName,
    input.wordClass,
  );
  if (normalizedLabel) {
    return sentenceCase(normalizedLabel);
  }

  if (input.pair?.meaning) {
    return sentenceCase(input.pair.meaning);
  }

  return "Use a related sentence pattern";
}

function deriveFocusDifference(input: {
  corePattern: string;
  relatedPattern: string;
}): string {
  const pattern = input.relatedPattern;

  if (/把/.test(pattern)) {
    return "This version puts the object before the verb, so attention lands on the thing being handled earlier than in the core use.";
  }

  if (/给/.test(pattern)) {
    return "This version keeps the action together first and adds the receiver afterward, so the sentence saves the destination for later.";
  }

  if (/[跟和]/.test(pattern)) {
    return "This version introduces the other person earlier than the core use, so the listener notices the receiver sooner.";
  }

  if (/一下/.test(pattern)) {
    return "This version softens the action compared with the core use, so it feels lighter and more conversational.";
  }

  if (/[了过着]/.test(pattern)) {
    return "This version adds an aspect marker, so the sentence highlights completion or state more than the core use does.";
  }

  if (/[不没]/.test(pattern)) {
    return "This version shifts the sentence into negation, so the focus changes from the action itself to whether it happens at all.";
  }

  if (pattern && pattern !== input.corePattern) {
    return "This version keeps the same target word but changes the sentence frame, so the learner can compare what the structure highlights first.";
  }

  return "This related example keeps the same target word but gives you another reusable frame to compare after the core use is clear.";
}

function QuizPanel({
  word,
  pinyin,
  meaning,
  onBack,
  onSpeakWord,
  onSpeakPinyin,
  onFinalizeCycle,
  isFinalizing = false,
  loopCount = 0,
  activeStudyCue,
  isPreviewMode = false,
}: {
  word: string;
  pinyin: string;
  meaning: string;
  onBack: () => void;
  onSpeakWord: () => void;
  onSpeakPinyin: () => void;
  onFinalizeCycle: (result: QuizCycleResult) => void | Promise<void>;
  isFinalizing?: boolean;
  loopCount?: number;
  activeStudyCue: PracticeRevealMode;
  isPreviewMode?: boolean;
}) {
  const [revealedAnswers, setRevealedAnswers] = useState<
    Record<string, boolean>
  >({});
  const [revealCounts, setRevealCounts] = useState<Record<string, number>>({});
  const [audioReplayCounts, setAudioReplayCounts] = useState<
    Record<string, number>
  >({});
  const [assessmentByQuestion, setAssessmentByQuestion] = useState<
    Record<string, QuizSelfAssessment>
  >({});
  const [typedResponses, setTypedResponses] = useState<Record<string, string>>(
    {},
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const questions: Array<{
    key: string;
    label: string;
    skillType: QuizSkillType;
    prompt: string;
    answer: string;
    answerToneMarks?: boolean;
  }> = [
    {
      key: "meaning",
      label: "Meaning",
      skillType: "meaning",
      prompt: "Recall the meaning for this target word.",
      answer: meaning,
    },
    {
      key: "pinyin",
      label: "Pinyin",
      skillType: "pinyin",
      prompt: "Recall the written pinyin for this target word.",
      answer: pinyin,
      answerToneMarks: true,
    },
    {
      key: "audio",
      label: "Audio",
      skillType: "audio",
      prompt: "Listen, then recall the pinyin you hear.",
      answer: pinyin,
      answerToneMarks: true,
    },
    {
      key: "writing",
      label: "Writing",
      skillType: "writing",
      prompt: "Write the character for this target word.",
      answer: word,
    },
  ];

  const assessmentOptions: Array<{
    value: QuizSelfAssessment;
    label: string;
    className: string;
  }> = [
    {
      value: "study_again",
      label: "Study again",
      className: "app-action-danger",
    },
    {
      value: "recalled_slowly",
      label: "Recalled slowly",
      className: "app-action-warm",
    },
    {
      value: "recalled_cleanly",
      label: "Recalled cleanly",
      className: "app-action-positive",
    },
  ];

  const toggleReveal = (questionKey: string) => {
    setRevealedAnswers((prev) => {
      const isCurrentlyRevealed = Boolean(prev[questionKey]);
      if (!isCurrentlyRevealed) {
        setRevealCounts((counts) => ({
          ...counts,
          [questionKey]: (counts[questionKey] || 0) + 1,
        }));
      }
      return { ...prev, [questionKey]: !isCurrentlyRevealed };
    });
  };

  const incrementAudioReplayCount = (questionKey: string) => {
    setAudioReplayCounts((prev) => ({
      ...prev,
      [questionKey]: (prev[questionKey] || 0) + 1,
    }));
  };

  const formatAssessmentLabel = (assessment: QuizSelfAssessment | undefined) => {
    if (!assessment) {
      return "";
    }

    if (assessment === "study_again") {
      return "Study again";
    }
    if (assessment === "recalled_cleanly") {
      return "Recalled cleanly";
    }
    if (assessment === "recalled_slowly") {
      return "Recalled slowly";
    }

    return "";
  };

  const cycleResult = useMemo((): QuizCycleResult | null => {
    const allAssessed = questions.every((question) =>
      Boolean(assessmentByQuestion[question.key]),
    );
    if (!allAssessed) {
      return null;
    }

    const axes = questions.map((question) => {
      const assessment = assessmentByQuestion[question.key] as QuizSelfAssessment;
      const score = QUIZ_ASSESSMENT_SCORE[assessment];
      return {
        key: question.key,
        label: question.label,
        skillType: question.skillType,
        assessment,
        score,
        revealCount: Math.max(1, revealCounts[question.key] || 0),
        audioReplayCount: audioReplayCounts[question.key] || 0,
      };
    });
    const totalScore = axes.reduce((sum, axis) => sum + axis.score, 0);
    const failedSkills = axes
      .filter((axis) => axis.assessment === "study_again")
      .map((axis) => axis.skillType);

    return {
      axes,
      totalScore,
      passed: failedSkills.length === 0,
      failedSkills,
    };
  }, [assessmentByQuestion, audioReplayCounts, questions, revealCounts]);

  const isCycleComplete = currentQuestionIndex >= questions.length;
  const currentQuestion = isCycleComplete
    ? null
    : questions[currentQuestionIndex] || null;

  const currentAssessment = currentQuestion
    ? assessmentByQuestion[currentQuestion.key]
    : undefined;
  const currentRevealed = currentQuestion
    ? Boolean(revealedAnswers[currentQuestion.key])
    : false;
  const canContinue =
    Boolean(currentQuestion) && currentRevealed && Boolean(currentAssessment);

  const continueToNextQuestion = useCallback(() => {
    if (!canContinue || !currentQuestion) {
      return;
    }
    if (currentQuestionIndex >= questions.length - 1) {
      if (isPreviewMode) {
        onBack();
        return;
      }
      setCurrentQuestionIndex(questions.length);
      return;
    }
    setCurrentQuestionIndex((previous) => previous + 1);
  }, [
    canContinue,
    currentQuestion,
    currentQuestionIndex,
    isPreviewMode,
    onBack,
    questions.length,
  ]);

  const goToPreviousQuestion = useCallback(() => {
    setCurrentQuestionIndex((previous) => Math.max(0, previous - 1));
  }, []);

  const handleCycleAction = useCallback(() => {
    if (!cycleResult || isFinalizing) {
      return;
    }

    Promise.resolve(onFinalizeCycle(cycleResult)).catch((error) => {
      console.error("Failed to finalize quiz cycle:", error);
    });
  }, [cycleResult, isFinalizing, onFinalizeCycle]);

  return (
    <div className="app-panel rounded-2xl p-6 md:p-8">
      <div className="mb-5 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="app-action"
        >
          <Undo2 className="mr-2 h-4 w-4" />
          {isPreviewMode ? "Back to preview" : "Back"}
        </Button>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold uppercase tracking-[0.24em] text-slate-300 md:text-xl">
          Quiz
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Think first, then reveal. Mark each result before moving on.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {!isCycleComplete && currentQuestion && (
          <div className="app-surface rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="app-chip-neon rounded-full px-2 py-1 text-xs uppercase tracking-[0.16em]">
                  {currentQuestion.label}
                </span>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  {currentQuestionIndex + 1}/{questions.length}
                </span>
              </div>
              {currentQuestion.skillType === "audio" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    incrementAudioReplayCount(currentQuestion.key);
                    onSpeakPinyin();
                  }}
                  disabled={isFinalizing}
                  className="app-action"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Play audio
                </Button>
              )}
            </div>

            <p className="text-sm leading-6 text-slate-200">
              {currentQuestion.prompt}
            </p>
            {(currentQuestion.skillType === "meaning" ||
              currentQuestion.skillType === "pinyin") && (
              <div className="mt-4">
                <label
                  htmlFor={`quiz-input-${currentQuestion.key}`}
                  className="text-xs uppercase tracking-[0.16em] text-slate-500"
                >
                  Your answer
                </label>
                <input
                  id={`quiz-input-${currentQuestion.key}`}
                  type="text"
                  value={typedResponses[currentQuestion.key] || ""}
                  onChange={(event) =>
                    setTypedResponses((previous) => ({
                      ...previous,
                      [currentQuestion.key]: event.target.value,
                    }))
                  }
                  placeholder={
                    currentQuestion.skillType === "meaning"
                      ? "Type the meaning"
                      : "Type the pinyin"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  disabled={isFinalizing}
                  className="app-field mt-2 h-11 w-full rounded-xl px-3 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/45"
                />
              </div>
            )}
            {currentQuestion.skillType !== "writing" && (
              <p className="mt-3 text-sm text-slate-400">
                {currentQuestion.skillType === "audio"
                  ? "Use reveal only after trying from memory or speaking."
                  : "Use reveal only after trying from memory or typing."}
              </p>
            )}
            {currentQuestion.skillType === "writing" && (
              <div className="mt-4">
                {activeStudyCue === "audio" && (
                  <div className="mb-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!currentQuestion) {
                          return;
                        }
                        incrementAudioReplayCount(currentQuestion.key);
                        onSpeakWord();
                      }}
                      disabled={isFinalizing}
                      className="app-action"
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      Play cue audio
                    </Button>
                  </div>
                )}
                <p className="mb-3 text-sm text-slate-400">
                  Use reveal only after trying from memory or writting.
                </p>
                <div className="flex justify-center">
                  <PracticeCanvas
                    character={word}
                    width={260}
                    height={260}
                    showTemplate
                    showGrid
                  />
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleReveal(currentQuestion.key)}
                disabled={isFinalizing}
                className="app-action"
              >
                {revealedAnswers[currentQuestion.key]
                  ? "Hide answer"
                  : "Show answer"}
              </Button>
            </div>
            {revealedAnswers[currentQuestion.key] && (
              <div className="app-chip-positive mt-3 rounded-xl p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Expected answer
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-50">
                  {currentQuestion.answerToneMarks
                    ? convertPinyinTones(currentQuestion.answer)
                    : currentQuestion.answer}
                </p>

                <div className="mt-4 border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                    Mark recall
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {assessmentOptions.map((option) => (
                      <Button
                        key={`${currentQuestion.key}-${option.value}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setAssessmentByQuestion((previous) => ({
                            ...previous,
                            [currentQuestion.key]: option.value,
                          }))
                        }
                        className={
                          assessmentByQuestion[currentQuestion.key] === option.value
                            ? option.className
                            : "app-action"
                        }
                        disabled={isFinalizing}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {assessmentByQuestion[currentQuestion.key] && (
                    <p className="mt-2 text-xs text-cyan-100/80">
                      Marked:{" "}
                      {formatAssessmentLabel(assessmentByQuestion[currentQuestion.key])}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentQuestionIndex === 0 || isFinalizing}
                onClick={goToPreviousQuestion}
                className="app-action"
              >
                Previous question
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canContinue || isFinalizing}
                onClick={continueToNextQuestion}
                className={canContinue ? "app-action-neon" : "app-action"}
              >
                {currentQuestionIndex >= questions.length - 1
                  ? isPreviewMode
                    ? "Back to preview"
                    : "Finish verification"
                  : "Next question"}
              </Button>
            </div>
          </div>
        )}

        {!isPreviewMode && isCycleComplete && cycleResult && (
          <div className="app-surface rounded-2xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">
              Verification summary
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Cycle {loopCount + 1}
            </p>
            <div className="mt-3 space-y-2">
              {cycleResult.axes.map((axis) => (
                <div
                  key={`cycle-axis-${axis.key}`}
                  className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="text-slate-200">{axis.label}</span>
                  <span className="text-slate-300">
                    {formatAssessmentLabel(axis.assessment)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-cyan-300/14 bg-cyan-300/[0.05] px-3 py-2">
              <p className="text-sm text-slate-100">
                {cycleResult.passed
                  ? "This word passed verification."
                  : "This word still needs review before it can pass."}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Score: {cycleResult.totalScore}/8
                {cycleResult.passed
                  ? cycleResult.totalScore >= 8
                    ? " - Strong pass"
                    : cycleResult.totalScore >= 6
                      ? " - Normal pass"
                      : " - Weak pass"
                  : " - Retry after focused study"}
              </p>
            </div>
            <div className="mt-4">
              <Button
                type="button"
                onClick={handleCycleAction}
                disabled={isFinalizing}
                className={cycleResult.passed ? "app-action-neon w-full" : "app-action w-full"}
              >
                {isFinalizing
                  ? "Applying..."
                  : cycleResult.passed
                    ? "Next word"
                    : "Study again"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}

function ExampleTokens({
  example,
  onSpeakToken,
}: {
  example: CardExample;
  onSpeakToken: (text: string) => void;
}) {
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedToken =
    selectedTokenIndex === null ? null : example.tokens[selectedTokenIndex];

  useEffect(() => {
    if (selectedTokenIndex === null) {
      return;
    }

    let pointerDownX = 0;
    let pointerDownY = 0;
    let trackingPointer = false;
    let moved = false;
    const movementThresholdPx = 9;

    const handlePointerDown = (event: PointerEvent) => {
      trackingPointer = true;
      moved = false;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!trackingPointer || moved) {
        return;
      }

      const deltaX = Math.abs(event.clientX - pointerDownX);
      const deltaY = Math.abs(event.clientY - pointerDownY);
      if (deltaX > movementThresholdPx || deltaY > movementThresholdPx) {
        moved = true;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!trackingPointer) {
        return;
      }

      trackingPointer = false;
      if (moved) {
        return;
      }

      const targetNode = event.target as HTMLElement | null;
      if (!targetNode) {
        return;
      }

      if (targetNode.closest('[data-token-button="true"]')) {
        return;
      }

      if (targetNode.closest('[data-token-keep-open="true"]')) {
        return;
      }

      if (!containerRef.current?.contains(targetNode)) {
        setSelectedTokenIndex(null);
        return;
      }

      if (targetNode.closest('[data-token-inspection="true"]')) {
        setSelectedTokenIndex(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, [selectedTokenIndex]);

  if (example.tokens.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {example.tokens.map((token, index) => {
          const isSelected = selectedToken?.index === token.index;

          return (
            <button
              key={`${example.exampleIndex}-token-${token.index}-${token.text}`}
              type="button"
              onClick={() => setSelectedTokenIndex(index)}
              data-token-button="true"
              className={`rounded-lg border px-2.5 py-1.5 font-chinese-ui text-lg transition-colors ${
                isSelected
                  ? "border-cyan-300/40 bg-cyan-300/10 text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-100 hover:border-cyan-300/25 hover:bg-cyan-300/8"
              }`}
            >
              {token.text}
            </button>
          );
        })}
      </div>

      {selectedToken && (
        <div className="app-field rounded-xl p-3" data-token-inspection="true">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-chinese-ui text-2xl text-white">
                {selectedToken.text}
              </p>
              <p className="mt-1 text-sm text-cyan-200/90">
                {convertPinyinTones(selectedToken.pinyin)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSpeakToken(selectedToken.text)}
              data-token-keep-open="true"
              className="app-action"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              Listen
            </Button>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {selectedToken.meaning}
          </p>
        </div>
      )}
    </div>
  );
}

function PhraseDetailPanel({
  example,
  pair,
  wordClass,
  fallbackGrammar,
  onSpeakSentence,
  onSpeakToken,
}: {
  example: CardExample;
  pair: PairItem | null;
  wordClass: string;
  fallbackGrammar?: CardExample["grammar"][number] | null;
  onSpeakSentence: (sentence: string) => void;
  onSpeakToken: (text: string) => void;
}) {
  const grammar = example.grammar[0] || fallbackGrammar || null;
  const sentenceType =
    normalizeGrammarUsageLabel(grammar?.grammarName, wordClass) ||
    "main sentence";
  const pattern = formatPatternText(
    grammar?.structure || pair?.composition || example.pairText,
  );
  const whyToUse =
    grammar?.whyToUse ||
    "It gives you a stable first pattern to remember before you compare other sentence structures.";
  const phraseFunction =
    grammar?.function ||
    `${pair?.text || example.pairText} is the reusable phrase chunk that carries the main idea in this sentence.`;
  const analysis =
    grammar?.explanation ||
    `${pair?.text || example.pairText} gives you a natural first model for this word in context. Learn this stable use first, then open the related pattern section only when you want to compare other sentence frames.`;

  return (
    <div className="app-surface space-y-5 rounded-2xl p-4 sm:p-5">
      <div className="app-surface rounded-2xl p-3.5 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              <span className="app-chip-neon rounded-full px-2 py-1 text-cyan-100">
                Main sentence
              </span>
              <span className="app-chip rounded-full px-2 py-1 text-slate-300">
                {sentenceType}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSpeakSentence(example.sentence)}
                className="app-action h-8 px-3 normal-case tracking-normal"
              >
                <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                Listen
              </Button>
            </div>
            <p className="mt-2 font-chinese-ui text-[1.18rem] leading-snug text-white [word-break:break-all] sm:text-2xl sm:[word-break:normal]">
              {example.sentence}
            </p>
          </div>
        </div>
        <p className="mt-2 text-cyan-200/90">
          {convertPinyinTones(example.pinyin)}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {example.translation}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
          Tap a sentence token to inspect it
        </p>
        <ExampleTokens
          key={`example-tokens-${example.exampleIndex}`}
          example={example}
          onSpeakToken={onSpeakToken}
        />
      </div>

      <div className="app-surface rounded-2xl p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-100">
          <CircleHelp className="h-4 w-4 text-slate-400" />
          Sentence detail
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Why to use" value={whyToUse} />
          <DetailField label="Pattern" value={pattern} />
          <DetailField label="Function" value={phraseFunction} />
        </div>
        <div className="mt-4">
          <DetailField label="Analysis" value={analysis} />
        </div>
      </div>
    </div>
  );
}

function RelatedPatternExplorer({
  coreExample,
  corePair,
  relatedExamples,
  pairs,
  wordClass,
  onSpeakSentence,
}: {
  coreExample: CardExample;
  corePair: PairItem | null;
  relatedExamples: CardExample[];
  pairs: PairItem[];
  wordClass: string;
  onSpeakSentence: (sentence: string) => void;
}) {
  if (relatedExamples.length === 0) {
    return null;
  }

  const corePattern = formatPatternText(
    coreExample.grammar[0]?.structure ||
      corePair?.composition ||
      coreExample.pairText,
  );

  return (
    <div className="app-surface rounded-2xl p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-200">Grammar</p>
        <p className="text-sm leading-6 text-slate-400">
          Open these after the main sentence feels clear. Each panel shows one
          related sentence pattern for comparison.
        </p>
      </div>

      <Accordion type="single" collapsible className="mt-4 space-y-2">
        {relatedExamples.map((example) => {
          const pair =
            pairs.find(
              (candidate) =>
                normalizeText(candidate.text) ===
                normalizeText(example.pairText),
            ) || null;
          const grammar = example.grammar[0] || null;
          const relatedPattern = formatPatternText(
            grammar?.structure || pair?.composition || example.pairText,
          );
          const label = derivePatternLabel({ grammar, pair, wordClass });
          const focusDifference = deriveFocusDifference({
            corePattern,
            relatedPattern,
          });

          return (
            <AccordionItem
              key={`${example.exampleIndex}-${example.pairText}`}
              value={`related-${example.exampleIndex}`}
              className="app-surface rounded-xl px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="space-y-1 text-left">
                  <p className="text-sm font-medium text-slate-100">{label}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {relatedPattern}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="app-surface rounded-xl p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Why this pattern exists
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {grammar?.whyToUse ||
                        pair?.meaning ||
                        "This gives the word a different reusable sentence frame."}
                    </p>
                  </div>
                  <div className="app-surface rounded-xl p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Difference in focus
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {focusDifference}
                    </p>
                  </div>
                </div>

                <div className="app-surface rounded-xl p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                        Sentence
                      </p>
                      <p className="mt-2 font-chinese-ui text-[1.08rem] leading-snug text-white [word-break:break-all] sm:text-xl sm:[word-break:normal]">
                        {example.sentence}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSpeakSentence(example.sentence)}
                      className="app-action w-fit shrink-0 self-start"
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      Listen
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-cyan-200/90">
                    {convertPinyinTones(example.pinyin)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {example.translation}
                  </p>
                </div>

                {grammar && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <DetailField label="Pattern" value={relatedPattern} />
                    <DetailField label="Why to use" value={grammar.whyToUse} />
                    <DetailField label="Function" value={grammar.function} />
                    <DetailField label="Analysis" value={grammar.explanation} />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function QuickViewPanel({
  word,
  pinyin,
  meaning,
  onBack,
  onSpeakWord,
  onSpeakPinyin,
  onFinalizeCycle,
  isFinalizing,
  loopCount,
  activeStudyCue,
  isPreviewMode,
}: {
  word: string;
  pinyin: string;
  meaning: string;
  onBack: () => void;
  onSpeakWord: () => void;
  onSpeakPinyin: () => void;
  onFinalizeCycle: (result: QuizCycleResult) => void | Promise<void>;
  isFinalizing: boolean;
  loopCount: number;
  activeStudyCue: PracticeRevealMode;
  isPreviewMode: boolean;
}) {
  return (
    <QuizPanel
      word={word}
      pinyin={pinyin}
      meaning={meaning}
      onBack={onBack}
      onSpeakWord={onSpeakWord}
      onSpeakPinyin={onSpeakPinyin}
      onFinalizeCycle={onFinalizeCycle}
      isFinalizing={isFinalizing}
      loopCount={loopCount}
      activeStudyCue={activeStudyCue}
      isPreviewMode={isPreviewMode}
    />
  );
}

function RelatedUsagePanel({
  word,
  pinyin,
  meaning,
  toneClass,
  wordClass,
  coreExample,
  corePair,
  relatedExamples,
  pairs,
  onBack,
  onSpeakSentence,
}: {
  word: string;
  pinyin: string;
  meaning: string;
  toneClass: string;
  wordClass: string;
  coreExample: CardExample;
  corePair: PairItem | null;
  relatedExamples: CardExample[];
  pairs: PairItem[];
  onBack: () => void;
  onSpeakSentence: (sentence: string) => void;
}) {
  return (
    <div className="app-panel mx-auto w-full max-w-[980px] rounded-2xl p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08]"
        >
          Back to Flashcard
        </Button>
      </div>

      <div className="text-center">
        <p className="text-lg font-semibold uppercase tracking-[0.24em] text-slate-300 md:text-xl">
          Grammar
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Optional section: explore related sentence patterns to see how this
          word changes across different grammar frames.
        </p>
      </div>

      <div className="app-surface mt-6 rounded-2xl p-5 text-center">
        <p className={`font-chinese-ui text-4xl font-extrabold md:text-5xl ${toneClass}`}>
          {word}
        </p>
        <p className="mt-2 text-lg text-cyan-200/90">
          {convertPinyinTones(pinyin)}
        </p>
        <p className="mt-2 text-base text-slate-200">{meaning}</p>
      </div>

      <div className="mt-6">
        <RelatedPatternExplorer
          coreExample={coreExample}
          corePair={corePair}
          relatedExamples={relatedExamples}
          pairs={pairs}
          wordClass={wordClass}
          onSpeakSentence={onSpeakSentence}
        />
      </div>
    </div>
  );
}

export default function Flashcard({
  card,
  onRate,
  onRecordQuizResult,
  onTTS,
  hasDedicatedChineseVoice = true,
  previewMode = false,
  sessionProgress,
  onExitSession,
}: FlashcardProps) {
  const [activeView, setActiveView] = useState<FlashcardView>("flashcard");
  const [viewTransitionPhase, setViewTransitionPhase] = useState<
    "idle" | "leaving" | "entering"
  >("idle");
  const [isFlipped, setIsFlipped] = useState(false);
  const [practiceRevealMode, setPracticeRevealMode] =
    useState<PracticeRevealMode>("hidden");
  const [selectedStudyCue, setSelectedStudyCue] = useState<StudyCueMode | null>(
    null,
  );
  const [isFirstCardView, setIsFirstCardView] = useState(true);
  const [quizLoopCount, setQuizLoopCount] = useState(0);
  const [weakQuizSkills, setWeakQuizSkills] = useState<QuizSkillType[]>([]);
  const [isApplyingQuizResult, setIsApplyingQuizResult] = useState(false);
  const [isCueAudioLocked, setIsCueAudioLocked] = useState(false);
  const cuePanelRef = useRef<HTMLDivElement | null>(null);
  const practiceBoardRef = useRef<HTMLDivElement | null>(null);
  const viewTransitionTimeoutRef = useRef<number | null>(null);

  const isTTSAvailable =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const speakFromCard = useCallback(
    (
      text: string,
      debugSource = "flashcard",
      extraOptions?: Partial<SpeakTextOptions>,
    ) => {
      const trimmedText = text.trim();
      if (!trimmedText || !isTTSAvailable) {
        return;
      }

      if (onTTS) {
        onTTS(trimmedText, { debugSource, ...extraOptions });
        return;
      }

      void speakText(trimmedText, {
        lang: "zh-CN",
        rate: 0.9,
        debugSource,
        ...extraOptions,
      });
    },
    [isTTSAvailable, onTTS],
  );

  const speakPinyin = useCallback(() => {
    const trimmedWord = card.front.trim();
    if (!trimmedWord || !isTTSAvailable) {
      return;
    }

    speakFromCard(trimmedWord, "quiz-pinyin");
  }, [card.front, isTTSAvailable, speakFromCard]);

  const handleRate = useCallback(
    (rating: Rating) => {
      if (previewMode) {
        return;
      }

      const srsResult = calculateNextReview(card, rating);
      const updates: Partial<CardType> = {
        ...srsResult,
        nextReview: calculateNextReviewTime(srsResult.interval),
        lastReview: Date.now(),
      };
      onRate(card.id, rating, updates);
      setIsFlipped(false);
    },
    [card, onRate, previewMode],
  );

  useEffect(() => {
    if (previewMode) {
      return;
    }

    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return true;
      }

      if (target.isContentEditable) {
        return true;
      }

      const editableAncestor = target.closest(
        "input, textarea, select, [contenteditable='true']",
      );
      return Boolean(editableAncestor);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (activeView !== "flashcard") {
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setIsFlipped((prev) => !prev);
        return;
      }

      if (!isFlipped) {
        return;
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setIsFlipped(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, isFlipped, previewMode]);

  const toneClass = useMemo(() => {
    const toneMatch = card.pinyin.match(/(\d)(?:\s|$)/);
    if (!toneMatch) {
      return "text-cyan-300";
    }

    return getToneColor(Number.parseInt(toneMatch[1], 10));
  }, [card.pinyin]);

  const displayPairs = useMemo(
    () => deriveDisplayPairs(card.front, card.pairs),
    [card.front, card.pairs],
  );
  const displayMeaning = useMemo(
    () => sanitizeDisplayMeaning(card.meaning, card.front),
    [card.front, card.meaning],
  );
  const corePair = useMemo(
    () => deriveCorePair(card.front, card.pairs),
    [card.front, card.pairs],
  );
  const coreExample = useMemo(
    () =>
      deriveCoreExample({
        word: card.front,
        pairs: card.pairs,
        examples: card.examples,
      }),
    [card.examples, card.front, card.pairs],
  );
  const relatedExamples = useMemo(
    () =>
      deriveRelatedExamples({
        word: card.front,
        pairs: card.pairs,
        examples: card.examples,
      }),
    [card.examples, card.front, card.pairs],
  );
  const fallbackCoreGrammar = card.grammarNotes[0] || null;
  const progressPercent =
    sessionProgress && sessionProgress.total > 0
      ? (sessionProgress.current / sessionProgress.total) * 100
      : 0;
  const hidePracticeCue = useCallback(() => {
    if (isCueAudioLocked) {
      return;
    }
    cancelSpeech();
    setPracticeRevealMode("hidden");
  }, [isCueAudioLocked]);

  const waitForSpeechIdle = useCallback(async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const synth = window.speechSynthesis;
    let observedSpeech = false;
    const startedAt = Date.now();

    // Keep the cue locked while speech is pending/speaking.
    while (Date.now() - startedAt < 16_000) {
      const isSpeaking = synth.speaking || synth.pending;
      if (isSpeaking) {
        observedSpeech = true;
      }

      if (observedSpeech && !isSpeaking) {
        return;
      }

      // If speech never starts, release lock after a short startup window.
      if (!observedSpeech && Date.now() - startedAt > 1_800) {
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
  }, []);

  const revealPracticeCue = useCallback(
    (mode: StudyCueMode) => {
      if (isCueAudioLocked) {
        return;
      }

      if (mode === "audio") {
        setSelectedStudyCue("audio");
        setIsCueAudioLocked(true);
        speakFromCard(card.front, "practice-word-audio");
        void waitForSpeechIdle().finally(() => {
          setIsCueAudioLocked(false);
        });
        return;
      }

      cancelSpeech();
      setSelectedStudyCue(mode);
      setPracticeRevealMode((previousMode) =>
        previousMode === mode ? "hidden" : mode,
      );
    },
    [card.front, isCueAudioLocked, speakFromCard, waitForSpeechIdle],
  );
  const hasRelatedUsageView = Boolean(coreExample && relatedExamples.length > 0);
  const isViewTransitioning = viewTransitionPhase !== "idle";

  const transitionToView = useCallback(
    (nextView: FlashcardView) => {
      if (nextView === activeView || isViewTransitioning) {
        return;
      }

      if (viewTransitionTimeoutRef.current !== null) {
        window.clearTimeout(viewTransitionTimeoutRef.current);
      }

      setViewTransitionPhase("leaving");
      viewTransitionTimeoutRef.current = window.setTimeout(() => {
        setActiveView(nextView);
        setViewTransitionPhase("entering");
        viewTransitionTimeoutRef.current = window.setTimeout(() => {
          setViewTransitionPhase("idle");
          viewTransitionTimeoutRef.current = null;
        }, 260);
      }, 180);
    },
    [activeView, isViewTransitioning],
  );

  const handleFinalizeQuizCycle = useCallback(
    async (cycle: QuizCycleResult) => {
      if (isApplyingQuizResult) {
        return;
      }

      setIsApplyingQuizResult(true);

      try {
        const nextLoopCount = quizLoopCount + 1;
        const cycleId = `${card.id}-${Date.now()}-${nextLoopCount}`;

        if (onRecordQuizResult) {
          await Promise.all(
            cycle.axes.map((axis) =>
              onRecordQuizResult({
                cardId: card.id,
                deckId: card.deckId,
                skillType: axis.skillType,
                cycleId,
                cycleScore: cycle.totalScore,
                cyclePassed: cycle.passed,
                studyLoopCount: nextLoopCount,
                axisScore: axis.score,
                revealed: true,
                assessment: mapQuizAssessmentToStorage(axis.assessment),
                isCorrect: axis.assessment !== "study_again",
                isCleanRecall: axis.assessment === "recalled_cleanly",
                revealCount: axis.revealCount,
                audioReplayCount: axis.audioReplayCount,
              }),
            ),
          );
        }

        if (!cycle.passed) {
          setQuizLoopCount(nextLoopCount);
          setWeakQuizSkills(cycle.failedSkills);
          const prioritizedFailedSkill = chooseDeterministicWeakSkill(
            cycle.failedSkills,
            cycle.axes.map((axis) => ({
              id: `${cycleId}-${axis.key}`,
              cardId: card.id,
              deckId: card.deckId,
              skillType: axis.skillType,
              cycleId,
              cycleScore: cycle.totalScore,
              cyclePassed: cycle.passed,
              studyLoopCount: nextLoopCount,
              axisScore: axis.score,
              timestamp: Date.now(),
              revealed: true,
              assessment: mapQuizAssessmentToStorage(axis.assessment),
              isCorrect: axis.assessment !== "study_again",
              isCleanRecall: axis.assessment === "recalled_cleanly",
              revealCount: axis.revealCount,
              audioReplayCount: axis.audioReplayCount,
            })),
          );
          if (prioritizedFailedSkill) {
            const cue = mapWeakSkillToCue(prioritizedFailedSkill);
            setSelectedStudyCue(cue);
            setPracticeRevealMode(cue);
            if (cue === "audio") {
              speakFromCard(card.front, "practice-post-fail-audio-cue");
            }
          }
          setIsFlipped(false);
          transitionToView("flashcard");
          return;
        }

        setWeakQuizSkills([]);
        setQuizLoopCount(0);
        const rating = mapQuizScoreToRating(cycle.totalScore);
        handleRate(rating);
      } catch (error) {
        console.error("Failed to apply quiz cycle:", error);
      } finally {
        setIsApplyingQuizResult(false);
      }
    },
    [
      card.deckId,
      card.front,
      card.id,
      handleRate,
      isApplyingQuizResult,
      onRecordQuizResult,
      quizLoopCount,
      speakFromCard,
      transitionToView,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    setWeakQuizSkills([]);
    setQuizLoopCount(0);
    setSelectedStudyCue(null);
    setPracticeRevealMode("hidden");
    setIsCueAudioLocked(false);
    setIsFirstCardView(true);

    if (previewMode) {
      return () => {
        cancelled = true;
      };
    }

    const viewedBefore = markCardViewed(card.id);
    setIsFirstCardView(!viewedBefore);

    if (!viewedBefore) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const history = await flashcardDb.getQuizPerformanceEvents({
          cardId: card.id,
        });
        if (cancelled) {
          return;
        }

        const weakestSkill = deriveWeakSkillFromHistory(history);
        if (!weakestSkill) {
          return;
        }

        const recommendedCue = mapWeakSkillToCue(weakestSkill);
        setSelectedStudyCue(recommendedCue);
        setPracticeRevealMode(recommendedCue);
        if (recommendedCue === "audio") {
          speakFromCard(card.front, "practice-auto-audio-cue");
        }
      } catch (error) {
        console.error("Failed to derive adaptive study cue:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card.id, card.front, previewMode, speakFromCard]);

  useEffect(() => {
    if (practiceRevealMode === "hidden") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) {
        return;
      }

      if (
        targetNode instanceof HTMLElement &&
        targetNode.closest('[data-cue-button="true"]')
      ) {
        return;
      }

      if (cuePanelRef.current?.contains(targetNode)) {
        return;
      }

      if (practiceBoardRef.current?.contains(targetNode)) {
        return;
      }

      hidePracticeCue();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [hidePracticeCue, practiceRevealMode]);

  useEffect(() => {
    return () => {
      if (viewTransitionTimeoutRef.current !== null) {
        window.clearTimeout(viewTransitionTimeoutRef.current);
      }
    };
  }, []);

  const viewTransitionClass =
    viewTransitionPhase === "leaving"
      ? "view-flip-out"
      : viewTransitionPhase === "entering"
        ? "view-flip-in"
        : "";
  const weakSkillSummary = weakQuizSkills
    .map((skill) => formatQuizSkillLabel(skill))
    .join(" | ");

  return (
    <div
      className={`flashcard-container relative mx-auto w-full ${
        activeView === "related" ? "max-w-[980px]" : "max-w-[760px]"
      }`}
    >
      <div className={`transition-transform duration-300 ${viewTransitionClass}`}>
        {activeView === "flashcard" && (
        <div
          className={`relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            isFlipped
              ? "[transform:rotateY(180deg)]"
              : "[transform:rotateY(0deg)]"
          }`}
        >
          <div
            className={`w-full [backface-visibility:hidden] ${
              isFlipped ? "absolute left-0 top-0" : "relative"
            }`}
          >
            <div
              className={`app-panel-soft rounded-2xl ${
                sessionProgress
                  ? "px-3 pb-3 pt-1.5 sm:px-5 sm:pb-5 sm:pt-2 md:px-8 md:pb-8 md:pt-2.5"
                  : "p-3 sm:p-5 md:p-8"
              }`}
            >
              {sessionProgress && onExitSession && (
                <div className="-mt-0.5 mb-1 px-1 pb-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onExitSession}
                      className="h-6 w-6 p-0 text-slate-500 hover:bg-white/[0.04] hover:text-slate-100"
                      aria-label="End session"
                      title="End session"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {sessionProgress.current}/{sessionProgress.total}
                    </p>
                  </div>
                  <Progress
                    value={progressPercent}
                    className="mt-1 h-0.5 bg-slate-800/70"
                  />
                </div>
              )}
              <div className="app-panel mb-4 rounded-[28px] p-3 sm:p-4 md:p-5">
                <div
                  className={`mb-3 ${
                    weakQuizSkills.length > 0
                      ? "h-[214px] sm:h-[204px]"
                      : "h-[188px] sm:h-[184px]"
                  }`}
                >
                  <div className="flex h-full flex-col">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
                        Writing Practice
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Draw first. Use a cue only if needed, then flip to check
                        the answer.
                      </p>
                      {weakQuizSkills.length > 0 && (
                        <p
                          className="mt-2 truncate text-xs text-cyan-200/80"
                          title={`Focus before next quiz: ${weakSkillSummary}`}
                        >
                          Focus before next quiz: {weakSkillSummary}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-cue-button="true"
                        onClick={() => revealPracticeCue("character")}
                        className={`h-11 rounded-xl px-2 text-xs leading-tight text-slate-100 hover:text-slate-100 sm:h-12 sm:text-sm ${
                          practiceRevealMode === "character"
                            ? "border-cyan-300/35 bg-cyan-300/10 hover:border-cyan-300/35 hover:bg-cyan-300/10"
                            : "border-white/10 bg-white/[0.03] hover:border-cyan-300/25 hover:bg-cyan-300/8"
                        }`}
                        disabled={isCueAudioLocked}
                      >
                        Reveal character
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-cue-button="true"
                        onClick={() => revealPracticeCue("audio")}
                        className={`h-11 rounded-xl px-2 text-xs leading-tight text-slate-100 hover:text-slate-100 sm:h-12 sm:text-sm ${
                          practiceRevealMode === "audio"
                            ? "border-cyan-300/35 bg-cyan-300/10 hover:border-cyan-300/35 hover:bg-cyan-300/10"
                            : "border-white/10 bg-white/[0.03] hover:border-cyan-300/25 hover:bg-cyan-300/8"
                        }`}
                        disabled={!isTTSAvailable || isCueAudioLocked}
                      >
                        <Volume2 className="mr-1 h-4 w-4 shrink-0 sm:mr-2" />
                        Play sound
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-cue-button="true"
                        onClick={() => revealPracticeCue("pinyin")}
                        className={`h-11 rounded-xl px-2 text-xs leading-tight text-slate-100 hover:text-slate-100 sm:h-12 sm:text-sm ${
                          practiceRevealMode === "pinyin"
                            ? "border-cyan-300/35 bg-cyan-300/10 hover:border-cyan-300/35 hover:bg-cyan-300/10"
                            : "border-white/10 bg-white/[0.03] hover:border-cyan-300/25 hover:bg-cyan-300/8"
                        }`}
                        disabled={isCueAudioLocked}
                      >
                        Show pinyin
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-cue-button="true"
                        onClick={() => revealPracticeCue("meaning")}
                        className={`h-11 rounded-xl px-2 text-xs leading-tight text-slate-100 hover:text-slate-100 sm:h-12 sm:text-sm ${
                          practiceRevealMode === "meaning"
                            ? "border-cyan-300/35 bg-cyan-300/10 hover:border-cyan-300/35 hover:bg-cyan-300/10"
                            : "border-white/10 bg-white/[0.03] hover:border-cyan-300/25 hover:bg-cyan-300/8"
                        }`}
                        disabled={isCueAudioLocked}
                      >
                        Reveal meaning
                      </Button>
                    </div>

                    <div
                      ref={cuePanelRef}
                      className="app-surface mt-3 min-h-0 flex-1 rounded-2xl px-4 py-3"
                    >
                      <div className="h-full overflow-hidden">
                        {practiceRevealMode === "hidden" && (
                          <p className="text-sm text-slate-500">
                            Cue appears here when selected.
                          </p>
                        )}
                        {practiceRevealMode === "character" && (
                          <p
                            className={`font-chinese-ui text-3xl font-extrabold md:text-4xl ${toneClass}`}
                          >
                            {card.front}
                          </p>
                        )}
                        {practiceRevealMode === "meaning" && (
                          <p className="text-sm font-medium leading-6 text-slate-100 md:text-base">
                            {displayMeaning}
                          </p>
                        )}
                        {practiceRevealMode === "pinyin" && (
                          <p className="text-lg font-semibold text-cyan-200/90 md:text-xl">
                            {convertPinyinTones(card.pinyin)}
                          </p>
                        )}
                        {practiceRevealMode === "audio" && (
                          <p className="text-sm font-medium text-slate-100 md:text-base">
                            Word pronunciation played.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={practiceBoardRef}>
                  <PracticeCanvas
                    character={card.front}
                    width={260}
                    height={260}
                    showTemplate
                    showGrid
                    extraControls={
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => transitionToView("quiz")}
                          className="app-action h-11 px-0"
                          aria-label="Quiz"
                          title="Quiz"
                        >
                          <GraduationCap className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsFlipped(true)}
                          className="app-action-neon h-11 px-0"
                          aria-label="Show answer"
                          title="Show answer"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </>
                    }
                  />
                </div>
              </div>

              {isTTSAvailable && !hasDedicatedChineseVoice && (
                <p className="mt-2 text-center text-xs text-amber-300/90">
                  Tip: add a Chinese system voice for more natural
                  pronunciation.
                </p>
              )}
            </div>
          </div>

          <div
            className={`w-full [backface-visibility:hidden] [transform:rotateY(180deg)] ${
              isFlipped ? "relative" : "absolute left-0 top-0"
            }`}
          >
            <div
              className={`app-panel-soft rounded-2xl ${
                sessionProgress
                  ? "px-6 pb-6 pt-2 md:px-8 md:pb-8 md:pt-2.5"
                  : "p-6 md:p-8"
              }`}
            >
              {sessionProgress && onExitSession && (
                <div className="-mt-0.5 mb-1 px-1 pb-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onExitSession}
                      className="h-6 w-6 p-0 text-slate-500 hover:bg-white/[0.04] hover:text-slate-100"
                      aria-label="End session"
                      title="End session"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {sessionProgress.current}/{sessionProgress.total}
                    </p>
                  </div>
                  <Progress
                    value={progressPercent}
                    className="mt-1 h-0.5 bg-slate-800/70"
                  />
                </div>
              )}
              <div className="app-panel rounded-[28px] p-4 md:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
                      Answer Review
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      Compare your recall with the word, meaning, and main
                      sentence.
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                    {hasRelatedUsageView && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => transitionToView("related")}
                        className="app-action h-10 w-full sm:min-w-32 sm:w-auto"
                      >
                        Grammar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFlipped(false)}
                      className="app-action col-span-2 h-10 w-full sm:col-span-1 sm:min-w-28 sm:w-auto"
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Return
                    </Button>
                  </div>
                </div>

                <div className="app-surface mb-6 rounded-2xl p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Answer
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      speakFromCard(card.front, "flashcard-back-word")
                    }
                    className={`text-4xl font-extrabold transition-all md:text-5xl ${toneClass}`}
                  >
                    {card.front}
                  </button>
                  <p className="mt-2 text-lg text-cyan-200/90">
                    {convertPinyinTones(card.pinyin)}
                  </p>
                  <p className="mt-2 text-base text-slate-200">
                    {displayMeaning}
                  </p>
                  <div className="mt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        speakFromCard(card.front, "flashcard-back-word-button")
                      }
                      className="app-action"
                    >
                      <Volume2 className="mr-2 h-4 w-4" />
                      Listen word
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-[0.16em]">
                    {card.hskLevel && (
                      <span className="app-chip-warm rounded-full px-2.5 py-1">
                        {card.hskLevel}
                      </span>
                    )}
                    <span className="app-chip rounded-full px-2.5 py-1 text-slate-400">
                      {card.wordClass}
                    </span>
                  </div>
                </div>

                {!previewMode && (
                  <div className="mb-6 space-y-2 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => transitionToView("quiz")}
                      className="app-action-neon min-w-44"
                    >
                      Do quiz
                    </Button>
                    <p className="text-xs text-slate-500">
                      Quiz verification decides pass quality and scheduling.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {coreExample ? (
                    <PhraseDetailPanel
                      example={coreExample}
                      pair={corePair}
                      wordClass={card.wordClass}
                      fallbackGrammar={fallbackCoreGrammar}
                      onSpeakSentence={(sentence) =>
                        speakFromCard(sentence, "flashcard-core-sentence")
                      }
                      onSpeakToken={(text) =>
                        speakFromCard(text, "flashcard-example-token")
                      }
                    />
                  ) : displayPairs.length > 0 ? (
                    <div className="app-surface rounded-2xl p-4">
                      <p className="text-sm font-medium text-slate-200">
                        Core phrase
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {displayPairs.slice(0, 1).map((pair) => (
                          <div
                            key={`${card.id}-pair-${pair.index}`}
                            className="app-surface rounded-xl p-4"
                          >
                            <p className="font-chinese-ui text-xl text-white">
                              {pair.text}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              {formatPatternText(pair.composition)}
                            </p>
                            <p className="mt-2 text-sm text-slate-300">
                              {pair.meaning}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                </div>

                {previewMode && (
                  <div className="mt-4 text-center text-xs text-slate-500">
                    Preview mode does not change study progress.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeView === "quiz" && (
        <div>
          <QuickViewPanel
            word={card.front}
            pinyin={card.pinyin}
            meaning={displayMeaning}
            onBack={() => transitionToView("flashcard")}
            onSpeakWord={() => speakFromCard(card.front, "quiz-word")}
            onSpeakPinyin={speakPinyin}
            onFinalizeCycle={handleFinalizeQuizCycle}
            isFinalizing={isApplyingQuizResult}
            loopCount={quizLoopCount}
            activeStudyCue={selectedStudyCue || "hidden"}
            isPreviewMode={previewMode}
          />
        </div>
        )}

        {activeView === "related" && hasRelatedUsageView && coreExample && (
        <div>
          <RelatedUsagePanel
            word={card.front}
            pinyin={card.pinyin}
            meaning={displayMeaning}
            toneClass={toneClass}
            wordClass={card.wordClass}
            coreExample={coreExample}
            corePair={corePair}
            relatedExamples={relatedExamples}
            pairs={card.pairs}
            onBack={() => transitionToView("flashcard")}
            onSpeakSentence={(sentence) =>
              speakFromCard(sentence, "flashcard-related-sentence")
            }
          />
        </div>
        )}
      </div>
    </div>
  );
}
