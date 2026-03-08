import { useMemo, useState } from "react";
import {
  CircleHelp,
  Check,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { convertPinyinTones } from "@/lib/pinyin";
import type { Card as CardType, Deck, SentenceAnalysis } from "@/types";
import CharacterBreakdown from "@/components/flashcard/CharacterBreakdown";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export interface NewCardFormState {
  front: string;
  pinyin: string;
  meaning: string;
  example: string;
  examplePinyin: string;
  exampleTranslation: string;
}

interface AddCardViewProps {
  currentDeck: Deck | null;
  cardsInDeck: CardType[];
  formState: NewCardFormState;
  sentenceAnalysis: SentenceAnalysis | null;
  isAutoFetching: boolean;
  isAnalyzingSentence: boolean;
  onGoDecks: () => void;
  onFormChange: (patch: Partial<NewCardFormState>) => void;
  onAutoFetch: () => Promise<void>;
  onAnalyzeSentence: () => Promise<void>;
  onCreateCard: () => Promise<void>;
  onClearForm: () => void;
  onDeleteCard: (cardId: string) => Promise<void>;
  onEditCard: (cardId: string, patch: Partial<CardType>) => Promise<void>;
}

function EditableCardRow({
  card,
  onDelete,
  onSave,
}: {
  card: CardType;
  onDelete: (cardId: string) => Promise<void>;
  onSave: (cardId: string, patch: Partial<CardType>) => Promise<void>;
}) {
  const [draftFront, setDraftFront] = useState(card.front);
  const [draftPinyin, setDraftPinyin] = useState(card.pinyin);
  const [draftMeaning, setDraftMeaning] = useState(card.meaning);
  const [draftExample, setDraftExample] = useState(card.example);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-lg text-blue-300 font-semibold">{card.front}</div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 hover:bg-slate-700"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle>Edit Card</DialogTitle>
                <DialogDescription>
                  Update card fields and save changes locally.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>Front</Label>
                  <Input
                    value={draftFront}
                    onChange={(event) => setDraftFront(event.target.value)}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Pinyin</Label>
                  <Input
                    value={draftPinyin}
                    onChange={(event) => setDraftPinyin(event.target.value)}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Meaning</Label>
                  <Input
                    value={draftMeaning}
                    onChange={(event) => setDraftMeaning(event.target.value)}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Example</Label>
                  <Textarea
                    value={draftExample}
                    onChange={(event) => setDraftExample(event.target.value)}
                    className="bg-slate-800 border-slate-600"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    await onSave(card.id, {
                      front: draftFront.trim(),
                      pinyin: draftPinyin.trim(),
                      meaning: draftMeaning.trim(),
                      example: draftExample.trim(),
                    });
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:bg-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-slate-900 border-slate-700">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Card?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the card {card.front}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void onDelete(card.id)}
                  className="bg-red-500 hover:bg-red-600"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="text-sm text-slate-300">
        {convertPinyinTones(card.pinyin)}
      </div>
      <div className="text-sm text-slate-400">{card.meaning}</div>
    </div>
  );
}

function formatTranslationSource(
  source: "exact" | "rule" | "fallback",
): string {
  if (source === "exact") {
    return "Exact dictionary";
  }
  if (source === "rule") {
    return "Rule-based";
  }

  return "Literal fallback";
}

function getTranslationSourceExplanation(
  source: "exact" | "rule" | "fallback",
): string {
  if (source === "exact") {
    return "This sentence matched a direct CEDICT entry, so the app used the dictionary gloss first.";
  }
  if (source === "rule") {
    return "This sentence was segmented locally and then rewritten with the offline rule pipeline.";
  }

  return "No stronger match was found, so the app kept a more literal gloss from the segmented meanings.";
}

function shouldShowLiteralGloss(
  translation: string,
  literalGloss?: string,
): boolean {
  const normalizedLiteralGloss = literalGloss?.trim() || "";
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[.?!,;:]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  return (
    Boolean(normalizedLiteralGloss) &&
    normalize(translation) !== normalize(normalizedLiteralGloss)
  );
}

export default function AddCardView({
  currentDeck,
  cardsInDeck,
  formState,
  sentenceAnalysis,
  isAutoFetching,
  isAnalyzingSentence,
  onGoDecks,
  onFormChange,
  onAutoFetch,
  onAnalyzeSentence,
  onCreateCard,
  onClearForm,
  onDeleteCard,
  onEditCard,
}: AddCardViewProps) {
  const analysisPreview = useMemo(() => {
    if (!sentenceAnalysis) return null;
    if (!formState.example.trim()) return null;
    if (sentenceAnalysis.sentence !== formState.example.trim()) return null;
    return sentenceAnalysis;
  }, [sentenceAnalysis, formState.example]);

  if (!currentDeck) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="py-12 text-center text-slate-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-4">Select a deck first to add cards.</p>
          <Button onClick={onGoDecks}>Go to Decks</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-b from-white/5 to-transparent border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Card to {currentDeck.name}
          </CardTitle>
          <CardDescription>
            Add a card with sentence-aware breakdown data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="charInput">Chinese Character(s) *</Label>
              <Input
                id="charInput"
                value={formState.front}
                onChange={(event) =>
                  onFormChange({ front: event.target.value })
                }
                placeholder="你好"
                className="bg-slate-800 border-slate-600 text-2xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pinyinInput">Pinyin (tone numbers)</Label>
              <Input
                id="pinyinInput"
                value={formState.pinyin}
                onChange={(event) =>
                  onFormChange({ pinyin: event.target.value })
                }
                placeholder="ni3 hao3"
                className="bg-slate-800 border-slate-600"
              />
              {formState.pinyin && (
                <p className="text-sm text-blue-400">
                  {convertPinyinTones(formState.pinyin)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onAutoFetch()}
              disabled={isAutoFetching || !formState.front.trim()}
              className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
            >
              {isAutoFetching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Auto-fill from CEDICT
            </Button>
            <span className="text-xs text-slate-500">
              Best for single characters and exact words
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meaningInput">Meaning *</Label>
            <Input
              id="meaningInput"
              value={formState.meaning}
              onChange={(event) =>
                onFormChange({ meaning: event.target.value })
              }
              placeholder="Hello, Hi"
              className="bg-slate-800 border-slate-600"
            />
          </div>

          <div className="border-t border-slate-700 pt-4 mt-4 space-y-3">
            <h4 className="text-sm font-medium text-slate-300">
              Example Sentence (optional)
            </h4>
            <div className="space-y-2">
              <Label htmlFor="exampleInput">Example</Label>
              <Textarea
                id="exampleInput"
                value={formState.example}
                onChange={(event) =>
                  onFormChange({ example: event.target.value })
                }
                placeholder="你好吗？"
                className="bg-slate-800 border-slate-600"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2 pt-1 pb-3 border-b border-slate-600">
              <Button
                variant="outline"
                onClick={() => void onAnalyzeSentence()}
                disabled={isAnalyzingSentence || !formState.example.trim()}
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
                Word-level segmentation with character fallback
              </span>
            </div>

            {analysisPreview && (
              <div className="mt-2 p-3 bg-slate-800/50 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-slate-400 mb-2">Analysis preview</p>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-blue-200">
                    {formatTranslationSource(analysisPreview.translationSource)}
                  </span>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-600/70 bg-slate-900/70 px-2 py-1 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                        Why this?
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72 border-slate-700 bg-slate-950 text-slate-200">
                      <p className="text-sm leading-6">
                        {getTranslationSourceExplanation(
                          analysisPreview.translationSource,
                        )}
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                  {typeof analysisPreview.confidence === "number" && (
                    <span className="text-slate-400">
                      Confidence {Math.round(analysisPreview.confidence * 100)}%
                    </span>
                  )}
                </div>
                <CharacterBreakdown
                  segments={analysisPreview.segments}
                  pinyin={analysisPreview.pinyin || formState.examplePinyin}
                  translation={
                    analysisPreview.translation || formState.exampleTranslation
                  }
                  literalGloss={analysisPreview.literalGloss}
                />
                {shouldShowLiteralGloss(
                  analysisPreview.translation,
                  analysisPreview.literalGloss,
                ) && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Translation
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        {analysisPreview.translation}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700/80 bg-slate-900/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Literal Gloss
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {analysisPreview.literalGloss || "-"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 pt-1">
              <div className="space-y-2">
                <Label htmlFor="examplePinyin">Example Pinyin</Label>
                <Input
                  id="examplePinyin"
                  value={formState.examplePinyin}
                  onChange={(event) =>
                    onFormChange({ examplePinyin: event.target.value })
                  }
                  placeholder="ni3 hao3 ma5"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exampleTranslation">Translation</Label>
                <Input
                  id="exampleTranslation"
                  value={formState.exampleTranslation}
                  onChange={(event) =>
                    onFormChange({ exampleTranslation: event.target.value })
                  }
                  placeholder="How are you?"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => void onCreateCard()} className="flex-1">
              <Check className="w-4 h-4 mr-2" />
              Add Card
            </Button>
            <Button variant="outline" onClick={onClearForm}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-b from-white/5 to-transparent border-slate-700">
        <CardHeader>
          <CardTitle>Deck Cards</CardTitle>
          <CardDescription>
            View, edit, and delete cards in {currentDeck.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cardsInDeck.length === 0 ? (
            <p className="text-sm text-slate-400">No cards in this deck yet.</p>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {cardsInDeck.map((card) => (
                <EditableCardRow
                  key={card.id}
                  card={card}
                  onDelete={onDeleteCard}
                  onSave={onEditCard}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
