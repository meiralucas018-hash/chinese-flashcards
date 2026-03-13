import type { CedictEntry, CedictIndex, CharacterInfo } from "./types";

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

const PREFERRED_ENTRY_MEANING_PATTERNS: Record<string, RegExp> = {
  本: /\bclassifier\b|\bmeasure word\b/i,
  比: /\bthan\b|\bcompare\b|\bcomparison\b/i,
  更: /\bmore\b|\beven more\b/i,
  才: /\bonly\b|\bjust\b|\bnot until\b/i,
  还是: /\bstill\b|\byet\b|\bnevertheless\b/i,
  请: /\bplease\b/i,
  说: /\bto speak\b|\bto say\b|\bspeak\b|\bsay\b/i,
  累: /\btired\b/i,
};

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

  const preferredPattern =
    PREFERRED_ENTRY_MEANING_PATTERNS[entry.simplified] ||
    PREFERRED_ENTRY_MEANING_PATTERNS[entry.traditional];
  if (preferredPattern?.test(allMeanings)) {
    score += 18;
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
