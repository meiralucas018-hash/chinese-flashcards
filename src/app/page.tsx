'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  BookOpen,
  Plus,
  Search,
  Settings,
  Trash2,
  Download,
  Upload,
  FolderOpen,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Volume2,
  Loader2,
  X,
  Check,
  Wand2,
  Sparkles,
} from 'lucide-react';
import type { Card as CardType, Deck, TabType, Rating, Segment, ExampleBreakdown, UsageExample } from '@/types';
import Flashcard from '@/components/flashcard/Flashcard';
import { convertPinyinTones } from '@/lib/pinyin';
import { getDueCards, initializeNewCard, calculateNextReview, calculateNextReviewTime } from '@/lib/srs';
import * as flashcardDb from '@/lib/flashcard-db';

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Parse sentence into segments for breakdown display
function parseSentenceToSegments(sentence: string, pinyin: string, meanings?: string[]): Segment[] {
  const chars = sentence.match(/[\u4e00-\u9fff]/g) || [];
  const pinyinParts = pinyin.split(/\s+/);

  const segments: Segment[] = [];

  for (let i = 0; i < chars.length; i++) {
    segments.push({
      chars: [
        {
          char: chars[i],
          pinyin: pinyinParts[i] || '',
          meaning: meanings?.[i] || '',
        },
      ],
      combinedMeaning: '',
      isWord: false,
    });
  }

  return segments;
}

export default function ChineseFlashcardApp() {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('decks');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [currentDeck, setCurrentDeck] = useState<Deck | null>(null);
  const [studyQueue, setStudyQueue] = useState<CardType[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    characters: { char: string; pinyin: string; meaning: string }[];
    words: { word: string; pinyin: string; meaning: string; chars: { char: string; pinyin: string; meaning: string }[] }[];
    sentences?: {
      chinese: string;
      pinyin: string;
      translation: string;
      breakdown: {
        chars: { char: string; pinyin: string; meaning: string }[];
        combinedMeaning: string;
        isWord: boolean;
      }[];
    }[];
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // New deck form state
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');

  // New card form state
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardPinyin, setNewCardPinyin] = useState('');
  const [newCardMeaning, setNewCardMeaning] = useState('');
  const [newCardExample, setNewCardExample] = useState('');
  const [newCardExamplePinyin, setNewCardExamplePinyin] = useState('');
  const [newCardExampleTranslation, setNewCardExampleTranslation] = useState('');
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  
  // Sentence analysis state
  const [sentenceAnalysis, setSentenceAnalysis] = useState<{
    sentence: string;
    translation: string;
    segments: Array<{
      word: string;
      pinyin: string;
      meaning: string;
      startIndex: number;
      endIndex: number;
    }>;
    characters: Array<{ char: string; pinyin: string; meaning: string }>;
  } | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [isAnalyzingSentence, setIsAnalyzingSentence] = useState(false);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedDecks, loadedCards] = await Promise.all([
        flashcardDb.getAllDecks(),
        flashcardDb.getAllCards(),
      ]);
      setDecks(loadedDecks);
      setCards(loadedCards);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Deck operations
  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      showToast('Please enter a deck name');
      return;
    }

    const newDeck: Deck = {
      id: generateId(),
      name: newDeckName.trim(),
      description: newDeckDesc.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cardCount: 0,
    };

    try {
      await flashcardDb.createDeck(newDeck);
      setDecks([...decks, newDeck]);
      setNewDeckName('');
      setNewDeckDesc('');
      showToast('Deck created successfully');
    } catch (error) {
      console.error('Failed to create deck:', error);
      showToast('Failed to create deck');
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    try {
      await flashcardDb.deleteDeck(deckId);
      setDecks(decks.filter((d) => d.id !== deckId));
      setCards(cards.filter((c) => c.deckId !== deckId));
      if (currentDeck?.id === deckId) {
        setCurrentDeck(null);
      }
      showToast('Deck deleted');
    } catch (error) {
      console.error('Failed to delete deck:', error);
      showToast('Failed to delete deck');
    }
  };

  const handleSelectDeck = (deck: Deck) => {
    setCurrentDeck(deck);
    setActiveTab('add');
  };

  // Auto-fetch character meanings from web
  const handleAutoFetch = async () => {
    const inputText = newCardFront.trim();
    
    if (!inputText) {
      showToast('Please enter Chinese character(s) first');
      return;
    }

    // Check input length BEFORE making the API call
    if (inputText.length > 1) {
      showToast('ℹ️ For phrases/multiple characters: Add it to "Example Sentence" field and click "Analyze Sentence Structure" button');
      return;
    }

    // Only proceed for single characters
    setIsAutoFetching(true);
    try {
      const response = await fetch('/api/search-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: inputText }),
      });

      if (!response.ok) throw new Error('Auto-fetch failed');

      const results = await response.json();
      let infoFetched = false;

      // For single character, get the first matching result
      if (results.characters && results.characters.length > 0) {
        const mainChar = results.characters[0];
        if (!newCardPinyin && mainChar.pinyin) {
          setNewCardPinyin(mainChar.pinyin);
          infoFetched = true;
        }
        if (!newCardMeaning && mainChar.meaning) {
          setNewCardMeaning(mainChar.meaning);
          infoFetched = true;
        }
      }

      if (infoFetched) {
        showToast('✓ Character info fetched successfully');
      } else {
        showToast('⚠️ Character found, but meaning not in database. Please enter manually.');
      }
    } catch (error) {
      console.error('Auto-fetch failed:', error);
      showToast('❌ Could not fetch character info');
    } finally {
      setIsAutoFetching(false);
    }
  };

  // Analyze sentence
  const handleAnalyzeSentence = async () => {
    if (!newCardExample.trim()) {
      showToast('Please enter a sentence first');
      return;
    }

    setIsAnalyzingSentence(true);
    try {
      const response = await fetch('/api/analyze-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: newCardExample.trim() }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const analysis = await response.json();
      setSentenceAnalysis(analysis);

      if (analysis.translation) {
        if (!newCardExampleTranslation) {
          setNewCardExampleTranslation(analysis.translation);
        }
        showToast('Sentence analyzed successfully');
      } else {
        showToast('Could not analyze sentence');
      }
    } catch (error) {
      console.error('Sentence analysis failed:', error);
      showToast('Could not analyze sentence');
    } finally {
      setIsAnalyzingSentence(false);
    }
  };

  // Card operations
  const handleCreateCard = async () => {
    if (!currentDeck) {
      showToast('Please select a deck first');
      return;
    }

    if (!newCardFront.trim()) {
      showToast('Please enter the Chinese character(s)');
      return;
    }

    const srsInit = initializeNewCard();

    // Build example breakdown
    let exampleBreakdown: ExampleBreakdown = {
      sentence: '',
      pinyin: '',
      translation: '',
      segments: [],
    };

    if (newCardExample.trim()) {
      const segments = parseSentenceToSegments(newCardExample, newCardExamplePinyin);
      exampleBreakdown = {
        sentence: newCardExample,
        pinyin: newCardExamplePinyin,
        translation: newCardExampleTranslation,
        segments,
      };
    }

    const newCard: CardType = {
      id: generateId(),
      deckId: currentDeck.id,
      front: newCardFront.trim(),
      pinyin: newCardPinyin.trim(),
      meaning: newCardMeaning.trim(),
      example: newCardExample.trim(),
      exampleBreakdown,
      usageExamples: [], // Will be populated via web search in future enhancement
      ...srsInit,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await flashcardDb.createCard(newCard);
      setCards([...cards, newCard]);
      const updatedDeck = { ...currentDeck, cardCount: currentDeck.cardCount + 1 };
      await flashcardDb.updateDeck(updatedDeck);
      setCurrentDeck(updatedDeck);
      setDecks(decks.map((d) => (d.id === updatedDeck.id ? updatedDeck : d)));

      // Clear form
      setNewCardFront('');
      setNewCardPinyin('');
      setNewCardMeaning('');
      setNewCardExample('');
      setNewCardExamplePinyin('');
      setNewCardExampleTranslation('');

      showToast('Card created successfully');
    } catch (error) {
      console.error('Failed to create card:', error);
      showToast('Failed to create card');
    }
  };

  // Study operations
  const startStudySession = useCallback(
    (deckId?: string) => {
      const dueCards = getDueCards(cards, deckId);
      setStudyQueue(dueCards);
      setCurrentCardIndex(0);
      if (dueCards.length > 0) {
        setActiveTab('study');
      } else {
        showToast('No cards due for review');
      }
    },
    [cards]
  );

  const handleRateCard = async (cardId: string, rating: Rating, updates: Partial<CardType>) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const updatedCard = { ...card, ...updates, updatedAt: Date.now() };

    try {
      await flashcardDb.updateCard(updatedCard);
      setCards(cards.map((c) => (c.id === cardId ? updatedCard : c)));

      if (currentCardIndex < studyQueue.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
      } else {
        setStudyQueue([]);
        setCurrentCardIndex(0);
        showToast('Study session complete!');
        setActiveTab('decks');
      }
    } catch (error) {
      console.error('Failed to update card:', error);
      showToast('Failed to save progress');
    }
  };

  // Search operations
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch('/api/search-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      if (!response.ok) throw new Error('Search failed');

      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      showToast('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Import/Export
  const handleExport = async () => {
    try {
      const data = await flashcardDb.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chinese-flashcards-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export successful');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await flashcardDb.importData(data);
      await loadData();
      showToast('Import successful');
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Import failed');
    }
  };

  // TTS
  const speakChinese = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  }, []);

  // Stats
  const getDeckStats = useCallback(
    (deckId: string) => {
      const deckCards = cards.filter((c) => c.deckId === deckId);
      const now = Date.now();
      return {
        total: deckCards.length,
        due: deckCards.filter((c) => c.nextReview <= now).length,
        learned: deckCards.filter((c) => c.repetition > 0).length,
      };
    },
    [cards]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-[#0a0a0c] to-transparent backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            中文闪卡 Chinese Flashcards
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pb-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
          {/* Tab Navigation */}
          <TabsList className="grid grid-cols-5 mb-6 bg-slate-800/50 p-1 rounded-xl">
            <TabsTrigger value="decks" className="flex items-center gap-1 text-xs md:text-sm">
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Decks</span>
            </TabsTrigger>
            <TabsTrigger value="study" className="flex items-center gap-1 text-xs md:text-sm">
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">Study</span>
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-1 text-xs md:text-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-1 text-xs md:text-sm">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1 text-xs md:text-sm">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Decks Tab */}
          <TabsContent value="decks" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-100">Your Decks</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30">
                    <Plus className="w-4 h-4 mr-2" />
                    New Deck
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle>Create New Deck</DialogTitle>
                    <DialogDescription>Create a new deck to organize your flashcards.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="deckName">Deck Name</Label>
                      <Input
                        id="deckName"
                        value={newDeckName}
                        onChange={(e) => setNewDeckName(e.target.value)}
                        placeholder="e.g., HSK 1 Vocabulary"
                        className="bg-slate-800 border-slate-600"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deckDesc">Description (optional)</Label>
                      <Input
                        id="deckDesc"
                        value={newDeckDesc}
                        onChange={(e) => setNewDeckDesc(e.target.value)}
                        placeholder="e.g., Basic HSK level 1 words"
                        className="bg-slate-800 border-slate-600"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateDeck}>Create Deck</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {decks.length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No decks yet. Create your first deck to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {decks.map((deck) => {
                  const stats = getDeckStats(deck.id);
                  return (
                    <Card
                      key={deck.id}
                      className="bg-gradient-to-b from-white/5 to-transparent border-slate-700 hover:border-blue-500/50 transition-colors"
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-slate-100">{deck.name}</CardTitle>
                            <CardDescription className="text-slate-400">
                              {deck.description || 'No description'}
                            </CardDescription>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-900 border-slate-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Deck?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete &quot;{deck.name}&quot; and all its cards. This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteDeck(deck.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-blue-400 border-blue-400/50">
                              {stats.total} cards
                            </Badge>
                            {stats.due > 0 && (
                              <Badge variant="outline" className="text-yellow-400 border-yellow-400/50">
                                {stats.due} due
                              </Badge>
                            )}
                          </div>
                          {stats.total > 0 && (
                            <div>
                              <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>Progress</span>
                                <span>{Math.round((stats.learned / stats.total) * 100)}%</span>
                              </div>
                              <Progress
                                value={(stats.learned / stats.total) * 100}
                                className="h-1.5 bg-slate-700"
                              />
                            </div>
                          )}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => startStudySession(deck.id)}
                              disabled={stats.due === 0}
                              className="flex-1 bg-green-500/20 border border-green-500/40 hover:bg-green-500/30 text-green-400 disabled:opacity-50"
                            >
                              <GraduationCap className="w-4 h-4 mr-1" />
                              Study ({stats.due})
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectDeck(deck)}
                              className="flex-1 border-slate-600 hover:bg-slate-700"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Cards
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Study Tab */}
          <TabsContent value="study">
            {studyQueue.length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-400">
                  <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">No cards to study right now.</p>
                  <p className="text-sm">Select a deck from the Decks tab to start studying.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStudyQueue([]);
                      setActiveTab('decks');
                    }}
                    className="text-slate-400"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    End Session
                  </Button>
                  <div className="text-slate-400 text-sm">
                    Card {currentCardIndex + 1} of {studyQueue.length}
                  </div>
                </div>
                <Progress
                  value={((currentCardIndex + 1) / studyQueue.length) * 100}
                  className="h-1 bg-slate-700"
                />
                <Flashcard
                  card={studyQueue[currentCardIndex]}
                  onRate={handleRateCard}
                  onTTS={speakChinese}
                />
              </div>
            )}
          </TabsContent>

          {/* Add Tab */}
          <TabsContent value="add">
            {!currentDeck ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center text-slate-400">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">Select a deck first to add cards.</p>
                  <Button onClick={() => setActiveTab('decks')}>Go to Decks</Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-to-b from-white/5 to-transparent border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add Card to {currentDeck.name}
                  </CardTitle>
                  <CardDescription>Add a new flashcard with Chinese character, pinyin, and meaning.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="charInput">Chinese Character(s) *</Label>
                      <Input
                        id="charInput"
                        value={newCardFront}
                        onChange={(e) => setNewCardFront(e.target.value)}
                        placeholder="你好"
                        className="bg-slate-800 border-slate-600 text-2xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pinyinInput">Pinyin (with tone numbers)</Label>
                      <Input
                        id="pinyinInput"
                        value={newCardPinyin}
                        onChange={(e) => setNewCardPinyin(e.target.value)}
                        placeholder="ni3 hao3"
                        className="bg-slate-800 border-slate-600"
                      />
                      {newCardPinyin && (
                        <p className="text-sm text-blue-400">{convertPinyinTones(newCardPinyin)}</p>
                      )}
                    </div>
                  </div>

                  {/* Auto-fetch button */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoFetch}
                      disabled={isAutoFetching || !newCardFront.trim()}
                      className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                    >
                      {isAutoFetching ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Auto-fetch Meanings
                    </Button>
                    <span className="text-xs text-slate-500">
                      Search the web for character meanings
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meaningInput">Meaning *</Label>
                    <Input
                      id="meaningInput"
                      value={newCardMeaning}
                      onChange={(e) => setNewCardMeaning(e.target.value)}
                      placeholder="Hello, Hi"
                      className="bg-slate-800 border-slate-600"
                    />
                  </div>

                  <div className="border-t border-slate-700 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Example Sentence (optional)</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="exampleInput">Example</Label>
                        <Textarea
                          id="exampleInput"
                          value={newCardExample}
                          onChange={(e) => setNewCardExample(e.target.value)}
                          placeholder="你好吗？"
                          className="bg-slate-800 border-slate-600"
                          rows={2}
                        />
                      </div>

                      {/* Analyze sentence button */}
                      <div className="flex items-center gap-2 pt-3 pb-3 border-b border-slate-600">
                        <Button
                          variant="outline"
                          onClick={handleAnalyzeSentence}
                          disabled={isAnalyzingSentence || !newCardExample.trim()}
                          className="bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30"
                        >
                          {isAnalyzingSentence ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4 mr-2" />
                          )}
                          Analyze Sentence Structure
                        </Button>
                        <span className="text-xs text-slate-400">
                          Auto-detect words and show meaning breakdown
                        </span>
                      </div>

                      {/* Sentence analysis display */}
                      {sentenceAnalysis && sentenceAnalysis.sentence === newCardExample && (
                        <div className="mt-4 p-3 bg-slate-800/50 border border-blue-500/30 rounded-lg">
                          <div className="mb-3">
                            <p className="text-xs text-slate-400 mb-1">Sentence Structure:</p>
                            <div className="flex flex-wrap gap-1 items-baseline">
                              {sentenceAnalysis.segments.map((segment, idx) => (
                                <div
                                  key={idx}
                                  className="relative group cursor-help"
                                  onMouseEnter={() => setHoveredSegment(idx)}
                                  onMouseLeave={() => setHoveredSegment(null)}
                                >
                                  <span
                                    className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                                      hoveredSegment === idx
                                        ? 'bg-blue-500/30 border-blue-400'
                                        : 'border-b-2 border-dashed border-blue-400/50'
                                    }`}
                                  >
                                    {segment.word}
                                  </span>
                                  {hoveredSegment === idx && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs text-white whitespace-nowrap z-10 pointer-events-none">
                                      {segment.meaning}
                                      {segment.pinyin && <div className="text-blue-300">{segment.pinyin}</div>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          {sentenceAnalysis.translation && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Overall translation:</p>
                              <p className="text-sm text-blue-300">{sentenceAnalysis.translation}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2 pt-3">
                        <div className="space-y-2">
                          <Label htmlFor="examplePinyin">Example Pinyin</Label>
                          <Input
                            id="examplePinyin"
                            value={newCardExamplePinyin}
                            onChange={(e) => setNewCardExamplePinyin(e.target.value)}
                            placeholder="ni3 hao3 ma5"
                            className="bg-slate-800 border-slate-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="exampleTranslation">Translation</Label>
                          <Input
                            id="exampleTranslation"
                            value={newCardExampleTranslation}
                            onChange={(e) => setNewCardExampleTranslation(e.target.value)}
                            placeholder="How are you?"
                            className="bg-slate-800 border-slate-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCreateCard} className="flex-1">
                      <Check className="w-4 h-4 mr-2" />
                      Add Card
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNewCardFront('');
                        setNewCardPinyin('');
                        setNewCardMeaning('');
                        setNewCardExample('');
                        setNewCardExamplePinyin('');
                        setNewCardExampleTranslation('');
                        setSentenceAnalysis(null);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search">
            <Card className="bg-gradient-to-b from-white/5 to-transparent border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search Characters
                </CardTitle>
                <CardDescription>Search for Chinese characters, words, and their meanings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Chinese character or word..."
                    className="bg-slate-800 border-slate-600"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>

                {searchResults && (
                  <div className="space-y-4 mt-6">
                    {searchResults.characters && searchResults.characters.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-purple-400 mb-3">Characters</h4>
                        <div className="grid gap-2">
                          {searchResults.characters.map((char, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className="text-3xl text-blue-400 cursor-pointer hover:scale-110 transition-transform"
                                  onClick={() => speakChinese(char.char)}
                                >
                                  {char.char}
                                </span>
                                <div>
                                  <p className="text-blue-300">{convertPinyinTones(char.pinyin)}</p>
                                  <p className="text-sm text-slate-400">{char.meaning}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => speakChinese(char.char)}
                              >
                                <Volume2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchResults.words && searchResults.words.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-purple-400 mb-3">Words</h4>
                        <div className="grid gap-2">
                          {searchResults.words.map((word, i) => (
                            <div
                              key={i}
                              className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span
                                  className="text-2xl text-blue-400 cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => speakChinese(word.word)}
                                >
                                  {word.word}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-blue-300">{convertPinyinTones(word.pinyin)}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => speakChinese(word.word)}
                                  >
                                    <Volume2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-slate-300 mb-2">{word.meaning}</p>
                              {word.chars && word.chars.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {word.chars.map((c, ci) => (
                                    <Badge
                                      key={ci}
                                      variant="outline"
                                      className="text-slate-400 border-slate-600"
                                    >
                                      {c.char}: {c.meaning}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="bg-gradient-to-b from-white/5 to-transparent border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Settings
                </CardTitle>
                <CardDescription>Manage your data and application settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-slate-300">Data Management</h4>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleExport} variant="outline" className="gap-2">
                      <Download className="w-4 h-4" />
                      Export Data
                    </Button>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="hidden"
                        id="import-file"
                      />
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => document.getElementById('import-file')?.click()}
                      >
                        <Upload className="w-4 h-4" />
                        Import Data
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Export your flashcards to back up your progress. Import to restore from a backup.
                  </p>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Statistics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-400">{decks.length}</p>
                      <p className="text-xs text-slate-400">Decks</p>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-400">{cards.length}</p>
                      <p className="text-xs text-slate-400">Cards</p>
                    </div>
                    <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-400">
                        {cards.filter((c) => c.repetition > 0).length}
                      </p>
                      <p className="text-xs text-slate-400">Learned</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">About</h4>
                  <p className="text-sm text-slate-400">
                    Chinese Flashcard App - A spaced repetition learning tool for Chinese characters.
                    Features include stroke beautification for practice drawing, comprehensive character
                    breakdowns with hover tooltips, and automatic web search for character meanings.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 border border-white/10 px-4 py-2 rounded-full shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}
