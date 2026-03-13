"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  BarChart3,
  FolderOpen,
  Loader2,
  Plus,
  Settings,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Card as CardType,
  Deck,
  QuizPerformanceInput,
  Rating,
  TabType,
} from "@/types";
import { getDueCards, initializeNewCard } from "@/lib/srs";
import * as flashcardDb from "@/lib/flashcard-db";
import DecksView from "@/components/views/DecksView";
import StudyView from "@/components/views/StudyView";
import AddCardView from "@/components/views/AddCardView";
import SettingsView from "@/components/views/SettingsView";
import StatisticsView from "@/components/views/StatisticsView";
import { useToastMessage } from "@/hooks/use-toast-message";
import { useFlashcardData } from "@/hooks/use-flashcard-data";
import {
  clearBadVoiceCache,
  getBestChineseVoice,
  getTtsDiagnosticsSnapshot,
  isBadVoiceCached,
  loadSpeechVoices,
  speakText,
  subscribeToTtsDiagnostics,
  type SpeakTextOptions,
  type TtsDiagnosticsSnapshot,
} from "@/lib/tts";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function normalizeWordKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

interface TtsSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  studyMode: boolean;
  preferredLang: string;
}

const TTS_SETTINGS_STORAGE_KEY = "chinese-flashcards:tts-settings";

const DEFAULT_TTS_SETTINGS: TtsSettings = {
  voiceURI: "",
  rate: 0.92,
  pitch: 1,
  volume: 1,
  studyMode: false,
  preferredLang: "zh-CN",
};

function normalizeTtsSettings(input: unknown): TtsSettings {
  const source =
    input && typeof input === "object" ? (input as Partial<TtsSettings>) : {};

  const numberInRange = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    if (typeof value !== "number" || Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  return {
    voiceURI:
      typeof source.voiceURI === "string"
        ? source.voiceURI
        : DEFAULT_TTS_SETTINGS.voiceURI,
    rate: numberInRange(source.rate, DEFAULT_TTS_SETTINGS.rate, 0.5, 1.5),
    pitch: numberInRange(source.pitch, DEFAULT_TTS_SETTINGS.pitch, 0.5, 1.5),
    volume: numberInRange(source.volume, DEFAULT_TTS_SETTINGS.volume, 0, 1),
    studyMode:
      typeof source.studyMode === "boolean"
        ? source.studyMode
        : DEFAULT_TTS_SETTINGS.studyMode,
    preferredLang:
      typeof source.preferredLang === "string" &&
      source.preferredLang.trim().length > 0
        ? source.preferredLang
        : DEFAULT_TTS_SETTINGS.preferredLang,
  };
}

export default function ChineseFlashcardApp() {
  const [activeTab, setActiveTab] = useState<TabType>("decks");
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [studyQueue, setStudyQueue] = useState<CardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_TTS_SETTINGS;
    }

    try {
      const raw = window.localStorage.getItem(TTS_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_TTS_SETTINGS;
      }

      return normalizeTtsSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_TTS_SETTINGS;
    }
  });
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [ttsDiagnostics, setTtsDiagnostics] = useState<TtsDiagnosticsSnapshot>(
    () => getTtsDiagnosticsSnapshot(),
  );

  const { toast, showToast, clearToast } = useToastMessage();
  const ttsRequestCounterRef = useRef(0);
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

  useEffect(() => {
    if (decks.length === 0) {
      if (currentDeck) {
        setCurrentDeck(null);
      }
      return;
    }

    if (!currentDeck) {
      setCurrentDeck(decks[0]);
      return;
    }

    const stillExists = decks.some((deck) => deck.id === currentDeck.id);
    if (!stillExists) {
      setCurrentDeck(decks[0]);
    }
  }, [currentDeck, decks]);

  const learnedCount = useMemo(
    () => cards.filter((card) => card.repetition > 0).length,
    [cards],
  );

  useEffect(() => {
    let isMounted = true;
    const synthesis =
      typeof window !== "undefined" && "speechSynthesis" in window
        ? window.speechSynthesis
        : null;

    const loadVoices = async () => {
      if (isMounted) {
        setVoicesLoaded(false);
      }
      const voices = await loadSpeechVoices();
      if (!isMounted) return;
      setSpeechVoices(voices);
      setVoicesLoaded(true);
    };

    const handleVoicesChanged = () => {
      if (!synthesis || !isMounted) return;
      setSpeechVoices(synthesis.getVoices());
      setVoicesLoaded(true);
    };

    void loadVoices();
    synthesis?.addEventListener("voiceschanged", handleVoicesChanged);

    return () => {
      isMounted = false;
      synthesis?.removeEventListener("voiceschanged", handleVoicesChanged);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      TTS_SETTINGS_STORAGE_KEY,
      JSON.stringify(ttsSettings),
    );
  }, [ttsSettings]);

  useEffect(() => subscribeToTtsDiagnostics(setTtsDiagnostics), []);

  const bestChineseVoice = useMemo(
    () => getBestChineseVoice(speechVoices, ttsSettings.preferredLang),
    [speechVoices, ttsSettings.preferredLang, ttsDiagnostics],
  );

  const storedSelectedVoice = useMemo(() => {
    if (!speechVoices.length) return null;

    if (ttsSettings.voiceURI) {
      const matched = speechVoices.find(
        (voice) => voice.voiceURI === ttsSettings.voiceURI,
      );
      if (matched) return matched;
    }

    return null;
  }, [speechVoices, ttsSettings.voiceURI]);

  const selectedVoice = useMemo(() => {
    if (
      storedSelectedVoice &&
      !isBadVoiceCached(storedSelectedVoice.voiceURI)
    ) {
      return storedSelectedVoice;
    }

    return bestChineseVoice;
  }, [bestChineseVoice, storedSelectedVoice, ttsDiagnostics]);

  useEffect(() => {
    if (!ttsSettings.voiceURI || !speechVoices.length) {
      return;
    }

    const isStoredVoiceAvailable = speechVoices.some(
      (voice) => voice.voiceURI === ttsSettings.voiceURI,
    );

    if (!isStoredVoiceAvailable) {
      setTtsSettings((prev) => ({ ...prev, voiceURI: "" }));
    }
  }, [speechVoices, ttsSettings.voiceURI]);

  const hasDedicatedChineseVoice = Boolean(bestChineseVoice);

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
      const trimmedName = name.trim();
      const trimmedDescription = description.trim();

      if (!trimmedName) {
        showToast("Please enter a deck name");
        return false;
      }

      const hasDuplicateName = decks.some(
        (deck) => deck.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (hasDuplicateName) {
        showToast("A deck with this name already exists");
        return false;
      }

      const newDeck: Deck = {
        id: generateId(),
        name: trimmedName,
        description: trimmedDescription,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cardCount: 0,
      };

      try {
        await flashcardDb.createDeck(newDeck);
        setDecks((prev) => [...prev, newDeck]);
        showToast("Deck created successfully");
        return true;
      } catch (error) {
        console.error("Failed to create deck:", error);
        showToast("Failed to create deck");
        return false;
      }
    },
    [decks, setDecks, showToast],
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

      setActiveTab("decks");
    },
    [cards, showToast],
  );

  const handleRateCard = useCallback(
    async (cardId: string, rating: Rating, updates: Partial<CardType>) => {
      const card = cards.find((item) => item.id === cardId);
      if (!card) return;

      const updatedCard: CardType = flashcardDb.ensureCardFields({
        ...card,
        ...updates,
        updatedAt: Date.now(),
      });

      try {
        await flashcardDb.updateCard(updatedCard);
        await flashcardDb.createReviewPerformanceEvent({
          cardId: card.id,
          deckId: card.deckId,
          rating,
          isSuccess: rating !== "again",
        });
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

  const endStudySession = useCallback(() => {
    setStudyQueue([]);
    setCurrentCardIndex(0);
    setActiveTab("decks");
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value as TabType;
    setActiveTab(nextTab);
  }, []);

  const handleRecordQuizResult = useCallback(
    async (input: QuizPerformanceInput) => {
      try {
        await flashcardDb.createQuizPerformanceEvent(input);
      } catch (error) {
        console.error("Failed to save quiz performance event:", error);
      }
    },
    [],
  );

  const handleSaveCard = useCallback(
    async (previewCard: CardType) => {
      if (!currentDeck) {
        showToast("Please select a deck first");
        return false;
      }

      const duplicateWord = cards.some(
        (card) =>
          card.deckId === currentDeck.id &&
          normalizeWordKey(card.front) === normalizeWordKey(previewCard.front),
      );

      if (duplicateWord) {
        showToast("This Chinese word already exists in the selected deck");
        return false;
      }

      try {
        const srsInit = initializeNewCard();
        const cardToSave = flashcardDb.ensureCardFields({
          ...previewCard,
          id: generateId(),
          deckId: currentDeck.id,
          ...srsInit,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await flashcardDb.createCard(cardToSave);
        setCards((prev) => [...prev, cardToSave]);
        await updateDeckCount(
          currentDeck.id,
          (deckStatsMap[currentDeck.id]?.total || 0) + 1,
        );
        showToast("Card created successfully");
        return true;
      } catch (error) {
        console.error("Failed to create card:", error);
        showToast("Failed to create card");
        return false;
      }
    },
    [cards, currentDeck, deckStatsMap, setCards, showToast, updateDeckCount],
  );

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
        showToast("Import successful");
      } catch (error) {
        console.error("Import failed:", error);
        showToast(
          error instanceof Error
            ? error.message
            : "Import failed: malformed data",
        );
      } finally {
        event.target.value = "";
      }
    },
    [loadData, showToast],
  );

  const updateTtsSettings = useCallback((patch: Partial<TtsSettings>) => {
    setTtsSettings((prev) => normalizeTtsSettings({ ...prev, ...patch }));
  }, []);

  const speakChinese = useCallback(
    (text: string, extraOptions?: Partial<SpeakTextOptions>) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const baseRate = ttsSettings.studyMode
        ? Math.max(0.55, ttsSettings.rate - 0.15)
        : ttsSettings.rate;
      const requestedVoiceURI =
        selectedVoice?.voiceURI ||
        (ttsSettings.voiceURI && !isBadVoiceCached(ttsSettings.voiceURI)
          ? ttsSettings.voiceURI
          : undefined);

      const options: SpeakTextOptions = {
        lang: ttsSettings.preferredLang,
        preferredLang: ttsSettings.preferredLang,
        voiceURI: requestedVoiceURI,
        rate: baseRate,
        pitch: ttsSettings.pitch,
        volume: ttsSettings.volume,
        debugSource: extraOptions?.debugSource || "app",
        ...extraOptions,
      };

      void (async () => {
        clearToast();
        const requestId = ttsRequestCounterRef.current + 1;
        ttsRequestCounterRef.current = requestId;

        const success = await speakText(trimmedText, options);

        if (requestId !== ttsRequestCounterRef.current) {
          return;
        }

        if (!success) {
          const diagnostics = getTtsDiagnosticsSnapshot();
          showToast(
            diagnostics.cleanStatusMessage ||
              "Chinese TTS is unavailable in this browser/voice configuration. Chrome currently works better for this feature.",
          );
        }
      })();
    },
    [clearToast, selectedVoice?.voiceURI, showToast, ttsSettings],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden pb-16">
      <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-[#040405] via-[#040405]/96 to-transparent backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <h1 className="bg-gradient-to-r from-slate-100 via-cyan-200 to-cyan-400 bg-clip-text text-center text-2xl font-bold text-transparent">
            NeonLang
          </h1>
        </div>
      </header>

      <main className="app-scroll-pane mx-auto h-full max-w-5xl overflow-y-auto overscroll-contain px-4 pb-4 pt-28">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
        >
          <TabsList className="mx-auto mb-8 grid h-[60px] w-full max-w-2xl grid-cols-4 gap-2 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,11,13,0.94),rgba(5,6,8,0.98))] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            <TabsTrigger
              value="decks"
               className="flex h-full items-center gap-1 rounded-[16px] px-3 text-xs text-slate-400 data-[state=active]:bg-black/88 data-[state=active]:text-cyan-100 md:text-sm"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Decks</span>
            </TabsTrigger>
            <TabsTrigger
              value="statistics"
               className="flex h-full items-center gap-1 rounded-[16px] px-3 text-xs text-slate-400 data-[state=active]:bg-black/88 data-[state=active]:text-cyan-100 md:text-sm"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Statistics</span>
            </TabsTrigger>
            <TabsTrigger
              value="add"
               className="flex h-full items-center gap-1 rounded-[16px] px-3 text-xs text-slate-400 data-[state=active]:bg-black/88 data-[state=active]:text-cyan-100 md:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
               className="flex h-full items-center gap-1 rounded-[16px] px-3 text-xs text-slate-400 data-[state=active]:bg-black/88 data-[state=active]:text-cyan-100 md:text-sm"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="decks">
            {studyQueue.length > 0 ? (
              <StudyView
                studyQueue={studyQueue}
                currentCardIndex={currentCardIndex}
                onEndSession={endStudySession}
                onRateCard={handleRateCard}
                onRecordQuizResult={handleRecordQuizResult}
                onSpeakChinese={speakChinese}
                hasDedicatedChineseVoice={hasDedicatedChineseVoice}
              />
            ) : (
              <DecksView
                decks={decks}
                deckStatsMap={deckStatsMap}
                onCreateDeck={handleCreateDeck}
                onDeleteDeck={handleDeleteDeck}
                onStudyDeck={startStudySession}
                onSelectDeckForCards={handleSelectDeck}
              />
            )}
          </TabsContent>

          <TabsContent value="statistics">
            <StatisticsView
              decks={decks}
              cards={cards}
              deckStatsMap={deckStatsMap}
            />
          </TabsContent>

          <TabsContent value="add">
            <AddCardView
              decks={decks}
              currentDeck={currentDeck}
              allCards={cards}
              cardsInDeck={cardsInCurrentDeck}
              onGoDecks={() => setActiveTab("decks")}
              onSelectDeck={(deckId) => {
                const selectedDeck = decks.find((deck) => deck.id === deckId);
                if (selectedDeck) {
                  setCurrentDeck(selectedDeck);
                }
              }}
              onSaveCard={handleSaveCard}
              onDeleteCard={handleDeleteCard}
              onSpeakChinese={speakChinese}
              hasDedicatedChineseVoice={hasDedicatedChineseVoice}
            />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsView
              deckCount={decks.length}
              cardCount={cards.length}
              learnedCount={learnedCount}
              onExport={handleExport}
              onImport={handleImport}
              voices={speechVoices}
              selectedVoiceURI={
                ttsSettings.voiceURI || selectedVoice?.voiceURI || ""
              }
              selectedVoiceLabel={
                storedSelectedVoice
                  ? `${storedSelectedVoice.name} (${storedSelectedVoice.lang})`
                  : selectedVoice
                    ? `${selectedVoice.name} (${selectedVoice.lang})`
                    : "Default browser voice"
              }
              selectedVoiceFailed={isBadVoiceCached(ttsSettings.voiceURI)}
              ttsDiagnostics={ttsDiagnostics}
              playbackRate={ttsSettings.rate}
              pitch={ttsSettings.pitch}
              volume={ttsSettings.volume}
              studyMode={ttsSettings.studyMode}
              preferredLang={ttsSettings.preferredLang}
              voicesLoaded={voicesLoaded}
              hasDedicatedChineseVoice={hasDedicatedChineseVoice}
              onTtsSettingChange={updateTtsSettings}
              onSpeakTest={speakChinese}
              onClearBadVoiceCache={clearBadVoiceCache}
            />
          </TabsContent>
        </Tabs>
      </main>

      {toast && (
        <div className="app-panel-soft fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-fadeIn rounded-full px-4 py-2">
          {toast}
        </div>
      )}
    </div>
  );
}
