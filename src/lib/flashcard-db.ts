import type { GrammarItem, PracticeTask, TokenItem } from "@/lib/ai/types";
import { deriveCorePracticeTask } from "@/lib/flashcard-practice";
import type {
  Card,
  CardExample,
  Deck,
  QuizPerformanceEvent,
  QuizPerformanceInput,
  QuizSkillType,
  Rating,
  ReviewPerformanceEvent,
  ReviewPerformanceInput,
} from "@/types";

const DB_NAME = "chinese-flashcard-db";
const DB_VERSION = 5;

let db: IDBDatabase | null = null;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizePair(input: unknown): Card["pairs"][number] | null {
  if (!isObject(input)) {
    return null;
  }

  return {
    index: toNumber(input.index, 0),
    text: toString(input.text, toString(input.word)),
    composition: toString(input.composition, toString(input.components)),
    meaning: toString(input.meaning),
  };
}

function normalizeGrammarEntry(input: unknown): GrammarItem | null {
  if (!isObject(input)) {
    return null;
  }

  return {
    index: toNumber(input.index, 0),
    textSpan: toString(input.textSpan, toString(input.focus)),
    grammarName: toString(input.grammarName, toString(input.label)),
    whyToUse: toString(
      input.whyToUse,
      toString(input.why_to_use, toString(input.reason)),
    ),
    structure: toString(input.structure, toString(input.pattern)),
    function: toString(input.function),
    explanation: toString(input.explanation),
  };
}

function normalizeToken(input: unknown): TokenItem | null {
  if (!isObject(input)) {
    return null;
  }

  const text = toString(input.text).trim();
  if (!text) {
    return null;
  }

  return {
    index: toNumber(input.index, 0),
    text,
    pinyin: toString(input.pinyin),
    meaning: toString(input.meaning),
  };
}

function normalizePracticeTask(input: unknown): PracticeTask | null {
  if (!isObject(input)) {
    return null;
  }

  const questions = Array.isArray(input.questions)
    ? input.questions
        .map((option) => {
          if (!isObject(option)) {
            return null;
          }

          const prompt = toString(option.prompt).trim();
          const answer = toString(option.answer).trim();
          const aspect = toString(option.aspect).trim();
          if (!prompt || !answer || !aspect) {
            return null;
          }

          return {
            index: toNumber(option.index, 0),
            aspect:
              aspect === "word" ||
              aspect === "pinyin" ||
              aspect === "meaning" ||
              aspect === "paired_word" ||
              aspect === "example" ||
              aspect === "grammar"
                ? aspect
                : "meaning",
            prompt,
            answer,
          };
        })
        .filter((item): item is PracticeTask["questions"][number] =>
          Boolean(item),
        )
    : [];

  const instruction = toString(input.instruction).trim();

  if (!instruction || questions.length === 0) {
    return null;
  }

  return {
    instruction,
    questions,
  };
}

function normalizeExample(input: unknown): CardExample | null {
  if (!isObject(input)) {
    return null;
  }

  const tokens = Array.isArray(input.tokens)
    ? input.tokens
        .map(normalizeToken)
        .filter((item): item is TokenItem => Boolean(item))
    : [];
  const grammar = Array.isArray(input.grammar)
    ? input.grammar
        .map(normalizeGrammarEntry)
        .filter((item): item is GrammarItem => Boolean(item))
    : [];

  const sentence = toString(input.sentence).trim();
  if (!sentence) {
    return null;
  }

  return {
    exampleIndex: toNumber(
      input.exampleIndex,
      typeof input.index === "number" ? input.index : 0,
    ),
    pairText: toString(input.pairText),
    sentence,
    pinyin: toString(input.pinyin),
    translation: toString(input.translation),
    tokens,
    grammar,
  };
}

function normalizeDeck(input: unknown): Deck {
  const now = Date.now();
  const deck = isObject(input) ? input : {};

  return {
    id: toString(deck.id, generateId()),
    name: toString(deck.name, "Untitled Deck").trim() || "Untitled Deck",
    description: toString(deck.description),
    createdAt: toNumber(deck.createdAt, now),
    updatedAt: toNumber(deck.updatedAt, now),
    cardCount: toNumber(deck.cardCount, 0),
  };
}

function normalizeQuizSkillType(value: unknown): QuizSkillType {
  const input = toString(value).trim().toLowerCase();
  if (
    input === "meaning" ||
    input === "pinyin" ||
    input === "audio" ||
    input === "writing"
  ) {
    return input;
  }
  return "meaning";
}

function normalizeQuizPerformanceEvent(
  input: unknown,
): QuizPerformanceEvent | null {
  if (!isObject(input)) {
    return null;
  }

  const cardId = toString(input.cardId).trim();
  const deckId = toString(input.deckId).trim();
  if (!cardId || !deckId) {
    return null;
  }

  const assessment = toString(input.assessment).trim().toLowerCase();
  const normalizedAssessment =
    assessment === "missed" ||
    assessment === "recalled_slowly" ||
    assessment === "recalled_cleanly" ||
    assessment === "approximate" ||
    assessment === "correct"
      ? assessment
      : "missed";

  return {
    id: toString(input.id, generateId()),
    cardId,
    deckId,
    skillType: normalizeQuizSkillType(input.skillType),
    cycleId:
      toString(input.cycleId).trim() ||
      `${cardId}-${toNumber(input.timestamp, Date.now())}`,
    cycleScore: Math.max(0, toNumber(input.cycleScore, 0)),
    cyclePassed: Boolean(input.cyclePassed),
    studyLoopCount: Math.max(1, toNumber(input.studyLoopCount, 1)),
    axisScore: Math.max(0, toNumber(input.axisScore, 0)),
    timestamp: toNumber(input.timestamp, Date.now()),
    revealed: Boolean(input.revealed),
    assessment: normalizedAssessment,
    isCorrect: Boolean(input.isCorrect),
    isCleanRecall: Boolean(input.isCleanRecall),
    revealCount: Math.max(0, toNumber(input.revealCount, 0)),
    audioReplayCount: Math.max(0, toNumber(input.audioReplayCount, 0)),
  };
}

function normalizeRating(value: unknown): Rating {
  const input = toString(value).trim().toLowerCase();
  if (input === "again" || input === "hard" || input === "good" || input === "easy") {
    return input;
  }
  return "again";
}

function normalizeReviewPerformanceEvent(
  input: unknown,
): ReviewPerformanceEvent | null {
  if (!isObject(input)) {
    return null;
  }

  const cardId = toString(input.cardId).trim();
  const deckId = toString(input.deckId).trim();
  if (!cardId || !deckId) {
    return null;
  }

  return {
    id: toString(input.id, generateId()),
    cardId,
    deckId,
    rating: normalizeRating(input.rating),
    timestamp: toNumber(input.timestamp, Date.now()),
    isSuccess: Boolean(input.isSuccess),
  };
}

function derivePracticeCharacters(front: string, explicit: string[]): string[] {
  if (explicit.length > 0) {
    return explicit;
  }

  return [...front].filter(
    (char, index, chars) =>
      /[\u3400-\u9FFF]/.test(char) && chars.indexOf(char) === index,
  );
}

export async function initDB(): Promise<IDBDatabase> {
  if (db) {
    return db;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains("decks")) {
        const deckStore = database.createObjectStore("decks", {
          keyPath: "id",
        });
        deckStore.createIndex("name", "name", { unique: false });
        deckStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!database.objectStoreNames.contains("cards")) {
        const cardStore = database.createObjectStore("cards", {
          keyPath: "id",
        });
        cardStore.createIndex("deckId", "deckId", { unique: false });
        cardStore.createIndex("nextReview", "nextReview", { unique: false });
        cardStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!database.objectStoreNames.contains("quizEvents")) {
        const quizStore = database.createObjectStore("quizEvents", {
          keyPath: "id",
        });
        quizStore.createIndex("deckId", "deckId", { unique: false });
        quizStore.createIndex("cardId", "cardId", { unique: false });
        quizStore.createIndex("skillType", "skillType", { unique: false });
        quizStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (!database.objectStoreNames.contains("reviewEvents")) {
        const reviewStore = database.createObjectStore("reviewEvents", {
          keyPath: "id",
        });
        reviewStore.createIndex("deckId", "deckId", { unique: false });
        reviewStore.createIndex("cardId", "cardId", { unique: false });
        reviewStore.createIndex("rating", "rating", { unique: false });
        reviewStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      if (event.oldVersion < 3 && database.objectStoreNames.contains("cards")) {
        const upgradeTransaction = (event.target as IDBOpenDBRequest)
          .transaction;
        const cardStore = upgradeTransaction?.objectStore("cards");
        if (cardStore) {
          cardStore.clear();
        }

        const deckStore = upgradeTransaction?.objectStore("decks");
        if (deckStore) {
          const cursorRequest = deckStore.openCursor();
          cursorRequest.onsuccess = (cursorEvent) => {
            const cursor = (
              cursorEvent.target as IDBRequest<IDBCursorWithValue>
            ).result;
            if (!cursor) {
              return;
            }

            cursor.update({
              ...cursor.value,
              cardCount: 0,
              updatedAt: Date.now(),
            });
            cursor.continue();
          };
        }
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
  });
}

export async function getAllDecks(): Promise<Deck[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["decks"], "readonly");
    const store = transaction.objectStore("decks");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getDeck(id: string): Promise<Deck | null> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["decks"], "readonly");
    const store = transaction.objectStore("decks");
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function createDeck(deck: Deck): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["decks"], "readwrite");
    const store = transaction.objectStore("decks");
    const request = store.add(deck);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateDeck(deck: Deck): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["decks"], "readwrite");
    const store = transaction.objectStore("decks");
    const request = store.put(deck);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDeck(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ["decks", "cards", "quizEvents", "reviewEvents"],
      "readwrite",
    );
    const deckStore = transaction.objectStore("decks");
    const cardStore = transaction.objectStore("cards");
    const quizStore = transaction.objectStore("quizEvents");
    const reviewStore = transaction.objectStore("reviewEvents");

    deckStore.delete(id);
    const cardsByDeck = cardStore
      .index("deckId")
      .openCursor(IDBKeyRange.only(id));
    cardsByDeck.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    const quizByDeck = quizStore
      .index("deckId")
      .openCursor(IDBKeyRange.only(id));
    quizByDeck.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    const reviewByDeck = reviewStore
      .index("deckId")
      .openCursor(IDBKeyRange.only(id));
    reviewByDeck.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAllCards(): Promise<Card[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["cards"], "readonly");
    const store = transaction.objectStore("cards");
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["cards"], "readonly");
    const store = transaction.objectStore("cards");
    const request = store.index("deckId").getAll(IDBKeyRange.only(deckId));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCard(id: string): Promise<Card | null> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["cards"], "readonly");
    const store = transaction.objectStore("cards");
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function createCard(card: Card): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["cards"], "readwrite");
    const store = transaction.objectStore("cards");
    const request = store.add(card);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateCard(card: Card): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["cards"], "readwrite");
    const store = transaction.objectStore("cards");
    const request = store.put(card);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCard(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ["cards", "quizEvents", "reviewEvents"],
      "readwrite",
    );
    const store = transaction.objectStore("cards");
    const quizStore = transaction.objectStore("quizEvents");
    const reviewStore = transaction.objectStore("reviewEvents");
    const request = store.delete(id);

    const quizByCard = quizStore
      .index("cardId")
      .openCursor(IDBKeyRange.only(id));
    quizByCard.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    const reviewByCard = reviewStore
      .index("cardId")
      .openCursor(IDBKeyRange.only(id));
    reviewByCard.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) {
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export interface QuizEventFilters {
  deckId?: string;
  cardId?: string;
  skillType?: QuizSkillType;
  fromTimestamp?: number;
  toTimestamp?: number;
}

export async function createQuizPerformanceEvent(
  input: QuizPerformanceInput,
): Promise<QuizPerformanceEvent> {
  const database = await initDB();
  const event: QuizPerformanceEvent = {
    id: generateId(),
    cardId: input.cardId,
    deckId: input.deckId,
    skillType: input.skillType,
    cycleId: input.cycleId.trim() || `${input.cardId}-${Date.now()}`,
    cycleScore: Math.max(0, input.cycleScore),
    cyclePassed: input.cyclePassed,
    studyLoopCount: Math.max(1, input.studyLoopCount),
    axisScore: Math.max(0, input.axisScore),
    timestamp: Date.now(),
    revealed: input.revealed,
    assessment: input.assessment,
    isCorrect: input.isCorrect,
    isCleanRecall: input.isCleanRecall,
    revealCount: Math.max(0, input.revealCount),
    audioReplayCount: Math.max(0, input.audioReplayCount),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["quizEvents"], "readwrite");
    const store = transaction.objectStore("quizEvents");
    const request = store.add(event);

    request.onsuccess = () => resolve(event);
    request.onerror = () => reject(request.error);
  });
}

export async function getQuizPerformanceEvents(
  filters: QuizEventFilters = {},
): Promise<QuizPerformanceEvent[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["quizEvents"], "readonly");
    const store = transaction.objectStore("quizEvents");
    const request = store.getAll();

    request.onsuccess = () => {
      const raw = Array.isArray(request.result) ? request.result : [];
      const normalized = raw
        .map(normalizeQuizPerformanceEvent)
        .filter((item): item is QuizPerformanceEvent => Boolean(item))
        .filter((event) => {
          if (filters.deckId && event.deckId !== filters.deckId) {
            return false;
          }
          if (filters.cardId && event.cardId !== filters.cardId) {
            return false;
          }
          if (filters.skillType && event.skillType !== filters.skillType) {
            return false;
          }
          if (
            typeof filters.fromTimestamp === "number" &&
            event.timestamp < filters.fromTimestamp
          ) {
            return false;
          }
          if (
            typeof filters.toTimestamp === "number" &&
            event.timestamp > filters.toTimestamp
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      resolve(normalized);
    };

    request.onerror = () => reject(request.error);
  });
}

export interface ReviewEventFilters {
  deckId?: string;
  cardId?: string;
  rating?: Rating;
  fromTimestamp?: number;
  toTimestamp?: number;
}

export async function createReviewPerformanceEvent(
  input: ReviewPerformanceInput,
): Promise<ReviewPerformanceEvent> {
  const database = await initDB();
  const event: ReviewPerformanceEvent = {
    id: generateId(),
    cardId: input.cardId,
    deckId: input.deckId,
    rating: input.rating,
    timestamp: Date.now(),
    isSuccess: input.isSuccess,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["reviewEvents"], "readwrite");
    const store = transaction.objectStore("reviewEvents");
    const request = store.add(event);

    request.onsuccess = () => resolve(event);
    request.onerror = () => reject(request.error);
  });
}

export async function getReviewPerformanceEvents(
  filters: ReviewEventFilters = {},
): Promise<ReviewPerformanceEvent[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(["reviewEvents"], "readonly");
    const store = transaction.objectStore("reviewEvents");
    const request = store.getAll();

    request.onsuccess = () => {
      const raw = Array.isArray(request.result) ? request.result : [];
      const normalized = raw
        .map(normalizeReviewPerformanceEvent)
        .filter((item): item is ReviewPerformanceEvent => Boolean(item))
        .filter((event) => {
          if (filters.deckId && event.deckId !== filters.deckId) {
            return false;
          }
          if (filters.cardId && event.cardId !== filters.cardId) {
            return false;
          }
          if (filters.rating && event.rating !== filters.rating) {
            return false;
          }
          if (
            typeof filters.fromTimestamp === "number" &&
            event.timestamp < filters.fromTimestamp
          ) {
            return false;
          }
          if (
            typeof filters.toTimestamp === "number" &&
            event.timestamp > filters.toTimestamp
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      resolve(normalized);
    };

    request.onerror = () => reject(request.error);
  });
}

export interface ExportData {
  version: 5;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  quizEvents: QuizPerformanceEvent[];
  reviewEvents: ReviewPerformanceEvent[];
}

export async function exportAllData(): Promise<ExportData> {
  const [decks, cards, quizEvents, reviewEvents] = await Promise.all([
    getAllDecks(),
    getAllCards(),
    getQuizPerformanceEvents(),
    getReviewPerformanceEvents(),
  ]);

  return {
    version: 5,
    exportedAt: Date.now(),
    decks,
    cards,
    quizEvents,
    reviewEvents,
  };
}

export async function importData(data: unknown): Promise<void> {
  if (!isObject(data)) {
    throw new Error("Invalid import format: expected object root");
  }

  if (data.version !== 3 && data.version !== 4 && data.version !== 5) {
    throw new Error("Only schema versions 3, 4, and 5 are supported.");
  }

  const rawDecks = Array.isArray(data.decks) ? data.decks : [];
  const rawCards = Array.isArray(data.cards) ? data.cards : [];
  const rawQuizEvents = Array.isArray(data.quizEvents) ? data.quizEvents : [];
  const rawReviewEvents = Array.isArray(data.reviewEvents)
    ? data.reviewEvents
    : [];
  const decks = rawDecks.map((deck) => normalizeDeck(deck));
  const cards = rawCards.map((card) => ensureCardFields(card as Partial<Card>));
  const quizEvents = rawQuizEvents
    .map(normalizeQuizPerformanceEvent)
    .filter((event): event is QuizPerformanceEvent => Boolean(event));
  const reviewEvents = rawReviewEvents
    .map(normalizeReviewPerformanceEvent)
    .filter((event): event is ReviewPerformanceEvent => Boolean(event));

  const deckCountMap = new Map<string, number>();
  for (const card of cards) {
    deckCountMap.set(card.deckId, (deckCountMap.get(card.deckId) || 0) + 1);
  }

  const normalizedDecks = decks.map((deck) => ({
    ...deck,
    cardCount: deckCountMap.get(deck.id) || 0,
    updatedAt: Date.now(),
  }));

  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      ["decks", "cards", "quizEvents", "reviewEvents"],
      "readwrite",
    );
    const deckStore = transaction.objectStore("decks");
    const cardStore = transaction.objectStore("cards");
    const quizStore = transaction.objectStore("quizEvents");
    const reviewStore = transaction.objectStore("reviewEvents");

    deckStore.clear();
    cardStore.clear();
    quizStore.clear();
    reviewStore.clear();

    for (const deck of normalizedDecks) {
      deckStore.add(deck);
    }

    for (const card of cards) {
      cardStore.add(card);
    }

    for (const quizEvent of quizEvents) {
      quizStore.add(quizEvent);
    }

    for (const reviewEvent of reviewEvents) {
      reviewStore.add(reviewEvent);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getDeckStats(deckId: string): Promise<{
  totalCards: number;
  dueCards: number;
  newCards: number;
  learnedCards: number;
}> {
  const cards = await getCardsByDeck(deckId);
  const now = Date.now();

  return {
    totalCards: cards.length,
    dueCards: cards.filter((card) => card.nextReview <= now).length,
    newCards: cards.filter((card) => card.repetition === 0).length,
    learnedCards: cards.filter(
      (card) => card.repetition > 0 && card.nextReview > now,
    ).length,
  };
}

export function ensureCardFields(card: Partial<Card>): Card {
  const now = Date.now();
  const pairs = Array.isArray(card.pairs)
    ? card.pairs
        .map(normalizePair)
        .filter((item): item is Card["pairs"][number] => Boolean(item))
    : [];
  const grammarNotes = Array.isArray(card.grammarNotes)
    ? card.grammarNotes
        .map(normalizeGrammarEntry)
        .filter((item): item is GrammarItem => Boolean(item))
    : [];
  const examples = Array.isArray(card.examples)
    ? card.examples
        .map(normalizeExample)
        .filter((item): item is CardExample => Boolean(item))
    : [];
  const practiceCharacters = Array.isArray(card.practiceCharacters)
    ? card.practiceCharacters
        .map((value) => toString(value).trim())
        .filter((value) => value.length > 0)
    : [];
  const front = toString(card.front);
  return {
    id: card.id || generateId(),
    deckId: card.deckId || "",
    front,
    pinyin: toString(card.pinyin),
    meaning: toString(card.meaning),
    wordClass: toString(card.wordClass),
    hskLevel: toString(card.hskLevel),
    usageNote: toString(card.usageNote),
    pairedWordsNote: toString(card.pairedWordsNote),
    pairs,
    grammarNotes,
    examples,
    practiceTask: deriveCorePracticeTask({
      front,
      pinyin: toString(card.pinyin),
      meaning: toString(card.meaning),
      pairs,
      examples,
    }),
    practiceCharacters: derivePracticeCharacters(front, practiceCharacters),
    tts: isObject(card.tts)
      ? {
          word: toString(card.tts.word, front),
          exampleSentences: Array.isArray(card.tts.exampleSentences)
            ? card.tts.exampleSentences
                .map((item) => toString(item))
                .filter((item) => item.length > 0)
            : [],
        }
      : {
          word: front,
          exampleSentences: examples.map((example) => example.sentence),
        },
    metadata: isObject(card.metadata)
      ? {
          parseMode:
            card.metadata.parseMode === "word-entry-v3"
              ? "word-entry-v3"
              : "word-entry-v3",
          repaired: Boolean(card.metadata.repaired),
          repairNotes: Array.isArray(card.metadata.repairNotes)
            ? card.metadata.repairNotes
                .map((item) => toString(item))
                .filter((item) => item.length > 0)
            : [],
          inputWord: toString(card.metadata.inputWord),
        }
      : {
          parseMode: "word-entry-v3",
          repaired: false,
          repairNotes: [],
          inputWord: "",
        },
    interval: card.interval ?? 0,
    repetition: card.repetition ?? 0,
    easeFactor: card.easeFactor ?? 2.5,
    nextReview: card.nextReview ?? now,
    lastReview: card.lastReview ?? 0,
    createdAt: card.createdAt ?? now,
    updatedAt: card.updatedAt ?? now,
  };
}
