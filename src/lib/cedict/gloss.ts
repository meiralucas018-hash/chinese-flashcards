import type { CardChar, Segment } from "@/types";
import {
  ADVERB_TRANSLATIONS,
  ADJECTIVE_TRANSLATIONS,
  MEASURE_WORDS,
  OBJECT_TRANSLATIONS,
  POSSESSIVE_TRANSLATIONS,
  SKIPPABLE_TOKENS,
  SUBJECT_TRANSLATIONS,
  TIME_TRANSLATIONS,
  VERB_TRANSLATIONS,
} from "./constants";
import { isPunctuationToken } from "./english-utils";
import type {
  CedictEntry,
  CedictIndex,
  CharacterInfo,
  RuleToken,
  WordSegment,
} from "./types";

export function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export function sanitizeMeaning(meaning: string): string {
  return meaning
    .replace(/\s+/g, " ")
    .replace(/(^;\s*|;\s*$)/g, "")
    .trim();
}

export function pickPrimaryMeaning(meaning: string): string {
  return sanitizeMeaning(meaning).split(/;\s*/)[0]?.trim() || "";
}

function scoreMeaningText(meaning: string): number {
  const text = sanitizeMeaning(meaning).toLowerCase();
  if (!text) {
    return -100;
  }

  let score = 0;

  if (/^(to\s+)?[a-z][a-z\s-]*$/.test(text)) {
    score += 8;
  }
  if (text.split(/;\s*/).length <= 2) {
    score += 3;
  }
  if (text.split(/\s+/).length <= 5) {
    score += 2;
  }
  if (
    /\bvariant of\b|\bold variant\b|\bused in\b|\bsee also\b|\bsee\b/.test(text)
  ) {
    score -= 8;
  }
  if (
    /\bsurname\b|\bplace name\b|\bproper name\b|\bclassifier\b|\bcl:\b|\babbr\.?\b/.test(
      text,
    )
  ) {
    score -= 6;
  }
  if (/\bliterally\b|\bfig\.?\b/.test(text)) {
    score -= 2;
  }

  return score;
}

function scoreEntry(entry: CedictEntry): number {
  const primaryMeaning = sanitizeMeaning(entry.meanings[0] || "");
  const allMeanings = sanitizeMeaning(entry.meanings.join("; "));

  let score = 0;
  score += scoreMeaningText(primaryMeaning) * 2;
  score += scoreMeaningText(allMeanings);
  score -= Math.max(0, entry.meanings.length - 2);

  if (entry.simplified === entry.traditional) {
    score += 1;
  }

  return score;
}

export function pickBestEntry(entries: CedictEntry[]): CedictEntry {
  return [...entries].sort(
    (left, right) => scoreEntry(right) - scoreEntry(left),
  )[0];
}

export function toCharacterInfo(
  char: string,
  index: CedictIndex,
): CharacterInfo {
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

export function pickLexicalMeaning(token: RuleToken): string {
  return (
    ADJECTIVE_TRANSLATIONS[token.word] || pickPrimaryMeaning(token.meaning)
  );
}

export function translateTokenMeaning(
  token: RuleToken,
  asObject = false,
): string {
  if (asObject && OBJECT_TRANSLATIONS[token.word]) {
    return OBJECT_TRANSLATIONS[token.word];
  }
  if (!asObject && SUBJECT_TRANSLATIONS[token.word]) {
    return SUBJECT_TRANSLATIONS[token.word];
  }
  if (TIME_TRANSLATIONS[token.word]) {
    return TIME_TRANSLATIONS[token.word];
  }
  if (ADJECTIVE_TRANSLATIONS[token.word]) {
    return ADJECTIVE_TRANSLATIONS[token.word];
  }
  if (MEASURE_WORDS.has(token.word)) {
    return "";
  }

  return pickLexicalMeaning(token);
}

export function translatePhrase(tokens: RuleToken[], asObject = false): string {
  const parts: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (SKIPPABLE_TOKENS.has(token.word) || isPunctuationToken(token.word)) {
      continue;
    }

    if (nextToken?.word === "的" && POSSESSIVE_TRANSLATIONS[token.word]) {
      parts.push(POSSESSIVE_TRANSLATIONS[token.word]);
      index += 1;
      continue;
    }

    if (ADVERB_TRANSLATIONS[token.word]) {
      parts.push(ADVERB_TRANSLATIONS[token.word]);
      continue;
    }

    const translated = translateTokenMeaning(token, asObject);
    if (translated) {
      parts.push(translated);
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function buildLiteralGloss(wordSegments: WordSegment[]): string {
  const mappedTokens = wordSegments
    .map((segment) => {
      const word = segment.word.trim();
      if (!word || isPunctuationToken(word) || MEASURE_WORDS.has(word)) {
        return "";
      }

      if (word === "是") return "am";
      if (word === "有") return "have";
      if (word === "很") return "very";
      if (word === "中文" || word === "汉语" || word === "汉文") {
        return "Chinese";
      }
      if (word === "一" || word === "一个") return "one";
      if (TIME_TRANSLATIONS[word]) return TIME_TRANSLATIONS[word];
      if (SUBJECT_TRANSLATIONS[word]) return SUBJECT_TRANSLATIONS[word];
      if (VERB_TRANSLATIONS[word]) return VERB_TRANSLATIONS[word];

      const lexical = pickPrimaryMeaning(segment.meaning)
        .replace(/\(.*?\)/g, "")
        .replace(/\bclassifier\b.*$/i, "")
        .replace(/\badverb of degree\b/gi, "")
        .replace(/\s+or\s+(him|her|them|us|me)\b/gi, "")
        .replace(/\blanguage\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      return lexical || word;
    })
    .filter(Boolean);

  const parts: string[] = [];
  for (let index = 0; index < mappedTokens.length; index += 1) {
    const current = mappedTokens[index];
    const next = mappedTokens[index + 1];
    if (
      /^(this|that|these|those)$/i.test(current) &&
      next &&
      !/^(very|am|have)$/i.test(next)
    ) {
      parts.push(`${current} ${next}`);
      index += 1;
      continue;
    }

    parts.push(current);
  }

  return parts.join(" / ");
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
