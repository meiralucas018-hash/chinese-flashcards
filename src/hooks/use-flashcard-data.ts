import { useCallback, useEffect, useMemo, useState } from "react";
import type { Card, Deck } from "@/types";
import * as flashcardDb from "@/lib/flashcard-db";

export function useFlashcardData(showToast: (message: string) => void) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [loadedDecks, loadedCards] = await Promise.all([
        flashcardDb.getAllDecks(),
        flashcardDb.getAllCards(),
      ]);
      setDecks(loadedDecks);
      setCards(loadedCards.map((card) => flashcardDb.ensureCardFields(card)));
    } catch (error) {
      console.error("Failed to load data:", error);
      showToast("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deckStatsMap = useMemo(() => {
    const now = Date.now();
    return decks.reduce<
      Record<string, { total: number; due: number; learned: number }>
    >((acc, deck) => {
      const deckCards = cards.filter((card) => card.deckId === deck.id);
      acc[deck.id] = {
        total: deckCards.length,
        due: deckCards.filter((card) => card.nextReview <= now).length,
        learned: deckCards.filter((card) => card.repetition > 0).length,
      };
      return acc;
    }, {});
  }, [cards, decks]);

  return {
    decks,
    setDecks,
    cards,
    setCards,
    isLoading,
    loadData,
    deckStatsMap,
  };
}
