"use client";

import React from "react";
import type { Segment, CardChar } from "@/types";
import { convertPinyinTones } from "@/lib/pinyin";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CharacterBreakdownProps {
  segments: Segment[];
  pinyin?: string;
  translation?: string;
  literalGloss?: string;
  variant?: "default" | "compact";
  showPinyinLine?: boolean;
  showTranslationLine?: boolean;
  showLiteralGlossLine?: boolean;
  onCharClick?: (char: string) => void;
  onWordClick?: (word: string) => void;
}

export default function CharacterBreakdown({
  segments,
  pinyin,
  translation,
  literalGloss,
  variant = "default",
  showPinyinLine = true,
  showTranslationLine = true,
  showLiteralGlossLine = true,
  onCharClick,
  onWordClick,
}: CharacterBreakdownProps) {
  const isCompact = variant === "compact";

  const handleCharClick = (e: React.MouseEvent, char: string) => {
    e.stopPropagation();
    onCharClick?.(char);
  };

  const handleWordClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    onWordClick?.(word);
  };

  return (
    <div className={isCompact ? "space-y-3" : "space-y-2"}>
      <div
        className={`sentence-wrap ${
          isCompact
            ? "rounded-xl border border-white/8 bg-slate-950/70 p-3 md:p-4 hover:border-blue-400/20 hover:bg-slate-950/80 hover:translate-y-0"
            : "bg-white/5 border border-white/10 rounded-lg p-4 transition-all hover:border-blue-500/30 hover:bg-white/10"
        }`}
      >
        <div
          className={`sentence-box break-keep select-none leading-relaxed ${
            isCompact
              ? "text-lg text-slate-50 md:text-xl"
              : "text-xl text-slate-100 md:text-2xl"
          }`}
        >
          <TooltipProvider>
            {segments.map((segment, segIndex) => {
              const word =
                segment.text || segment.chars.map((char) => char.char).join("");
              const wordTooltip =
                segment.combinedMeaning ||
                segment.pinyin ||
                "No details available";

              return (
                <span
                  key={`${word}-${segIndex}`}
                  className={`relative mr-0.5 inline-flex items-end rounded px-0.5 ${
                    segment.isWord ? "pb-1" : "hover:bg-blue-500/10"
                  }`}
                >
                  <span className="inline-flex gap-0.5 rounded text-left">
                    {segment.chars.map((charInfo, charIndex) => (
                      <Tooltip key={`${word}-${charInfo.char}-${charIndex}`}>
                        <TooltipTrigger asChild>
                          <span
                            className={`cursor-pointer rounded px-0.5 transition-colors ${
                              isCompact
                                ? "hover:bg-blue-500/15 hover:text-blue-200"
                                : "hover:bg-blue-500/20 hover:text-blue-300"
                            }`}
                            onClick={(event) =>
                              handleCharClick(event, charInfo.char)
                            }
                          >
                            {charInfo.char}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          sideOffset={6}
                          className="max-w-[260px] bg-slate-900 border border-blue-500/50 text-slate-100"
                        >
                          <div className="text-xs">
                            <div className="font-semibold text-blue-300">
                              {charInfo.char}
                            </div>
                            {charInfo.pinyin && (
                              <div>{convertPinyinTones(charInfo.pinyin)}</div>
                            )}
                            <div className="text-slate-300">
                              {charInfo.meaning || "No meaning available"}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </span>
                  {segment.isWord && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Show details for ${word}`}
                          className="absolute inset-x-0 bottom-0 h-1.5 rounded-sm border-b-2 border-dashed border-purple-500/60 transition-colors hover:border-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
                          onClick={(event) => handleWordClick(event, word)}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        sideOffset={8}
                        className="max-w-[320px] bg-slate-900 border border-purple-400/50 text-slate-100"
                      >
                        <div className="text-xs">
                          <div className="font-semibold text-purple-300">
                            {word}
                          </div>
                          {segment.pinyin && (
                            <div>{convertPinyinTones(segment.pinyin)}</div>
                          )}
                          <div className="text-slate-300">{wordTooltip}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              );
            })}
          </TooltipProvider>
        </div>
      </div>

      {showPinyinLine && pinyin && (
        <div
          className={`pinyin-line font-sans leading-relaxed tracking-wide ${
            isCompact
              ? "mt-2 text-sm text-slate-300"
              : "mt-3 text-base text-blue-300"
          }`}
        >
          {convertPinyinTones(pinyin)}
        </div>
      )}

      {showTranslationLine && translation && (
        <div className="translation-line mt-1 text-sm italic text-slate-400">
          {translation}
        </div>
      )}

      {showLiteralGlossLine && literalGloss && (
        <div className="mt-1 text-xs text-slate-500">
          Literal: {literalGloss}
        </div>
      )}
    </div>
  );
}

// Standalone segment display component
export function SegmentDisplay({
  segment,
  onCharClick,
}: {
  segment: Segment;
  onCharClick?: (char: CardChar) => void;
}) {
  return (
    <span
      className={
        segment.isWord
          ? "inline-block border-b-2 border-dashed border-purple-500/60 px-0.5"
          : ""
      }
    >
      {segment.chars.map((charInfo, index) => (
        <Tooltip key={index}>
          <TooltipTrigger asChild>
            <span
              className="inline cursor-pointer rounded px-0.5 transition-colors hover:bg-blue-500/20 hover:text-blue-400"
              onClick={() => onCharClick?.(charInfo)}
            >
              {charInfo.char}
            </span>
          </TooltipTrigger>
          <TooltipContent
            sideOffset={6}
            className="bg-slate-900 border border-blue-500/50 text-slate-100"
          >
            {charInfo.meaning || "No meaning available"}
          </TooltipContent>
        </Tooltip>
      ))}
    </span>
  );
}
