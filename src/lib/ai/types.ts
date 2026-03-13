export interface WordEntry {
  word: string;
  pinyin: string;
  meaning: string;
  wordClass: string;
  hskLevel: string;
  usageNote: string;
  pairedWordsNote: string;
}

export interface PairItem {
  index: number;
  text: string;
  composition: string;
  meaning: string;
}

export interface TokenItem {
  index: number;
  text: string;
  pinyin: string;
  meaning: string;
}

export interface GrammarItem {
  index: number;
  textSpan: string;
  grammarName: string;
  whyToUse: string;
  structure: string;
  function: string;
  explanation: string;
}

export interface ExampleSentence {
  exampleIndex: number;
  pairText: string;
  sentence: string;
  pinyin: string;
  translation: string;
  tokens: TokenItem[];
  grammar: GrammarItem[];
}

export type PracticeQuestionAspect =
  | "word"
  | "pinyin"
  | "meaning"
  | "paired_word"
  | "example"
  | "grammar";

export interface PracticeQuestion {
  index: number;
  aspect: PracticeQuestionAspect;
  prompt: string;
  answer: string;
}

export interface PracticeTask {
  instruction: string;
  questions: PracticeQuestion[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ParseMetadata {
  parseMode: "word-entry-v3";
  repaired: boolean;
  repairNotes: string[];
  inputWord?: string;
}

export interface ParsedWordResponse {
  wordEntry: WordEntry;
  pairs: PairItem[];
  examples: ExampleSentence[];
  practice: PracticeTask;
  metadata: ParseMetadata;
}

export interface AutoRepairResult {
  repairedText: string;
  repaired: boolean;
  repairNotes: string[];
}

export type FlashcardExampleData = ExampleSentence;

export interface FlashcardCompatibleData {
  front: string;
  pinyin: string;
  meaning: string;
  wordClass: string;
  hskLevel: string;
  usageNote: string;
  pairedWordsNote: string;
  pairs: PairItem[];
  grammarNotes: GrammarItem[];
  examples: FlashcardExampleData[];
  practiceTask: PracticeTask;
  practiceCharacters: string[];
  tts: {
    word: string;
    exampleSentences: string[];
  };
  metadata: ParseMetadata;
}

export type ParsedAiWord = ParsedWordResponse;
export type ParsedPair = PairItem;
export type ParsedGrammarEntry = GrammarItem;
export type ParsedExample = ExampleSentence;
export type ParsedPracticeQuestion = PracticeQuestion;
export type ParsedPracticeTask = PracticeTask;
export type RepairNote = string;
