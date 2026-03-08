import { useMemo, useState } from "react";
import {
  Check,
  CircleHelp,
  FolderOpen,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
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
  onEditCard: (cardId: string, patch: EditableCardPatch) => Promise<void>;
}

type EditableCardPatch = Pick<
  CardType,
  "front" | "pinyin" | "meaning" | "example"
> &
  Partial<Pick<CardType, "exampleBreakdown" | "usageExamples">>;

function EditableCardRow({
  card,
  onDelete,
  onSave,
}: {
  card: CardType;
  onDelete: (cardId: string) => Promise<void>;
  onSave: (cardId: string, patch: EditableCardPatch) => Promise<void>;
}) {
  const [draftFront, setDraftFront] = useState(card.front);
  const [draftPinyin, setDraftPinyin] = useState(card.pinyin);
  const [draftMeaning, setDraftMeaning] = useState(card.meaning);
  const [draftExample, setDraftExample] = useState(card.example);

  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-slate-900/55 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="font-chinese-ui text-xl font-semibold text-blue-200">
            {card.front}
          </div>
          <div className="text-sm text-slate-300">
            {convertPinyinTones(card.pinyin)}
          </div>
          <div className="text-sm text-slate-400">{card.meaning}</div>
        </div>
        <div className="flex gap-2 self-start">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600/80 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="border-slate-700 bg-slate-900">
              <DialogHeader>
                <DialogTitle>Edit Card</DialogTitle>
                <DialogDescription>
                  Update the card and save it locally.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>Front</Label>
                  <Input
                    value={draftFront}
                    onChange={(event) => setDraftFront(event.target.value)}
                    className="border-slate-600 bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Pinyin</Label>
                  <Input
                    value={draftPinyin}
                    onChange={(event) => setDraftPinyin(event.target.value)}
                    className="border-slate-600 bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Meaning</Label>
                  <Input
                    value={draftMeaning}
                    onChange={(event) => setDraftMeaning(event.target.value)}
                    className="border-slate-600 bg-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Example</Label>
                  <Textarea
                    value={draftExample}
                    onChange={(event) => setDraftExample(event.target.value)}
                    className="border-slate-600 bg-slate-800"
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
                      exampleBreakdown: card.exampleBreakdown,
                      usageExamples: card.usageExamples,
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
                className="text-red-400 hover:bg-red-500/15 hover:text-red-200"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-slate-700 bg-slate-900">
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
      {card.example.trim() && (
        <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
          Example: {card.example}
        </div>
      )}
    </div>
  );
}

function getTranslationSourceExplanation(
  source: "exact" | "rule" | "fallback",
): string {
  if (source === "exact") {
    return "A full sentence match was found in the dictionary, so the English comes directly from that entry.";
  }
  if (source === "rule") {
    return "The app broke the sentence into known words, then rewrote the meaning into more natural English.";
  }

  return "No stronger sentence translation was available, so this stays close to the literal word-by-word gloss.";
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
  const [authoringMode, setAuthoringMode] = useState<"word" | "sentence">(
    "word",
  );

  const analysisPreview = useMemo(() => {
    if (!sentenceAnalysis) return null;
    if (!formState.example.trim()) return null;
    if (sentenceAnalysis.sentence !== formState.example.trim()) return null;
    return sentenceAnalysis;
  }, [sentenceAnalysis, formState.example]);

  const analyzedPinyin = analysisPreview?.pinyin || formState.examplePinyin;
  const analyzedTranslation =
    analysisPreview?.translation || formState.exampleTranslation;

  if (!currentDeck) {
    return (
      <Card className="border-slate-700 bg-slate-800/30">
        <CardContent className="py-12 text-center text-slate-400">
          <FolderOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="mb-4">Select a deck first to add cards.</p>
          <Button onClick={onGoDecks}>Go to Decks</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-700/80 bg-gradient-to-b from-white/5 via-slate-900/70 to-slate-900/45 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                <span className="uppercase tracking-[0.22em] text-slate-500">
                  Deck
                </span>
                <span className="text-slate-100">{currentDeck.name}</span>
              </div>
              <CardTitle className="text-xl text-slate-50 md:text-2xl">
                Add Card
              </CardTitle>
            </div>

            <div className="inline-flex w-fit rounded-2xl border border-white/10 bg-slate-950/80 p-1.5">
              <button
                type="button"
                onClick={() => setAuthoringMode("word")}
                className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                  authoringMode === "word"
                    ? "bg-blue-500 text-slate-950"
                    : "text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                Word
              </button>
              <button
                type="button"
                onClick={() => setAuthoringMode("sentence")}
                className={`rounded-xl px-4 py-2 text-sm transition-colors ${
                  authoringMode === "sentence"
                    ? "bg-blue-500 text-slate-950"
                    : "text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                Sentence
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 md:space-y-7">
          {authoringMode === "word" && (
            <section className="space-y-5 rounded-2xl border border-white/8 bg-slate-950/35 p-4 md:p-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <div className="space-y-2.5">
                  <Label htmlFor="charInput" className="text-sm text-slate-200">
                    Chinese Word
                  </Label>
                  <Input
                    id="charInput"
                    value={formState.front}
                    onChange={(event) =>
                      onFormChange({ front: event.target.value })
                    }
                    placeholder="你好"
                    className="h-13 border-slate-600/80 bg-slate-900/80 text-2xl text-slate-50 shadow-inner shadow-black/20 focus-visible:border-blue-400/60"
                  />
                </div>

                <div className="space-y-2.5">
                  <Label
                    htmlFor="pinyinInput"
                    className="text-sm text-slate-200"
                  >
                    Pinying
                  </Label>
                  <Input
                    id="pinyinInput"
                    value={formState.pinyin}
                    onChange={(event) =>
                      onFormChange({ pinyin: event.target.value })
                    }
                    placeholder="ni3 hao3"
                    className="border-slate-600/80 bg-slate-900/80 text-slate-100 focus-visible:border-blue-400/60"
                  />
                  {formState.pinyin && (
                    <div className="text-sm text-blue-200">
                      {convertPinyinTones(formState.pinyin)}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                <Label
                  htmlFor="meaningInput"
                  className="text-sm text-slate-200"
                >
                  Meaning
                </Label>
                <Input
                  id="meaningInput"
                  value={formState.meaning}
                  onChange={(event) =>
                    onFormChange({ meaning: event.target.value })
                  }
                  placeholder="Hello, hi"
                  className="border-slate-600/80 bg-slate-900/80 text-slate-100 focus-visible:border-blue-400/60"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onAutoFetch()}
                  disabled={isAutoFetching || !formState.front.trim()}
                  className="border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/18 focus-visible:border-blue-300/60"
                >
                  {isAutoFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Translate
                </Button>
              </div>
            </section>
          )}

          {authoringMode === "sentence" && (
            <section className="space-y-5 rounded-2xl border border-white/8 bg-slate-950/35 p-4 md:p-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <div className="space-y-2.5">
                  <Label
                    htmlFor="exampleInput"
                    className="text-sm text-slate-200"
                  >
                    Chinese Sentence
                  </Label>
                  <Textarea
                    id="exampleInput"
                    value={formState.example}
                    onChange={(event) =>
                      onFormChange({ example: event.target.value })
                    }
                    placeholder="你好吗？"
                    className="h-13 resize-y border-slate-600/80 bg-slate-900/80 text-slate-100 focus-visible:border-blue-400/60"
                    rows={1}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label
                    htmlFor="examplePinyin"
                    className="text-sm text-slate-200"
                  >
                    Pinyin
                  </Label>
                  <Input
                    id="examplePinyin"
                    value={formState.examplePinyin}
                    onChange={(event) =>
                      onFormChange({ examplePinyin: event.target.value })
                    }
                    placeholder="ni3 hao3 ma5"
                    className="border-slate-600/80 bg-slate-900/80 text-slate-100 focus-visible:border-blue-400/60"
                  />
                  {formState.examplePinyin && (
                    <div className="text-sm text-blue-200">
                      {convertPinyinTones(formState.examplePinyin)}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                <Label
                  htmlFor="exampleTranslation"
                  className="text-sm text-slate-200"
                >
                  Meaning
                </Label>
                <Input
                  id="exampleTranslation"
                  value={formState.exampleTranslation}
                  onChange={(event) =>
                    onFormChange({ exampleTranslation: event.target.value })
                  }
                  placeholder="How are you?"
                  className="border-slate-600/80 bg-slate-900/80 text-slate-100 focus-visible:border-blue-400/60"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void onAnalyzeSentence()}
                  disabled={isAnalyzingSentence || !formState.example.trim()}
                  className="border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/18 focus-visible:border-blue-300/60"
                >
                  {isAnalyzingSentence ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Translate
                </Button>
              </div>

              {analysisPreview && (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/75 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.25)] md:p-5">
                  <div className="space-y-3">
                    <p className="font-chinese-ui text-3xl font-semibold tracking-tight text-white md:text-4xl">
                      {analysisPreview.sentence}
                    </p>
                    <p className="text-sm leading-6 text-blue-100/75 md:text-base">
                      {convertPinyinTones(analyzedPinyin)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-400/15 bg-blue-500/8 p-4">
                    <p className="text-base leading-7 text-slate-50 md:text-lg">
                      {analyzedTranslation}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-slate-200">
                        Interactive sentence map
                      </p>
                      <p className="text-xs text-slate-500">
                        Tap a character or word to inspect the local breakdown.
                      </p>
                    </div>
                    <CharacterBreakdown
                      segments={analysisPreview.segments}
                      pinyin={analyzedPinyin}
                      translation={analyzedTranslation}
                      literalGloss={analysisPreview.literalGloss}
                      variant="compact"
                      showPinyinLine={false}
                      showTranslationLine={false}
                      showLiteralGlossLine={false}
                    />
                  </div>

                  <details className="rounded-2xl border border-white/8 bg-white/[0.03]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
                      <span className="inline-flex items-center gap-2">
                        <CircleHelp className="h-4 w-4 text-slate-400" />
                        Why this translation?
                      </span>
                      <span className="text-xs text-slate-500">
                        Literal gloss and notes
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-white/8 px-4 py-4 text-sm leading-6 text-slate-300">
                      <p>
                        {getTranslationSourceExplanation(
                          analysisPreview.translationSource,
                        )}
                      </p>
                      {shouldShowLiteralGloss(
                        analysisPreview.translation,
                        analysisPreview.literalGloss,
                      ) ? (
                        <div className="rounded-xl border border-white/8 bg-slate-900/60 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
                            Literal gloss
                          </p>
                          <p className="mt-2 text-slate-300">
                            {analysisPreview.literalGloss || "-"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              )}

              {!analysisPreview && formState.example.trim() && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/35 p-4 text-sm leading-6 text-slate-400">
                  Analyze to preview the sentence and segment map.
                </div>
              )}
            </section>
          )}

          <div className="flex justify-end border-t border-white/8 pt-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={onClearForm}
                className="border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              >
                Clear form
              </Button>
              <Button
                onClick={() => void onCreateCard()}
                size="lg"
                className="min-w-[180px] bg-blue-500 text-slate-950 shadow-[0_10px_30px_rgba(96,165,250,0.28)] hover:bg-blue-400"
              >
                <Check className="mr-2 h-4 w-4" />
                Add Card
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700/70 bg-gradient-to-b from-white/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-slate-100">Deck Cards</CardTitle>
          <CardDescription className="text-slate-400">
            View, edit, and delete cards in {currentDeck.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cardsInDeck.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/35 p-5 text-sm text-slate-400">
              No cards in this deck yet. Add your first card above to start
              building a study set.
            </div>
          ) : (
            <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
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
