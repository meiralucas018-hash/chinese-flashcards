// Chinese Flash Card Application Types

export interface CardChar {
  char: string;
  pinyin: string;
  meaning: string;
}

export interface Segment {
  chars: CardChar[];
  combinedMeaning: string;
  isWord: boolean;
  text?: string;
  pinyin?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface ExampleBreakdown {
  sentence: string;
  pinyin: string;
  translation: string;
  segments: Segment[];
}

export interface SentenceAnalysis {
  sentence: string;
  translation: string;
  pinyin: string;
  segments: Segment[];
  characters: CardChar[];
}

// Usage example with label (like "1. Correct / Right", "2. Verb: To face")
export interface UsageExample {
  label: string; // e.g., "1. Correct / Right"
  sentence: string; // Chinese sentence
  pinyin: string; // Pinyin with tone marks
  translation: string; // English translation
  breakdown: Segment[]; // Character breakdown
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  pinyin: string;
  meaning: string;
  example: string;
  exampleBreakdown: ExampleBreakdown;
  // Multiple usage examples (like the comprehensive breakdown in Example.html)
  usageExamples?: UsageExample[];
  // SRS fields
  interval: number;
  repetition: number;
  easeFactor: number;
  nextReview: number;
  lastReview: number;
  createdAt: number;
  updatedAt: number;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  cardCount: number;
}

export interface SRSResult {
  interval: number;
  repetition: number;
  easeFactor: number;
}

export type Rating = "again" | "hard" | "good" | "easy";

export interface SearchCharResult {
  char: string;
  pinyin: string;
  meaning: string;
}

export interface SearchWordResult {
  word: string;
  pinyin: string;
  meaning: string;
  breakdown: CardChar[];
}

export interface FlashCardState {
  decks: Deck[];
  cards: Card[];
  currentDeck: Deck | null;
  currentCard: Card | null;
  studyQueue: Card[];
  isFlipped: boolean;
  isLoading: boolean;
}

export type TabType = "decks" | "study" | "add" | "search" | "settings";
