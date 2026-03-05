// Client-side CC-CEDICT loader and parser
// Usage: import { loadCedict, parseCedictLine, searchCedict, segmentSentence } from './cedict';

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

export async function loadCedict(): Promise<CedictIndex> {
  if (cedictIndex) return cedictIndex;
  const res = await fetch('/data/cedict.txt');
  const text = await res.text();
  const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
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
    .split('/')
    .map(s => s.trim())
    .filter(Boolean);
  return {
    traditional: match[1],
    simplified: match[2],
    pinyin: match[3].trim(),
    meanings,
  };
}

export function searchCedict(query: string, index: CedictIndex): SearchResult {
  const characters: CharacterInfo[] = [];
  const words: WordInfo[] = [];
  const foundChars = new Set<string>();
  const chineseChars = query.match(/[\u4e00-\u9fff]/g) || [];
  // Word lookup
  if (query.length > 1) {
    const wordEntries = index.get(query);
    if (wordEntries) {
      for (const entry of wordEntries) {
        words.push({
          word: entry.simplified,
          pinyin: entry.pinyin,
          meaning: entry.meanings.join('; '),
          chars: entry.simplified.split('').map(char => ({ char, pinyin: '', meaning: '' }))
        });
      }
    }
  }
  // Character lookup
  for (const char of chineseChars) {
    if (!foundChars.has(char)) {
      const charEntries = index.get(char);
      if (charEntries) {
        for (const entry of charEntries) {
          characters.push({
            char: char,
            pinyin: entry.pinyin,
            meaning: entry.meanings.join('; ')
          });
        }
        foundChars.add(char);
      }
    }
  }
  return { characters, words };
}

export interface WordSegment {
  word: string;
  pinyin: string;
  meaning: string;
  startIndex: number;
  endIndex: number;
  chars: CharacterInfo[];
}

export function segmentSentence(sentence: string, index: CedictIndex): WordSegment[] {
  const segments: WordSegment[] = [];
  let i = 0;
  const maxLen = 6;
  while (i < sentence.length) {
    let matched = false;
    for (let len = Math.min(maxLen, sentence.length - i); len >= 1; len--) {
      const substring = sentence.substring(i, i + len);
      const entries = index.get(substring);
      if (entries && entries.length > 0) {
        // Use first entry for pinyin/meaning
        const entry = entries[0];
        segments.push({
          word: substring,
          pinyin: entry.pinyin,
          meaning: entry.meanings.join('; '),
          startIndex: i,
          endIndex: i + len,
          chars: substring.split('').map(char => {
            const charEntries = index.get(char);
            if (charEntries && charEntries.length > 0) {
              return {
                char,
                pinyin: charEntries[0].pinyin,
                meaning: charEntries[0].meanings.join('; ')
              };
            }
            return { char, pinyin: '', meaning: '' };
          })
        });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const char = sentence[i];
      const charEntries = index.get(char);
      let charInfo: CharacterInfo;
      if (charEntries && charEntries.length > 0) {
        charInfo = {
          char,
          pinyin: charEntries[0].pinyin,
          meaning: charEntries[0].meanings.join('; ')
        };
      } else {
        charInfo = { char, pinyin: '', meaning: '' };
      }
      segments.push({
        word: char,
        pinyin: charInfo.pinyin,
        meaning: charInfo.meaning,
        startIndex: i,
        endIndex: i + 1,
        chars: [charInfo]
      });
      i++;
    }
  }
  return segments;
}
