import type {
  FlashcardCompatibleData,
  GrammarItem,
  TokenItem,
} from "@/lib/ai/types";

export interface CardExample {
  exampleIndex: number;
  pairText: string;
  sentence: string;
  pinyin: string;
  translation: string;
  tokens: TokenItem[];
  grammar: GrammarItem[];
}

export interface Card extends FlashcardCompatibleData {
  id: string;
  deckId: string;
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

export type QuizSkillType = "meaning" | "pinyin" | "audio" | "writing";

export type QuizAssessmentResult =
  | "missed"
  | "recalled_slowly"
  | "recalled_cleanly"
  | "approximate"
  | "correct";

export interface QuizPerformanceEvent {
  id: string;
  cardId: string;
  deckId: string;
  skillType: QuizSkillType;
  cycleId: string;
  cycleScore: number;
  cyclePassed: boolean;
  studyLoopCount: number;
  axisScore: number;
  timestamp: number;
  revealed: boolean;
  assessment: QuizAssessmentResult;
  isCorrect: boolean;
  isCleanRecall: boolean;
  revealCount: number;
  audioReplayCount: number;
}

export interface QuizPerformanceInput {
  cardId: string;
  deckId: string;
  skillType: QuizSkillType;
  cycleId: string;
  cycleScore: number;
  cyclePassed: boolean;
  studyLoopCount: number;
  axisScore: number;
  revealed: boolean;
  assessment: QuizAssessmentResult;
  isCorrect: boolean;
  isCleanRecall: boolean;
  revealCount: number;
  audioReplayCount: number;
}

export interface ReviewPerformanceEvent {
  id: string;
  cardId: string;
  deckId: string;
  rating: Rating;
  timestamp: number;
  isSuccess: boolean;
}

export interface ReviewPerformanceInput {
  cardId: string;
  deckId: string;
  rating: Rating;
  isSuccess: boolean;
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

export type TabType = "decks" | "statistics" | "add" | "settings";
