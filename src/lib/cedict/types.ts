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

export interface WordSegment {
  word: string;
  pinyin: string;
  meaning: string;
  startIndex: number;
  endIndex: number;
  chars: CharacterInfo[];
}
