"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card as CardType, Rating, UsageExample } from "@/types";
import { convertPinyinTones, getToneColor } from "@/lib/pinyin";
import {
  calculateNextReview,
  calculateNextReviewTime,
  getRatingFromShortcut,
} from "@/lib/srs";
import PracticeCanvas from "./PracticeCanvas";
import CharacterBreakdown from "./CharacterBreakdown";
import { Volume2, RotateCw, Undo2 } from "lucide-react";

interface FlashcardProps {
  card: CardType;
  onRate: (cardId: string, rating: Rating, updates: Partial<CardType>) => void;
  onTTS?: (text: string) => void;
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
        className={`card-inner relative w-full transition-transform duration-500 transform-style-3d ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front of Card - Practice Board (Main Focus) */}
        <div
          className="card-front w-full"
          style={{
            backfaceVisibility: "hidden",
            position: isFlipped ? "absolute" : "relative",
            top: 0,
            left: 0,
          }}
        >
          <div className="bg-gradient-to-b from-white/5 to-transparent rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl">
            {/* Header with main character (subtle, for reference) */}
            <div className="text-center mb-4">
              <h2
                className={`text-3xl md:text-4xl font-extrabold cursor-pointer transition-all hover:scale-105 ${getToneClass()}`}
                style={{
                  textShadow:
                    "0 0 18px rgba(96, 165, 250, 0.22), 0 18px 45px rgba(0,0,0,0.55)",
                }}
                onClick={handleFlip}
                title="Click to see answer"
              >
                {card.front}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                {convertPinyinTones(card.pinyin)} • Meaning Map
              </p>
            </div>

            {/* Practice Canvas - Main Focus */}
            <PracticeCanvas
              character={card.front}
              width={320}
              height={320}
              showTemplate
              showGrid
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
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30"
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
          className="card-back w-full"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            position: isFlipped ? "relative" : "absolute",
            top: 0,
            left: 0,
          }}
        >
          <div className="bg-gradient-to-b from-white/5 to-transparent rounded-2xl p-6 md:p-8 border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <h2
                className={`text-4xl md:text-5xl font-extrabold cursor-pointer transition-all hover:scale-105 ${getToneClass()}`}
                style={{
                  textShadow:
                    "0 0 20px rgba(96, 165, 250, 0.3), 0 20px 40px rgba(0,0,0,0.5)",
                }}
                onClick={handleTTS}
              >
                {card.front}
              </h2>
              <p className="text-blue-300 text-lg mt-2 font-medium">
                {convertPinyinTones(card.pinyin)}
              </p>
              <p className="text-slate-300 text-base mt-1">{card.meaning}</p>
            </div>

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
