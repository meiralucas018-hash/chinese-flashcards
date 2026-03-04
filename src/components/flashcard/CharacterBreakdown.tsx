'use client';

import React, { useState } from 'react';
import type { Segment, CardChar } from '@/types';
import { convertPinyinTones, getToneColorVar } from '@/lib/pinyin';

interface CharacterBreakdownProps {
  segments: Segment[];
  pinyin?: string;
  translation?: string;
  onCharClick?: (char: string) => void;
  onWordClick?: (word: string) => void;
}

export default function CharacterBreakdown({
  segments,
  pinyin,
  translation,
  onCharClick,
  onWordClick,
}: CharacterBreakdownProps) {
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);

  const handleCharClick = (e: React.MouseEvent, char: string) => {
    e.stopPropagation();
    onCharClick?.(char);
  };

  const handleWordClick = (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    onWordClick?.(word);
  };

  return (
    <div className="space-y-2">
      {/* Sentence with character breakdown */}
      <div className="sentence-wrap bg-white/5 border border-white/10 rounded-lg p-4 transition-all hover:border-blue-500/30 hover:bg-white/10">
        <div className="sentence-box text-xl md:text-2xl leading-relaxed text-slate-100 break-keep">
          {segments.map((segment, segIndex) => {
            if (segment.isWord) {
              // Multi-character word with combined meaning
              return (
                <span
                  key={segIndex}
                  className="word group relative inline-block border-b-[6px] border-dashed border-slate-600 mb-2 pb-1 px-0.5 cursor-pointer transition-colors hover:border-purple-400"
                  onMouseEnter={() => setHoveredWord(`word-${segIndex}`)}
                  onMouseLeave={() => setHoveredWord(null)}
                  onClick={(e) => {
                    const word = segment.chars.map((c) => c.char).join('');
                    handleWordClick(e, word);
                  }}
                >
                  {segment.chars.map((charInfo, charIndex) => (
                    <span
                      key={charIndex}
                      className="char relative inline cursor-pointer rounded transition-colors hover:bg-blue-500/20 hover:text-blue-400"
                      data-m={charInfo.meaning}
                      onMouseEnter={() => setHoveredChar(`${segIndex}-${charIndex}`)}
                      onMouseLeave={() => setHoveredChar(null)}
                      onClick={(e) => handleCharClick(e, charInfo.char)}
                    >
                      {charInfo.char}
                      {/* Character tooltip */}
                      {hoveredChar === `${segIndex}-${charIndex}` && (
                        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50 bg-slate-800 text-blue-400 border border-blue-500/80 shadow-lg animate-fadeIn">
                          {charInfo.meaning}
                        </span>
                      )}
                    </span>
                  ))}
                  {/* Word tooltip */}
                  {hoveredWord === `word-${segIndex}` && !hoveredChar && (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50 bg-purple-500 text-black border border-purple-400/50 shadow-lg animate-fadeIn">
                      {segment.combinedMeaning}
                    </span>
                  )}
                </span>
              );
            } else {
              // Single character
              return segment.chars.map((charInfo, charIndex) => (
                <span
                  key={`${segIndex}-${charIndex}`}
                  className="char relative inline cursor-pointer rounded transition-colors hover:bg-blue-500/20 hover:text-blue-400"
                  onMouseEnter={() => setHoveredChar(`${segIndex}-${charIndex}`)}
                  onMouseLeave={() => setHoveredChar(null)}
                  onClick={(e) => handleCharClick(e, charInfo.char)}
                >
                  {charInfo.char}
                  {/* Character tooltip */}
                  {hoveredChar === `${segIndex}-${charIndex}` && (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap z-50 bg-slate-800 text-blue-400 border border-blue-500/80 shadow-lg animate-fadeIn">
                      {charInfo.meaning}
                    </span>
                  )}
                </span>
              ));
            }
          })}
        </div>
      </div>

      {/* Pinyin line */}
      {pinyin && (
        <div className="pinyin-line text-blue-300 font-sans text-base mt-3 leading-relaxed tracking-wide">
          {convertPinyinTones(pinyin)}
        </div>
      )}

      {/* Translation */}
      {translation && (
        <div className="translation-line text-slate-400 italic text-sm mt-1">
          {translation}
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
  const [hoveredChar, setHoveredChar] = useState<number | null>(null);

  return (
    <span
      className={segment.isWord ? 'word group relative inline-block border-b-[5px] border-dashed border-slate-600 mb-1.5 pb-0.5 px-0.5 cursor-pointer transition-colors hover:border-purple-400' : ''}
    >
      {segment.chars.map((charInfo, index) => (
        <span
          key={index}
          className="char relative inline cursor-pointer rounded transition-colors hover:bg-blue-500/20 hover:text-blue-400"
          onMouseEnter={() => setHoveredChar(index)}
          onMouseLeave={() => setHoveredChar(null)}
          onClick={() => onCharClick?.(charInfo)}
        >
          {charInfo.char}
          {hoveredChar === index && (
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap z-50 bg-slate-800 text-blue-400 border border-blue-500/80 shadow-lg">
              {charInfo.meaning}
            </span>
          )}
        </span>
      ))}
      {segment.isWord && hoveredChar === null && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap z-50 bg-purple-500 text-black border border-purple-400/50 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
          {segment.combinedMeaning}
        </span>
      )}
    </span>
  );
}
