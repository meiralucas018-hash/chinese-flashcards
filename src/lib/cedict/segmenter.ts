import { pickBestEntry, sanitizeMeaning, toCharacterInfo } from "./gloss";
import type { CedictIndex, WordSegment } from "./types";

export function segmentSentence(
  sentence: string,
  index: CedictIndex,
): WordSegment[] {
  const segments: WordSegment[] = [];
  let currentIndex = 0;
  const maxLength = 6;

  while (currentIndex < sentence.length) {
    let matched = false;

    for (
      let length = Math.min(maxLength, sentence.length - currentIndex);
      length >= 1;
      length -= 1
    ) {
      const substring = sentence.substring(currentIndex, currentIndex + length);
      const entries = index.get(substring);
      if (!entries || entries.length === 0) {
        continue;
      }

      const entry = pickBestEntry(entries);
      segments.push({
        word: substring,
        pinyin: entry.pinyin,
        meaning: sanitizeMeaning(entry.meanings.join("; ")),
        startIndex: currentIndex,
        endIndex: currentIndex + length,
        chars: substring.split("").map((char) => toCharacterInfo(char, index)),
      });
      currentIndex += length;
      matched = true;
      break;
    }

    if (matched) {
      continue;
    }

    const char = sentence[currentIndex];
    const charInfo = toCharacterInfo(char, index);
    segments.push({
      word: char,
      pinyin: charInfo.pinyin,
      meaning: charInfo.meaning,
      startIndex: currentIndex,
      endIndex: currentIndex + 1,
      chars: [charInfo],
    });
    currentIndex += 1;
  }

  return segments;
}
