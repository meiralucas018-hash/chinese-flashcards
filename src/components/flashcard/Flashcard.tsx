"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Card as CardType, Rating, UsageExample } from "@/types";
import { buildExampleBreakdown, loadCedict } from "@/lib/cedict";
import { convertPinyinTones, getToneColor } from "@/lib/pinyin";
import {
  calculateNextReview,
  calculateNextReviewTime,
  getRatingFromShortcut,
} from "@/lib/srs";
import PracticeCanvas from "./PracticeCanvas";
import CharacterBreakdown from "./CharacterBreakdown";
import { CircleHelp, Volume2, RotateCw, Undo2 } from "lucide-react";

interface FlashcardProps {
  card: CardType;
  onRate: (cardId: string, rating: Rating, updates: Partial<CardType>) => void;
  onTTS?: (text: string) => void;
}

function formatTranslationSource(
  source: "exact" | "rule" | "fallback",
): string {
  if (source === "exact") {
    return "Exact dictionary";
  }
  if (source === "rule") {
    return "Rule-based";
  }

  return "Literal fallback";
}

function getTranslationSourceExplanation(
  source: "exact" | "rule" | "fallback",
): string {
  if (source === "exact") {
    return "This translation came from a direct sentence-level dictionary match.";
  }
  if (source === "rule") {
    return "This translation was built from the offline segmentation and rule pipeline.";
  }

  return "This translation is the literal gloss fallback from the segmented dictionary meanings.";
}

function shouldShowLiteralGloss(
  translation: string,
  literalGloss?: string,
): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.?!,;:]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  return (
    Boolean(literalGloss?.trim()) &&
    normalize(translation) !== normalize(literalGloss || "")
  );
}

function TranslationMetadata({
  translation,
  literalGloss,
  translationSource,
  confidence,
  tone = "purple",
}: {
  translation: string;
  literalGloss?: string;
  translationSource?: "exact" | "rule" | "fallback";
  confidence?: number;
  tone?: "purple" | "blue";
}) {
  if (!translationSource) {
    return null;
  }

  const badgeClass =
    tone === "blue"
      ? "border-blue-400/30 bg-blue-500/10 text-blue-200"
      : "border-purple-400/30 bg-purple-500/10 text-purple-200";

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className={`rounded-full border px-2 py-1 ${badgeClass}`}>
          {formatTranslationSource(translationSource)}
        </span>
        <HoverCard>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-slate-600/70 bg-slate-900/70 px-2 py-1 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              Why this?
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-72 border-slate-700 bg-slate-950 text-slate-200">
            <p className="text-sm leading-6">
              {getTranslationSourceExplanation(translationSource)}
            </p>
          </HoverCardContent>
        </HoverCard>
        {typeof confidence === "number" && (
          <span className="text-slate-400">
            Confidence {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      {shouldShowLiteralGloss(translation, literalGloss) && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Translation
            </p>
            <p className="mt-1 text-sm text-slate-200">{translation}</p>
          </div>
          <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Literal Gloss
            </p>
            <p className="mt-1 text-sm text-slate-300">{literalGloss}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageExampleCard({
  example,
  index,
}: {
  example: UsageExample;
  index: number;
}) {
  return (
    <div className="usage-item relative mb-6 pl-5 border-l-[3px] border-white/10">
      <div className="label flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-purple-400/80 shadow-[0_0_0_4px_rgba(192,132,252,0.15)]" />
        {example.label}
      </div>
      <TranslationMetadata
        translation={example.translation}
        literalGloss={example.literalGloss}
        translationSource={example.translationSource}
        confidence={example.confidence}
      />
      <CharacterBreakdown
        segments={example.breakdown}
        pinyin={example.pinyin}
        translation={example.translation}
      />
    </div>
  );
}

export default function Flashcard({ card, onRate, onTTS }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCharacterVisible, setIsCharacterVisible] = useState(true);
  const [canToggleCharacter, setCanToggleCharacter] = useState(false);
  const [frontBreakdown, setFrontBreakdown] = useState<
    CardType["exampleBreakdown"] | null
  >(null);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleReturn = useCallback(() => {
    setIsFlipped(false);
  }, []);

  const isTTSAvailable =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const handleTTS = useCallback(() => {
    if (!isTTSAvailable) return;
    if (onTTS && card.front) {
      onTTS(card.front);
    } else {
      const utterance = new window.SpeechSynthesisUtterance(card.front);
      utterance.lang = "zh-CN";
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  }, [card.front, onTTS, isTTSAvailable]);

  const handleRate = useCallback(
    (rating: Rating) => {
      const srsResult = calculateNextReview(card, rating);
      const updates: Partial<CardType> = {
        ...srsResult,
        nextReview: calculateNextReviewTime(srsResult.interval),
        lastReview: Date.now(),
      };
      onRate(card.id, rating, updates);
      setIsFlipped(false);
    },
    [card, onRate],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadFrontBreakdown = async () => {
      if (!card.front.trim()) {
        if (!isCancelled) {
          setFrontBreakdown(null);
        }
        return;
      }

      const index = await loadCedict();
      const breakdown = buildExampleBreakdown(card.front, index, {
        pinyinOverride: card.pinyin || undefined,
        translation: card.meaning || undefined,
      });

      if (!isCancelled) {
        setFrontBreakdown(breakdown);
      }
    };

    void loadFrontBreakdown();

    return () => {
      isCancelled = true;
    };
  }, [card.front, card.pinyin, card.meaning]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (isFlipped) {
          handleReturn();
        } else {
          handleFlip();
        }
        return;
      }

      if (!isFlipped) return;

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleReturn();
        return;
      }

      const rating = getRatingFromShortcut(event.key);
      if (rating) {
        event.preventDefault();
        handleRate(rating);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleRate, handleReturn, isFlipped]);

  // Extract tone from pinyin for color
  const getToneClass = () => {
    const toneMatch = card.pinyin.match(/(\d)(?:\s|$)/);
    if (toneMatch) {
      return getToneColor(parseInt(toneMatch[1], 10));
    }
    return "text-blue-400";
  };

  return (
    <div className="flashcard-container w-full max-w-[760px] mx-auto">
      <div
        className={`card-inner relative w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          isFlipped
            ? "[transform:rotateY(180deg)]"
            : "[transform:rotateY(0deg)]"
        }`}
      >
        {/* Front of Card - Practice Board (Main Focus) */}
        <div
          className={`card-front w-full [backface-visibility:hidden] top-0 left-0 ${
            isFlipped ? "absolute" : "relative"
          }`}
        >
          <div className="bg-gradient-to-b from-white/5 to-transparent rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl">
            {/* Header with main character (subtle, for reference) */}
            <div className="text-center mb-4">
              <h2
                className={`text-3xl md:text-4xl font-extrabold transition-all [text-shadow:0_0_18px_rgba(96,165,250,0.22),0_18px_45px_rgba(0,0,0,0.55)] ${getToneClass()}`}
              >
                {isCharacterVisible ? card.front : "?"}
              </h2>
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCharacterVisible((prev) => !prev)}
                  disabled={!canToggleCharacter}
                  className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-500"
                >
                  {isCharacterVisible ? "Hide character" : "Show character"}
                </Button>
              </div>
            </div>

            {/* Practice Canvas - Main Focus */}
            <PracticeCanvas
              character={card.front}
              width={320}
              height={320}
              showTemplate={false}
              showGrid
              onInteraction={() => setCanToggleCharacter(true)}
            />

            {/* Action buttons */}
            <div className="flex justify-center mt-6 gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTTS}
                className="bg-white/5 border-white/10 hover:bg-blue-500/20"
                disabled={!isTTSAvailable}
              >
                <Volume2 className="w-4 h-4 mr-2" />
                Listen
                {!isTTSAvailable && (
                  <span className="ml-2 text-xs text-red-400">
                    (TTS indisponível)
                  </span>
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleFlip}
                className="border border-blue-400/40 bg-blue-500/18 text-blue-100 shadow-[0_10px_30px_rgba(59,130,246,0.22)] hover:border-blue-300/60 hover:bg-blue-500/26 hover:text-white"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Show Answer
                <span className="ml-2 text-xs text-slate-400 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded">
                  Space
                </span>
              </Button>
            </div>

            {/* Hint text */}
            <p className="text-center text-slate-500 text-xs mt-4">
              Practice writing the character above, then flip to see the meaning
              breakdown
            </p>
          </div>
        </div>

        {/* Back of Card - Character Breakdown */}
        <div
          className={`card-back w-full [backface-visibility:hidden] [transform:rotateY(180deg)] top-0 left-0 ${
            isFlipped ? "relative" : "absolute"
          }`}
        >
          <div className="bg-gradient-to-b from-white/5 to-transparent rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <h2
                className={`text-4xl md:text-5xl font-extrabold transition-all [text-shadow:0_0_20px_rgba(96,165,250,0.3),0_20px_40px_rgba(0,0,0,0.5)] ${getToneClass()}`}
                onClick={handleTTS}
              >
                {card.front}
              </h2>
              <p className="text-blue-300 text-lg mt-2 font-medium">
                {convertPinyinTones(card.pinyin)}
              </p>
              <p className="text-slate-300 text-base mt-1">{card.meaning}</p>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTTS}
                  className="bg-white/5 border-white/10 hover:bg-blue-500/20"
                  disabled={!isTTSAvailable}
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Listen
                </Button>
              </div>
            </div>

            {frontBreakdown && frontBreakdown.segments.length > 0 && (
              <div className="mb-6 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-slate-200">
                    Character breakdown
                  </p>
                  <p className="text-xs text-slate-500">
                    Hover a character or word to inspect it.
                  </p>
                </div>
                <CharacterBreakdown
                  segments={frontBreakdown.segments}
                  pinyin={frontBreakdown.pinyin}
                  translation={frontBreakdown.translation}
                  literalGloss={frontBreakdown.literalGloss}
                  variant="compact"
                  showPinyinLine={false}
                  showTranslationLine={false}
                  showLiteralGlossLine={false}
                  onCharClick={(char) => onTTS?.(char)}
                  onWordClick={(word) => onTTS?.(word)}
                />
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-6" />

            {/* Multiple Usage Examples (comprehensive breakdown) */}
            {card.usageExamples && card.usageExamples.length > 0 ? (
              <div className="usage-examples max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {card.usageExamples.map((example, index) => (
                  <UsageExampleCard
                    key={index}
                    example={example}
                    index={index}
                  />
                ))}
              </div>
            ) : card.exampleBreakdown &&
              card.exampleBreakdown.segments.length > 0 ? (
              // Fallback to single example breakdown
              <div className="mb-6">
                <div className="flex items-center gap-2 text-purple-400 text-sm font-bold uppercase tracking-wider mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_0_3px_rgba(192,132,252,0.2)]" />
                  Example
                </div>
                <TranslationMetadata
                  translation={card.exampleBreakdown.translation}
                  literalGloss={card.exampleBreakdown.literalGloss}
                  translationSource={card.exampleBreakdown.translationSource}
                  confidence={card.exampleBreakdown.confidence}
                />
                <CharacterBreakdown
                  segments={card.exampleBreakdown.segments}
                  pinyin={card.exampleBreakdown.pinyin}
                  translation={card.exampleBreakdown.translation}
                  onCharClick={(char) => onTTS?.(char)}
                  onWordClick={(word) => onTTS?.(word)}
                />
              </div>
            ) : null}

            {/* Rating Buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReturn}
                className="bg-white/5 border-white/10 hover:bg-white/10"
              >
                <Undo2 className="w-4 h-4 mr-1" />
                Return
                <span className="ml-2 text-xs text-slate-400 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded">
                  R / Space
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRate("again")}
                className="bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25"
              >
                Again
                <span className="ml-2 text-xs text-slate-400 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded">
                  1
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRate("hard")}
                className="bg-yellow-500/15 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/25"
              >
                Hard
                <span className="ml-2 text-xs text-slate-400 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded">
                  2
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRate("good")}
                className="bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25"
              >
                Good
                <span className="ml-2 text-xs text-slate-400 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded">
                  3
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRate("easy")}
                className="bg-blue-500/15 border-blue-500/40 text-blue-400 hover:bg-blue-500/25"
              >
                Easy
                <span className="ml-2 text-xs text-slate-400 border border-white/10 bg-white/5 px-1.5 py-0.5 rounded">
                  4
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
