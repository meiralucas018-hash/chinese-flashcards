"use client";

import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import {
  FolderOpen,
  GraduationCap,
  Loader2,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Card as CardType,
  Deck,
  Rating,
  SentenceAnalysis,
  TabType,
} from "@/types";
import { getDueCards, initializeNewCard } from "@/lib/srs";
import * as flashcardDb from "@/lib/flashcard-db";
import { buildExampleBreakdown, loadCedict, searchCedict } from "@/lib/cedict";
import { useToastMessage } from "@/hooks/use-toast-message";
import { useFlashcardData } from "@/hooks/use-flashcard-data";
import DecksView from "@/components/views/DecksView";
import StudyView from "@/components/views/StudyView";
import AddCardView, {
  type NewCardFormState,
} from "@/components/views/AddCardView";
import SearchView from "@/components/views/SearchView";
import SettingsView from "@/components/views/SettingsView";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

const EMPTY_FORM: NewCardFormState = {
  front: "",
  pinyin: "",
  meaning: "",
  example: "",
  examplePinyin: "",
  exampleTranslation: "",
};

const EMPTY_EXAMPLE_BREAKDOWN: CardType["exampleBreakdown"] = {
  sentence: "",
  pinyin: "",
  translation: "",
  literalGloss: "",
  translationSource: "fallback",
  confidence: 0,
  segments: [],
};

function normalizeExampleSentence(value: string | undefined): string {
  return value?.trim() || "";
}

function normalizeExampleBreakdown(
  exampleBreakdown: Partial<CardType["exampleBreakdown"]> | null | undefined,
  sentenceOverride?: string,
): CardType["exampleBreakdown"] {
  const sentence = normalizeExampleSentence(
    sentenceOverride ?? exampleBreakdown?.sentence,
  );

  return {
    ...EMPTY_EXAMPLE_BREAKDOWN,
    sentence,
    pinyin: exampleBreakdown?.pinyin?.trim() || "",
    translation: exampleBreakdown?.translation?.trim() || "",
    literalGloss: exampleBreakdown?.literalGloss?.trim() || "",
    translationSource:
      exampleBreakdown?.translationSource === "exact" ||
      exampleBreakdown?.translationSource === "rule" ||
      exampleBreakdown?.translationSource === "fallback"
        ? exampleBreakdown.translationSource
        : EMPTY_EXAMPLE_BREAKDOWN.translationSource,
    confidence:
      typeof exampleBreakdown?.confidence === "number"
        ? exampleBreakdown.confidence
        : EMPTY_EXAMPLE_BREAKDOWN.confidence,
    segments: Array.isArray(exampleBreakdown?.segments)
      ? exampleBreakdown.segments
      : EMPTY_EXAMPLE_BREAKDOWN.segments,
  };
}

function toExampleBreakdownFromAnalysis(
  analysis: SentenceAnalysis,
  overrides?: {
    pinyin?: string;
    translation?: string;
  },
): CardType["exampleBreakdown"] {
  return normalizeExampleBreakdown(
    {
      sentence: analysis.sentence,
      pinyin: overrides?.pinyin?.trim() || analysis.pinyin,
      translation: overrides?.translation?.trim() || analysis.translation,
      literalGloss: analysis.literalGloss,
      translationSource: analysis.translationSource,
      confidence: analysis.confidence,
      segments: analysis.segments,
    },
    analysis.sentence,
  );
}

function toSentenceAnalysis(
  exampleBreakdown: CardType["exampleBreakdown"],
): SentenceAnalysis {
  const normalizedBreakdown = normalizeExampleBreakdown(exampleBreakdown);

  return {
    sentence: normalizedBreakdown.sentence,
    translation: normalizedBreakdown.translation,
    literalGloss: normalizedBreakdown.literalGloss,
    translationSource: normalizedBreakdown.translationSource,
    confidence: normalizedBreakdown.confidence,
    pinyin: normalizedBreakdown.pinyin,
    segments: normalizedBreakdown.segments,
    characters: normalizedBreakdown.segments.flatMap(
      (segment) => segment.chars,
    ),
  };
}

function buildUsageExamples(
  exampleBreakdown: CardType["exampleBreakdown"],
): CardType["usageExamples"] | undefined {
  const normalizedBreakdown = normalizeExampleBreakdown(exampleBreakdown);

  if (
    !normalizedBreakdown.sentence ||
    normalizedBreakdown.segments.length === 0
  ) {
    return undefined;
  }

  return [
    {
      label: "Example",
      sentence: normalizedBreakdown.sentence,
      pinyin: normalizedBreakdown.pinyin,
      translation: normalizedBreakdown.translation,
      literalGloss: normalizedBreakdown.literalGloss,
      translationSource: normalizedBreakdown.translationSource,
      confidence: normalizedBreakdown.confidence,
      breakdown: normalizedBreakdown.segments,
    },
  ];
}

export default function ChineseFlashcardApp() {
  const [activeTab, setActiveTab] = useState<TabType>("decks");
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [studyQueue, setStudyQueue] = useState<CardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [newCardForm, setNewCardForm] = useState<NewCardFormState>(EMPTY_FORM);
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [isAnalyzingSentence, setIsAnalyzingSentence] = useState(false);
  const [sentenceAnalysis, setSentenceAnalysis] =
    useState<SentenceAnalysis | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ReturnType<
    typeof searchCedict
  > | null>(null);

  const { toast, showToast } = useToastMessage();
  const {
    decks,
    setDecks,
    cards,
    setCards,
    isLoading,
    loadData,
    deckStatsMap,
  } = useFlashcardData(showToast);

  const cardsInCurrentDeck = useMemo(() => {
    if (!currentDeck) return [];
    return cards
      .filter((card) => card.deckId === currentDeck.id)
      .map((card) => flashcardDb.ensureCardFields(card));
  }, [cards, currentDeck]);

  const learnedCount = useMemo(
    () => cards.filter((card) => card.repetition > 0).length,
    [cards],
  );

  const updateDeckCount = useCallback(
    async (deckId: string, nextCount: number) => {
      const deck = decks.find((item) => item.id === deckId);
      if (!deck) return;

      const updatedDeck: Deck = {
        ...deck,
        cardCount: Math.max(0, nextCount),
        updatedAt: Date.now(),
      };

      await flashcardDb.updateDeck(updatedDeck);
      setDecks((prev) =>
        prev.map((item) => (item.id === updatedDeck.id ? updatedDeck : item)),
      );
      setCurrentDeck((prev) =>
        prev?.id === updatedDeck.id ? updatedDeck : prev,
      );
    },
    [decks, setDecks],
  );

  const handleCreateDeck = useCallback(
    async (name: string, description: string) => {
      if (!name.trim()) {
        showToast("Please enter a deck name");
        return;
      }

      const newDeck: Deck = {
        id: generateId(),
        name: name.trim(),
        description: description.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cardCount: 0,
      };

      try {
        await flashcardDb.createDeck(newDeck);
        setDecks((prev) => [...prev, newDeck]);
        showToast("Deck created successfully");
      } catch (error) {
        console.error("Failed to create deck:", error);
        showToast("Failed to create deck");
      }
    },
    [setDecks, showToast],
  );

  const handleDeleteDeck = useCallback(
    async (deckId: string) => {
      try {
        await flashcardDb.deleteDeck(deckId);
        setDecks((prev) => prev.filter((deck) => deck.id !== deckId));
        setCards((prev) => prev.filter((card) => card.deckId !== deckId));
        if (currentDeck?.id === deckId) {
          setCurrentDeck(null);
        }
        showToast("Deck deleted");
      } catch (error) {
        console.error("Failed to delete deck:", error);
        showToast("Failed to delete deck");
      }
    },
    [currentDeck, setCards, setDecks, showToast],
  );

  const handleSelectDeck = useCallback((deck: Deck) => {
    setCurrentDeck(deck);
    setActiveTab("add");
  }, []);

  const startStudySession = useCallback(
    (deckId?: string) => {
      const dueCards = getDueCards(cards, deckId).map((card) =>
        flashcardDb.ensureCardFields(card),
      );
      setStudyQueue(dueCards);
      setCurrentCardIndex(0);

      if (dueCards.length === 0) {
        showToast("No cards due for review");
        return;
      }

      setActiveTab("study");
    },
    [cards, showToast],
  );

  const handleRateCard = useCallback(
    async (cardId: string, _rating: Rating, updates: Partial<CardType>) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) return;

      const updatedCard: CardType = flashcardDb.ensureCardFields({
        ...card,
        ...updates,
        updatedAt: Date.now(),
      });

      try {
        await flashcardDb.updateCard(updatedCard);
        setCards((prev) =>
          prev.map((item) => (item.id === cardId ? updatedCard : item)),
        );

        if (currentCardIndex < studyQueue.length - 1) {
          setCurrentCardIndex((prev) => prev + 1);
          return;
        }

        setStudyQueue([]);
        setCurrentCardIndex(0);
        showToast("Study session complete");
        setActiveTab("decks");
      } catch (error) {
        console.error("Failed to save review:", error);
        showToast("Failed to save progress");
      }
    },
    [cards, currentCardIndex, showToast, studyQueue.length, setCards],
  );

  const updateForm = useCallback((patch: Partial<NewCardFormState>) => {
    setNewCardForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetCardForm = useCallback(() => {
    setNewCardForm(EMPTY_FORM);
    setSentenceAnalysis(null);
  }, []);

  const endStudySession = useCallback(() => {
    setStudyQueue([]);
    setCurrentCardIndex(0);
    setActiveTab("decks");
  }, []);

  const buildCardExampleData = useCallback(
    async ({
      sentence,
      examplePinyin,
      exampleTranslation,
      cachedAnalysis,
    }: {
      sentence: string;
      examplePinyin?: string;
      exampleTranslation?: string;
      cachedAnalysis?: SentenceAnalysis | null;
    }) => {
      const trimmedSentence = normalizeExampleSentence(sentence);
      if (!trimmedSentence) {
        return {
          exampleBreakdown: EMPTY_EXAMPLE_BREAKDOWN,
          usageExamples: undefined,
        };
      }

      const exampleBreakdown =
        cachedAnalysis &&
        normalizeExampleSentence(cachedAnalysis.sentence) === trimmedSentence
          ? toExampleBreakdownFromAnalysis(cachedAnalysis, {
              pinyin: examplePinyin,
              translation: exampleTranslation,
            })
          : normalizeExampleBreakdown(
              buildExampleBreakdown(trimmedSentence, await loadCedict(), {
                pinyinOverride: examplePinyin,
                translation: exampleTranslation,
              }),
              trimmedSentence,
            );

      return {
        exampleBreakdown,
        usageExamples: buildUsageExamples(exampleBreakdown),
      };
    },
    [],
  );

  const resolveExampleData = useCallback(
    async ({
      currentSentence,
      currentBreakdown,
      nextSentence,
      nextBreakdown,
      examplePinyin,
      exampleTranslation,
      cachedAnalysis,
    }: {
      currentSentence?: string;
      currentBreakdown?: CardType["exampleBreakdown"];
      nextSentence: string;
      nextBreakdown?: CardType["exampleBreakdown"];
      examplePinyin?: string;
      exampleTranslation?: string;
      cachedAnalysis?: SentenceAnalysis | null;
    }) => {
      const normalizedCurrentSentence =
        normalizeExampleSentence(currentSentence);
      const normalizedNextSentence = normalizeExampleSentence(nextSentence);

      if (!normalizedNextSentence) {
        return {
          example: "",
          exampleBreakdown: EMPTY_EXAMPLE_BREAKDOWN,
          usageExamples: undefined,
        };
      }

      const exampleChanged =
        normalizedNextSentence !== normalizedCurrentSentence;

      if (exampleChanged) {
        const { exampleBreakdown, usageExamples } = await buildCardExampleData({
          sentence: normalizedNextSentence,
        });

        return {
          example: normalizedNextSentence,
          exampleBreakdown,
          usageExamples,
        };
      }

      const safeBreakdown =
        nextBreakdown &&
        normalizeExampleSentence(nextBreakdown.sentence) ===
          normalizedNextSentence
          ? normalizeExampleBreakdown(nextBreakdown, normalizedNextSentence)
          : currentBreakdown &&
              normalizeExampleSentence(currentBreakdown.sentence) ===
                normalizedNextSentence
            ? normalizeExampleBreakdown(
                currentBreakdown,
                normalizedNextSentence,
              )
            : cachedAnalysis &&
                normalizeExampleSentence(cachedAnalysis.sentence) ===
                  normalizedNextSentence
              ? toExampleBreakdownFromAnalysis(cachedAnalysis, {
                  pinyin: examplePinyin,
                  translation: exampleTranslation,
                })
              : null;

      if (safeBreakdown) {
        return {
          example: normalizedNextSentence,
          exampleBreakdown: safeBreakdown,
          usageExamples: buildUsageExamples(safeBreakdown),
        };
      }

      const { exampleBreakdown, usageExamples } = await buildCardExampleData({
        sentence: normalizedNextSentence,
        examplePinyin,
        exampleTranslation,
        cachedAnalysis,
      });

      return {
        example: normalizedNextSentence,
        exampleBreakdown,
        usageExamples,
      };
    },
    [buildCardExampleData],
  );

  const handleAutoFetch = useCallback(async () => {
    const inputText = newCardForm.front.trim();
    if (!inputText) {
      showToast("Please enter Chinese text first");
      return;
    }

    setIsAutoFetching(true);
    try {
      const index = await loadCedict();
      const results = searchCedict(inputText, index);

      const exactWord = results.words.find((word) => word.word === inputText);
      const exactCharacter = results.characters.find(
        (character) => character.char === inputText,
      );

      const pinyin = exactWord?.pinyin || exactCharacter?.pinyin || "";
      const meaning = exactWord?.meaning || exactCharacter?.meaning || "";

      if (!pinyin && !meaning) {
        showToast("No local CEDICT entry found for this input");
        return;
      }

      setNewCardForm((prev) => ({ ...prev, pinyin, meaning }));

      showToast("Card fields auto-filled from CEDICT");
    } catch (error) {
      console.error("Auto-fetch failed:", error);
      showToast("Could not fetch data");
    } finally {
      setIsAutoFetching(false);
    }
  }, [newCardForm.front, showToast]);

  const handleAnalyzeSentence = useCallback(async () => {
    const sentence = newCardForm.example.trim();
    if (!sentence) {
      showToast("Please enter an example sentence first");
      return;
    }

    setIsAnalyzingSentence(true);
    try {
      const index = await loadCedict();
      const exampleBreakdown = buildExampleBreakdown(sentence, index);
      const analysis = toSentenceAnalysis(exampleBreakdown);

      setSentenceAnalysis(analysis);
      setNewCardForm((prev) => ({
        ...prev,
        examplePinyin: analysis.pinyin,
        exampleTranslation: analysis.translation,
      }));
      showToast("Sentence analyzed successfully");
    } catch (error) {
      console.error("Sentence analysis failed:", error);
      showToast("Could not analyze sentence");
    } finally {
      setIsAnalyzingSentence(false);
    }
  }, [newCardForm.example, showToast]);

  const handleCreateCard = useCallback(async () => {
    if (!currentDeck) {
      showToast("Please select a deck first");
      return;
    }

    const front = newCardForm.front.trim();
    const meaning = newCardForm.meaning.trim();

    if (!front) {
      showToast("Please enter Chinese text for card front");
      return;
    }

    if (!meaning) {
      showToast("Please add a meaning before saving");
      return;
    }

    try {
      const srsInit = initializeNewCard();
      const sentence = normalizeExampleSentence(newCardForm.example);
      const { exampleBreakdown, usageExamples } = await resolveExampleData({
        nextSentence: sentence,
        examplePinyin: newCardForm.examplePinyin,
        exampleTranslation: newCardForm.exampleTranslation,
        cachedAnalysis: sentenceAnalysis,
      });

      const newCard: CardType = flashcardDb.ensureCardFields({
        id: generateId(),
        deckId: currentDeck.id,
        front,
        pinyin: newCardForm.pinyin.trim(),
        meaning,
        example: sentence,
        exampleBreakdown,
        ...(usageExamples ? { usageExamples } : {}),
        ...srsInit,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await flashcardDb.createCard(newCard);
      setCards((prev) => [...prev, newCard]);
      await updateDeckCount(
        currentDeck.id,
        (deckStatsMap[currentDeck.id]?.total || 0) + 1,
      );

      resetCardForm();
      showToast("Card created successfully");
    } catch (error) {
      console.error("Failed to create card:", error);
      showToast("Failed to create card");
    }
  }, [
    currentDeck,
    deckStatsMap,
    newCardForm,
    resetCardForm,
    resolveExampleData,
    sentenceAnalysis,
    setCards,
    showToast,
    updateDeckCount,
  ]);

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) return;

      try {
        await flashcardDb.deleteCard(cardId);
        setCards((prev) => prev.filter((item) => item.id !== cardId));
        await updateDeckCount(
          card.deckId,
          (deckStatsMap[card.deckId]?.total || 1) - 1,
        );
        showToast("Card deleted");
      } catch (error) {
        console.error("Failed to delete card:", error);
        showToast("Failed to delete card");
      }
    },
    [cards, deckStatsMap, setCards, showToast, updateDeckCount],
  );

  const handleEditCard = useCallback(
    async (cardId: string, patch: Partial<CardType>) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) return;

      try {
        const { example, exampleBreakdown, usageExamples } =
          await resolveExampleData({
            currentSentence: card.example,
            currentBreakdown: card.exampleBreakdown,
            nextSentence: patch.example ?? card.example,
            nextBreakdown: patch.exampleBreakdown,
          });

        const updatedCard = flashcardDb.ensureCardFields({
          ...card,
          ...patch,
          example,
          exampleBreakdown,
          ...(usageExamples ? { usageExamples } : { usageExamples: undefined }),
          updatedAt: Date.now(),
        });

        await flashcardDb.updateCard(updatedCard);
        setCards((prev) =>
          prev.map((item) => (item.id === cardId ? updatedCard : item)),
        );
        showToast("Card updated");
      } catch (error) {
        console.error("Failed to update card:", error);
        showToast("Failed to update card");
      }
    },
    [cards, resolveExampleData, setCards, showToast],
  );

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const index = await loadCedict();
      const results = searchCedict(query, index);
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      showToast("Search failed");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, showToast]);

  const handleExport = useCallback(async () => {
    try {
      const data = await flashcardDb.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chinese-flashcards-${new Date().toISOString().split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Export successful");
    } catch (error) {
      console.error("Export failed:", error);
      showToast("Export failed");
    }
  }, [showToast]);

  const handleImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        await flashcardDb.importData(parsed);
        await loadData();
        setCurrentDeck(null);
        setStudyQueue([]);
        setCurrentCardIndex(0);
        setSentenceAnalysis(null);
        showToast("Import successful");
      } catch (error) {
        console.error("Import failed:", error);
        showToast("Import failed: malformed data");
      } finally {
        event.target.value = "";
      }
    },
    [loadData, showToast],
  );

  const speakChinese = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 bg-gradient-to-b from-[#0a0a0c] to-transparent backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            中文闪卡 Chinese Flashcards
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pb-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabType)}
        >
          <TabsList className="grid grid-cols-5 mb-6 bg-slate-800/50 p-1 rounded-xl">
            <TabsTrigger
              value="decks"
              className="flex items-center gap-1 text-xs md:text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Decks</span>
            </TabsTrigger>
            <TabsTrigger
              value="study"
              className="flex items-center gap-1 text-xs md:text-sm"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Study</span>
            </TabsTrigger>
            <TabsTrigger
              value="add"
              className="flex items-center gap-1 text-xs md:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </TabsTrigger>
            <TabsTrigger
              value="search"
              className="flex items-center gap-1 text-xs md:text-sm"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center gap-1 text-xs md:text-sm"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decks">
            <DecksView
              decks={decks}
              deckStatsMap={deckStatsMap}
              onCreateDeck={handleCreateDeck}
              onDeleteDeck={handleDeleteDeck}
              onStudyDeck={startStudySession}
              onSelectDeckForCards={handleSelectDeck}
            />
          </TabsContent>

          <TabsContent value="study">
            <StudyView
              studyQueue={studyQueue}
              currentCardIndex={currentCardIndex}
              onEndSession={endStudySession}
              onRateCard={handleRateCard}
              onSpeakChinese={speakChinese}
            />
          </TabsContent>

          <TabsContent value="add">
            <AddCardView
              currentDeck={currentDeck}
              cardsInDeck={cardsInCurrentDeck}
              formState={newCardForm}
              sentenceAnalysis={sentenceAnalysis}
              isAutoFetching={isAutoFetching}
              isAnalyzingSentence={isAnalyzingSentence}
              onGoDecks={() => setActiveTab("decks")}
              onFormChange={updateForm}
              onAutoFetch={handleAutoFetch}
              onAnalyzeSentence={handleAnalyzeSentence}
              onCreateCard={handleCreateCard}
              onClearForm={resetCardForm}
              onDeleteCard={handleDeleteCard}
              onEditCard={handleEditCard}
            />
          </TabsContent>

          <TabsContent value="search">
            <SearchView
              query={searchQuery}
              isSearching={isSearching}
              results={searchResults}
              onQueryChange={setSearchQuery}
              onSearch={handleSearch}
              onSpeak={speakChinese}
            />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsView
              deckCount={decks.length}
              cardCount={cards.length}
              learnedCount={learnedCount}
              onExport={handleExport}
              onImport={handleImport}
            />
          </TabsContent>
        </Tabs>
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 border border-white/10 px-4 py-2 rounded-full shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}
