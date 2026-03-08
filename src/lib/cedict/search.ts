import { sanitizeMeaning, toCharacterInfo, uniqueBy } from "./gloss";
import { segmentSentence } from "./segmenter";
import type { CedictIndex, SearchResult, WordInfo } from "./types";

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
