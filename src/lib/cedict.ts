// Client-side CC-CEDICT loader and parser
// Usage: import { loadCedict, parseCedictLine, searchCedict, segmentSentence } from './cedict';

import type { CardChar, ExampleBreakdown, Segment } from "@/types";

export interface CharacterInfo {
  char: string;
  pinyin: string;
  meaning: string;
}

export interface WordInfo {
  word: string;
  pinyin: string;
  meaning: string;
  chars: CharacterInfo[];
}

export interface SearchResult {
  characters: CharacterInfo[];
  words: WordInfo[];
}

export interface CedictEntry {
  traditional: string;
  simplified: string;
  pinyin: string;
  meanings: string[];
}

export type CedictIndex = Map<string, CedictEntry[]>;

let cedictIndex: CedictIndex | null = null;

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function sanitizeMeaning(meaning: string): string {
  return meaning
    .replace(/\s+/g, " ")
    .replace(/(^;\s*|;\s*$)/g, "")
    .trim();
}

function pickBestEntry(entries: CedictEntry[]): CedictEntry {
  return [...entries].sort((a, b) => a.meanings.length - b.meanings.length)[0];
}

function toCharacterInfo(char: string, index: CedictIndex): CharacterInfo {
  const charEntries = index.get(char);
  if (!charEntries || charEntries.length === 0) {
    return { char, pinyin: "", meaning: "" };
  }

  const entry = pickBestEntry(charEntries);
  return {
    char,
    pinyin: entry.pinyin,
    meaning: sanitizeMeaning(entry.meanings.join("; ")),
  };
}

export async function loadCedict(): Promise<CedictIndex> {
  if (cedictIndex) return cedictIndex;
  const res = await fetch("/data/cedict.txt");
  const text = await res.text();
  const lines = text
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"));
  const index: CedictIndex = new Map();
  for (const line of lines) {
    const entry = parseCedictLine(line);
    if (!entry) continue;
    if (!index.has(entry.simplified)) {
      index.set(entry.simplified, []);
    }
    index.get(entry.simplified)!.push(entry);
    // Optionally index by traditional too
    if (!index.has(entry.traditional)) {
      index.set(entry.traditional, []);
    }
    index.get(entry.traditional)!.push(entry);
  }
  cedictIndex = index;
  return index;
}

export function parseCedictLine(line: string): CedictEntry | null {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+?)\//);
  if (!match) return null;
  const meanings = match[4]
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    traditional: match[1],
    simplified: match[2],
    pinyin: match[3].trim(),
    meanings,
  };
}

export function searchCedict(query: string, index: CedictIndex): SearchResult {
  const normalizedQuery = query.trim();
  const chineseChars = normalizedQuery.match(/[\u4e00-\u9fff]/g) || [];

  const characters = uniqueBy(
    chineseChars.map((char) => toCharacterInfo(char, index)),
    (item) => `${item.char}-${item.pinyin}-${item.meaning}`,
  );

  const words: WordInfo[] = [];

  if (normalizedQuery.length > 1) {
    const exactEntries = index.get(normalizedQuery) || [];
    for (const entry of exactEntries) {
      words.push({
        word: entry.simplified,
        pinyin: entry.pinyin,
        meaning: sanitizeMeaning(entry.meanings.join("; ")),
        chars: entry.simplified
          .split("")
          .map((char) => toCharacterInfo(char, index)),
      });
    }

    const segmentedWords = segmentSentence(normalizedQuery, index)
      .filter((segment) => segment.word.length > 1)
      .map((segment) => ({
        word: segment.word,
        pinyin: segment.pinyin,
        meaning: sanitizeMeaning(segment.meaning),
        chars: segment.chars,
      }));

    words.push(...segmentedWords);
  }

  return {
    characters,
    words: uniqueBy(
      words,
      (item) => `${item.word}-${item.pinyin}-${item.meaning}`,
    ),
  };
}

export interface WordSegment {
  word: string;
  pinyin: string;
  meaning: string;
  startIndex: number;
  endIndex: number;
  chars: CharacterInfo[];
}

export function segmentSentence(
  sentence: string,
  index: CedictIndex,
): WordSegment[] {
  const segments: WordSegment[] = [];
  let i = 0;
  const maxLen = 6;
  while (i < sentence.length) {
    let matched = false;
    for (let len = Math.min(maxLen, sentence.length - i); len >= 1; len--) {
      const substring = sentence.substring(i, i + len);
      const entries = index.get(substring);
      if (entries && entries.length > 0) {
        const entry = pickBestEntry(entries);
        segments.push({
          word: substring,
          pinyin: entry.pinyin,
          meaning: sanitizeMeaning(entry.meanings.join("; ")),
          startIndex: i,
          endIndex: i + len,
          chars: substring
            .split("")
            .map((char) => toCharacterInfo(char, index)),
        });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const char = sentence[i];
      const charInfo = toCharacterInfo(char, index);
      segments.push({
        word: char,
        pinyin: charInfo.pinyin,
        meaning: charInfo.meaning,
        startIndex: i,
        endIndex: i + 1,
        chars: [charInfo],
      });
      i++;
    }
  }
  return segments;
}

export function toBreakdownSegments(wordSegments: WordSegment[]): Segment[] {
  return wordSegments.map((segment) => ({
    chars: segment.chars.map<CardChar>((charInfo) => ({
      char: charInfo.char,
      pinyin: charInfo.pinyin,
      meaning: charInfo.meaning,
    })),
    combinedMeaning: sanitizeMeaning(segment.meaning),
    isWord: segment.word.length > 1,
    text: segment.word,
    pinyin: segment.pinyin,
    startIndex: segment.startIndex,
    endIndex: segment.endIndex,
  }));
}

export function buildExampleBreakdown(
  sentence: string,
  index: CedictIndex,
  options?: { translation?: string; pinyinOverride?: string },
): ExampleBreakdown {
  const trimmedSentence = sentence.trim();
  if (!trimmedSentence) {
    return {
      sentence: "",
      pinyin: "",
      translation: "",
      segments: [],
    };
  }

  const wordSegments = segmentSentence(trimmedSentence, index);
  const breakdownSegments = toBreakdownSegments(wordSegments);
  const pinyinFromSegments = wordSegments
    .map((segment) => segment.pinyin)
    .filter(Boolean)
    .join(" ");

  return {
    sentence: trimmedSentence,
    pinyin: options?.pinyinOverride?.trim() || pinyinFromSegments,
    translation: options?.translation?.trim() || "",
    segments: breakdownSegments,
  };
}
