// IndexedDB Operations for Chinese Flash Card Application

import type { Card, Deck } from '@/types';

const DB_NAME = 'chinese-flashcard-db';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create Decks store
      if (!database.objectStoreNames.contains('decks')) {
        const deckStore = database.createObjectStore('decks', { keyPath: 'id' });
        deckStore.createIndex('name', 'name', { unique: false });
        deckStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create Cards store
      if (!database.objectStoreNames.contains('cards')) {
        const cardStore = database.createObjectStore('cards', { keyPath: 'id' });
        cardStore.createIndex('deckId', 'deckId', { unique: false });
        cardStore.createIndex('nextReview', 'nextReview', { unique: false });
        cardStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ==========================================
// Deck Operations
// ==========================================

export async function getAllDecks(): Promise<Deck[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['decks'], 'readonly');
    const store = transaction.objectStore('decks');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getDeck(id: string): Promise<Deck | null> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['decks'], 'readonly');
    const store = transaction.objectStore('decks');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function createDeck(deck: Deck): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['decks'], 'readwrite');
    const store = transaction.objectStore('decks');
    const request = store.add(deck);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateDeck(deck: Deck): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['decks'], 'readwrite');
    const store = transaction.objectStore('decks');
    const request = store.put(deck);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDeck(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['decks', 'cards'], 'readwrite');

    // Delete the deck
    const deckStore = transaction.objectStore('decks');
    deckStore.delete(id);

    // Delete all cards in the deck
    const cardStore = transaction.objectStore('cards');
    const index = cardStore.index('deckId');
    const cardsRequest = index.openCursor(IDBKeyRange.only(id));

    cardsRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ==========================================
// Card Operations
// ==========================================

export async function getAllCards(): Promise<Card[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cards'], 'readonly');
    const store = transaction.objectStore('cards');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cards'], 'readonly');
    const store = transaction.objectStore('cards');
    const index = store.index('deckId');
    const request = index.getAll(IDBKeyRange.only(deckId));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCard(id: string): Promise<Card | null> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cards'], 'readonly');
    const store = transaction.objectStore('cards');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function createCard(card: Card): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cards'], 'readwrite');
    const store = transaction.objectStore('cards');
    const request = store.add(card);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateCard(card: Card): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cards'], 'readwrite');
    const store = transaction.objectStore('cards');
    const request = store.put(card);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCard(id: string): Promise<void> {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['cards'], 'readwrite');
    const store = transaction.objectStore('cards');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// Import/Export Operations
// ==========================================

export interface ExportData {
  version: number;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
}

export async function exportAllData(): Promise<ExportData> {
  const decks = await getAllDecks();
  const cards = await getAllCards();

  return {
    version: 1,
    exportedAt: Date.now(),
    decks,
    cards,
  };
}

export async function importData(data: ExportData): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['decks', 'cards'], 'readwrite');

    // Clear existing data
    const deckStore = transaction.objectStore('decks');
    const cardStore = transaction.objectStore('cards');
    deckStore.clear();
    cardStore.clear();

    // Import decks
    for (const deck of data.decks) {
      deckStore.add(deck);
    }

    // Import cards
    for (const card of data.cards) {
      cardStore.add(card);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ==========================================
// Statistics
// ==========================================

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
    dueCards: cards.filter((c) => c.nextReview <= now).length,
    newCards: cards.filter((c) => c.repetition === 0).length,
    learnedCards: cards.filter((c) => c.repetition > 0 && c.nextReview > now).length,
  };
}

// Ensure card has all required fields (for backward compatibility)
export function ensureCardFields(card: Partial<Card>): Card {
  return {
    id: card.id || generateId(),
    deckId: card.deckId || '',
    front: card.front || '',
    pinyin: card.pinyin || '',
    meaning: card.meaning || '',
    example: card.example || '',
    exampleBreakdown: card.exampleBreakdown || {
      sentence: '',
      pinyin: '',
      translation: '',
      segments: [],
    },
    usageExamples: card.usageExamples || [],
    interval: card.interval ?? 0,
    repetition: card.repetition ?? 0,
    easeFactor: card.easeFactor ?? 2.5,
    nextReview: card.nextReview ?? Date.now(),
    lastReview: card.lastReview ?? 0,
    createdAt: card.createdAt ?? Date.now(),
    updatedAt: card.updatedAt ?? Date.now(),
  };
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
