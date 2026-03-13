import { useEffect, useMemo, useReducer, useState } from "react";
import {
  Check,
  Copy,
  Eye,
  FolderOpen,
  Loader2,
  Sparkles,
  Trash2,
  Undo2,
  Volume2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedWordResponse } from "@/lib/ai/types";
import {
  autoRepairResponse,
  generatePrompt,
  normalizeResponse,
  parseWordResponse,
  validateWordResponse,
} from "@/lib/ai/aiParser";
import { mapParsedWordResponseToFlashcard } from "@/lib/ai/flashcardAdapter";
import { convertPinyinTones } from "@/lib/pinyin";
import type { SpeakTextOptions } from "@/lib/tts";
import type { Card as CardType, Deck } from "@/types";
import Flashcard from "@/components/flashcard/Flashcard";

type ParseStatus = "idle" | "parsing" | "success" | "error";
type AddCardPanel = "builder" | "inventory";

interface AnalyzerState {
  wordInput: string;
  parseStatus: ParseStatus;
  promptCopied: boolean;
  previewCard: CardType | null;
  parseMessage: string;
  parseCopyMessage: string;
}

type AnalyzerAction =
  | { type: "set-word"; value: string }
  | { type: "prompt-copied" }
  | { type: "prompt-reset" }
  | { type: "parse-start" }
  | {
      type: "parse-result";
      parseStatus: ParseStatus;
      previewCard: CardType | null;
      parseMessage: string;
      parseCopyMessage: string;
    }
  | { type: "clear" };

const INITIAL_STATE: AnalyzerState = {
  wordInput: "",
  parseStatus: "idle",
  promptCopied: false,
  previewCard: null,
  parseMessage: "",
  parseCopyMessage: "",
};

function normalizeWordKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’'`-]/g, "")
    .replace(/\s+/g, "");
}

function resetParseState(state: AnalyzerState): AnalyzerState {
  return {
    ...state,
    parseStatus: "idle",
    previewCard: null,
    parseMessage: "",
    parseCopyMessage: "",
  };
}

function analyzerReducer(
  state: AnalyzerState,
  action: AnalyzerAction,
): AnalyzerState {
  switch (action.type) {
    case "set-word":
      return resetParseState({
        ...state,
        wordInput: action.value,
        promptCopied: false,
      });
    case "prompt-copied":
      return {
        ...state,
        promptCopied: true,
      };
    case "prompt-reset":
      return {
        ...state,
        promptCopied: false,
      };
    case "parse-start":
      return {
        ...state,
        parseStatus: "parsing",
        parseMessage: "",
        parseCopyMessage: "",
      };
    case "parse-result":
      return {
        ...state,
        parseStatus: action.parseStatus,
        previewCard: action.previewCard,
        parseMessage:
          action.parseStatus === "error"
            ? INCOMPATIBLE_AI_RESPONSE_MESSAGE
            : action.parseMessage,
        parseCopyMessage: action.parseCopyMessage,
      };
    case "clear":
      return INITIAL_STATE;
    default:
      return state;
  }
}

interface AddCardViewProps {
  decks: Deck[];
  currentDeck: Deck | null;
  allCards: CardType[];
  cardsInDeck: CardType[];
  onGoDecks: () => void;
  onSelectDeck: (deckId: string) => void;
  onSaveCard: (previewCard: CardType) => Promise<boolean>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onSpeakChinese: (text: string, options?: Partial<SpeakTextOptions>) => void;
  hasDedicatedChineseVoice: boolean;
}

function DeckCardRow({
  card,
  onDelete,
  onViewCard,
}: {
  card: CardType;
  onDelete: (cardId: string) => Promise<void>;
  onViewCard: (card: CardType) => void;
}) {
  return (
    <div className="app-surface flex items-start justify-between gap-3 rounded-2xl p-4">
      <div className="space-y-1">
        <p className="font-chinese-ui text-xl text-cyan-100">{card.front}</p>
        <p className="text-sm text-slate-300">
          {convertPinyinTones(card.pinyin)}
        </p>
        <p className="text-sm text-slate-400">{card.meaning}</p>
        <p className="text-xs text-slate-500">
          {card.examples.length} example
          {card.examples.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onViewCard(card)}
          className="app-action h-8 px-2.5 text-xs"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          View Card
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void onDelete(card.id)}
          className="text-rose-300 hover:bg-rose-400/10 hover:text-rose-100"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function toUserFacingError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Clipboard access was blocked. Allow clipboard access, then try parsing again.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Could not read the clipboard.";
}

const INCOMPATIBLE_AI_RESPONSE_MESSAGE =
  "An error occurred because the AI generated a response that is incompatible with the parser. Please copy the error message and send it to the AI.";
const GLOBAL_FIELDS_SCOPE_MESSAGE =
  "This error happens to all fields. Adjust all of them.";

function resolveParseErrorMessages(message: string): {
  parseMessage: string;
  parseCopyMessage: string;
} {
  const trimmed = message.trim();

  const missingEndQuestionPattern =
    /Missing \[END_QUESTION(?:_\d+)?\] block\./i;
  if (missingEndQuestionPattern.test(trimmed)) {
    return {
      parseMessage: INCOMPATIBLE_AI_RESPONSE_MESSAGE,
      parseCopyMessage:
        "The parser could not process the response. Please make sure that there are no missing [END_QUESTION] block. This error happens to all fields. Adjust all of them.",
    };
  }

  const missingPatternMarker =
    /Pattern in \[EXAMPLE(?:_\d+)?\] must include the relevant Chinese word or marker from the sentence\./i;
  if (missingPatternMarker.test(trimmed)) {
    return {
      parseMessage: INCOMPATIBLE_AI_RESPONSE_MESSAGE,
      parseCopyMessage:
        "The parser could not process the response. Please make sure that all patterns in all [EXAMPLE] include the relevant Chinese word or marker from the sentence. This error happens to all fields. Adjust all of them.",
    };
  }

  const missingPairTextInExample =
    /Pair text does not appear in \[EXAMPLE(?:_\d+)?\] sentence\./i;
  if (missingPairTextInExample.test(trimmed)) {
    return {
      parseMessage: INCOMPATIBLE_AI_RESPONSE_MESSAGE,
      parseCopyMessage:
        "The parser could not process the response. Please make sure that the pair text appears in [EXAMPLE]. This error happens to all fields. Adjust all of them.",
    };
  }

  return {
    parseMessage: trimmed,
    parseCopyMessage: trimmed,
  };
}

function createPreviewCard(
  parsedData: ParsedWordResponse,
  currentDeckId: string,
): Promise<CardType> {
  return mapParsedWordResponseToFlashcard(parsedData).then((flashcardData) => ({
    ...flashcardData,
    id: "preview-card",
    deckId: currentDeckId,
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: Date.now(),
    lastReview: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

function isPromptTemplateText(text: string): boolean {
  return (
    /You are generating parser input for a Chinese learning application\./i.test(
      text,
    ) && /Now generate the real response for this word:/i.test(text)
  );
}

function extractClipboardTargetWord(text: string): string {
  const normalizedText = normalizeResponse(text);

  const beginWordBlockMatch = normalizedText.match(
    /\[BEGIN_WORD\][\s\S]*?\[END_WORD\]/i,
  );
  if (beginWordBlockMatch) {
    const wordLine = beginWordBlockMatch[0]
      .split(/\r?\n/)
      .find((line) => line.trim().toLowerCase().startsWith("word="));
    const parsedWord = wordLine?.split("=").slice(1).join("=").trim() || "";
    if (parsedWord) {
      return parsedWord;
    }
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bottomPromptIndex = lines.findIndex((line) =>
    /now generate the real response for this word:/i.test(line),
  );
  if (bottomPromptIndex >= 0 && lines[bottomPromptIndex + 1]) {
    return lines[bottomPromptIndex + 1].trim();
  }

  return "";
}

export default function AddCardView({
  decks,
  currentDeck,
  allCards,
  cardsInDeck,
  onGoDecks,
  onSelectDeck,
  onSaveCard,
  onDeleteCard,
  onSpeakChinese,
  hasDedicatedChineseVoice,
}: AddCardViewProps) {
  const [state, dispatch] = useReducer(analyzerReducer, INITIAL_STATE);
  const [deckCardSearch, setDeckCardSearch] = useState("");
  const [activePanel, setActivePanel] = useState<AddCardPanel>("builder");
  const [viewedInventoryCard, setViewedInventoryCard] = useState<CardType | null>(
    null,
  );
  const [errorCopied, setErrorCopied] = useState(false);
  const [duplicateParseAlert, setDuplicateParseAlert] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "Duplicate Character", message: "" });

  useEffect(() => {
    if (!state.promptCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({ type: "prompt-reset" });
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [state.promptCopied]);

  useEffect(() => {
    if (!errorCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorCopied(false);
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [errorCopied]);

  const filteredCards = useMemo(() => {
    const query = deckCardSearch.trim().toLowerCase();
    if (!query) {
      return cardsInDeck;
    }

    const normalizedQuery = normalizeForSearch(query);
    const normalizedQueryWithoutToneDigits = normalizedQuery.replace(/[1-5]/g, "");

    return cardsInDeck.filter((card) => {
      const characterText = normalizeForSearch(card.front);
      const meaningText = normalizeForSearch(card.meaning);
      const pinyinText = normalizeForSearch(card.pinyin.replace(/ü/gi, "u"));
      const pinyinWithoutToneDigits = pinyinText.replace(/[1-5]/g, "");

      return (
        characterText.includes(normalizedQuery) ||
        meaningText.includes(normalizedQuery) ||
        pinyinText.includes(normalizedQuery) ||
        pinyinWithoutToneDigits.includes(normalizedQuery) ||
        pinyinWithoutToneDigits.includes(normalizedQueryWithoutToneDigits)
      );
    });
  }, [cardsInDeck, deckCardSearch]);

  const existingDeckWordKeys = useMemo(
    () => new Set(cardsInDeck.map((card) => normalizeWordKey(card.front))),
    [cardsInDeck],
  );
  const existingGlobalWordKeys = useMemo(
    () => new Set(allCards.map((card) => normalizeWordKey(card.front))),
    [allCards],
  );
  const normalizedInputWordKey = useMemo(
    () => normalizeWordKey(state.wordInput),
    [state.wordInput],
  );
  const isInputDuplicateInSelectedDeck =
    normalizedInputWordKey.length > 0 &&
    existingDeckWordKeys.has(normalizedInputWordKey);
  const isInputDuplicateGloballyWithoutDeck =
    !currentDeck &&
    normalizedInputWordKey.length > 0 &&
    existingGlobalWordKeys.has(normalizedInputWordKey);
  const isInputDuplicateBlocked =
    isInputDuplicateInSelectedDeck || isInputDuplicateGloballyWithoutDeck;
  const findDuplicateDeckNames = (normalizedWordKey: string): string[] => {
    if (!normalizedWordKey) {
      return [];
    }

    const duplicateDeckIdSet = new Set(
      allCards
        .filter((card) => normalizeWordKey(card.front) === normalizedWordKey)
        .map((card) => card.deckId),
    );

    return decks
      .filter((deck) => duplicateDeckIdSet.has(deck.id))
      .map((deck) => deck.name);
  };
  const duplicateDeckNames = useMemo(() => {
    return findDuplicateDeckNames(normalizedInputWordKey);
  }, [allCards, decks, normalizedInputWordKey]);
  const showDuplicateParseAlert = (normalizedWordKey: string) => {
    const names = currentDeck
      ? findDuplicateDeckNames(normalizedWordKey).filter(
          (deckName) => deckName === currentDeck.name,
        )
      : findDuplicateDeckNames(normalizedWordKey);
    const duplicateDeckLabel = names.length > 0 ? names.join(", ") : "another deck";
    const message = `This character already exists in your deck: ${duplicateDeckLabel}.`;

    setDuplicateParseAlert({
      open: true,
      title: "Duplicate Character",
      message,
    });
  };

  const handleCopyPrompt = async () => {
    const word = state.wordInput.trim();
    if (!word) {
      return;
    }

    if (isInputDuplicateBlocked) {
      return;
    }

    await navigator.clipboard.writeText(generatePrompt(word));
    dispatch({ type: "prompt-copied" });
  };

  const handleCopyError = async () => {
    if (!state.parseCopyMessage.trim()) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      return;
    }

    const baseMessage = state.parseCopyMessage.trim();
    const copyMessage = baseMessage.includes("Adjust all of them")
      ? baseMessage
      : `${baseMessage}${baseMessage.endsWith(".") ? "" : "."} ${GLOBAL_FIELDS_SCOPE_MESSAGE}`;

    await navigator.clipboard.writeText(copyMessage);
    setErrorCopied(true);
  };

  const handleSavePreviewCard = async () => {
    if (!state.previewCard) {
      return;
    }

    if (!currentDeck) {
      dispatch({
        type: "parse-result",
        parseStatus: "error",
        previewCard: state.previewCard,
        parseMessage: "Select a deck before adding this card.",
        parseCopyMessage: "Select a deck before adding this card.",
      });
      return;
    }

    const normalizedPreviewWordKey = normalizeWordKey(state.previewCard.front);
    if (
      normalizedPreviewWordKey &&
      existingDeckWordKeys.has(normalizedPreviewWordKey)
    ) {
      dispatch({
        type: "parse-result",
        parseStatus: "error",
        previewCard: state.previewCard,
        parseMessage:
          "This word already exists in the selected deck. Use Deck Inventory to review it.",
        parseCopyMessage:
          "This word already exists in the selected deck. Use Deck Inventory to review it.",
      });
      return;
    }

    const didSave = await onSaveCard(state.previewCard);
    if (didSave) {
      dispatch({ type: "clear" });
    }
  };

  const handleParseFromClipboard = async () => {
    const requestedWord = state.wordInput.trim();
    const hasRequestedWord = requestedWord.length > 0;

    if (hasRequestedWord && isInputDuplicateBlocked) {
      showDuplicateParseAlert(normalizedInputWordKey);
      return;
    }

    dispatch({ type: "parse-start" });

    try {
      if (!navigator.clipboard?.readText) {
        throw new Error(
          "Clipboard reading is unavailable in this browser. Copy the AI response, then open NeonLang in a browser that supports clipboard access.",
        );
      }

      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        throw new Error(
          "Clipboard is empty. Copy the AI response first, then parse again.",
        );
      }

      if (isPromptTemplateText(clipboardText)) {
        dispatch({
          type: "parse-result",
          parseStatus: "idle",
          previewCard: null,
          parseMessage: "",
          parseCopyMessage: "",
        });
        setDuplicateParseAlert({
          open: true,
          title: "Parser Tip",
          message:
            "You copied the NeonLang prompt. Paste it into your AI first so it can generate a response, then copy that AI response and parse it here.",
        });
        return;
      }

      const clipboardTargetWord =
        extractClipboardTargetWord(clipboardText) || requestedWord;
      const normalizedClipboardTargetWordKey = normalizeWordKey(clipboardTargetWord);
      const duplicateInParseScope =
        normalizedClipboardTargetWordKey.length > 0 &&
        (currentDeck
          ? existingDeckWordKeys.has(normalizedClipboardTargetWordKey)
          : existingGlobalWordKeys.has(normalizedClipboardTargetWordKey));
      if (
        duplicateInParseScope
      ) {
        dispatch({
          type: "parse-result",
          parseStatus: "idle",
          previewCard: null,
          parseMessage: "",
          parseCopyMessage: "",
        });
        showDuplicateParseAlert(normalizedClipboardTargetWordKey);
        return;
      }

      const normalized = normalizeResponse(clipboardText);
      const repaired = autoRepairResponse(normalized);
      const parsedData = parseWordResponse(repaired.repairedText);
      parsedData.metadata = {
        ...parsedData.metadata,
        repaired: repaired.repaired,
        repairNotes: repaired.repairNotes,
        ...(hasRequestedWord ? { inputWord: requestedWord } : {}),
      };

      const validation = validateWordResponse(parsedData);
      if (!validation.isValid) {
        const resolved = resolveParseErrorMessages(
          validation.errors[0]?.message ||
            "The AI response is not in the expected format.",
        );
        dispatch({
          type: "parse-result",
          parseStatus: "error",
          previewCard: null,
          parseMessage: resolved.parseMessage,
          parseCopyMessage: resolved.parseCopyMessage,
        });
        return;
      }

      const previewCard = await createPreviewCard(
        parsedData,
        currentDeck?.id || "",
      );
      const normalizedPreviewWordKey = normalizeWordKey(previewCard.front);
      const isDuplicateParsedWord =
        normalizedPreviewWordKey.length > 0 &&
        (currentDeck
          ? existingDeckWordKeys.has(normalizedPreviewWordKey)
          : existingGlobalWordKeys.has(normalizedPreviewWordKey));
      if (isDuplicateParsedWord) {
        dispatch({
          type: "parse-result",
          parseStatus: "idle",
          previewCard: null,
          parseMessage: "",
          parseCopyMessage: "",
        });
        showDuplicateParseAlert(normalizedPreviewWordKey);
        return;
      }
      dispatch({
        type: "parse-result",
        parseStatus: "success",
        previewCard,
        parseMessage: repaired.repaired
          ? "AI response parsed successfully. Minor formatting issues were repaired automatically."
          : "AI response parsed successfully.",
        parseCopyMessage: "",
      });
    } catch (error) {
      const resolved = resolveParseErrorMessages(toUserFacingError(error));
      dispatch({
        type: "parse-result",
        parseStatus: "error",
        previewCard: null,
        parseMessage: resolved.parseMessage,
        parseCopyMessage: resolved.parseCopyMessage,
      });
    }
  };

  if (decks.length === 0) {
    return (
      <Card className="app-panel-soft rounded-[28px]">
        <CardContent className="py-12 text-center text-slate-400">
          <FolderOpen className="mx-auto mb-4 h-12 w-12 text-cyan-200/70" />
          <p className="mb-4 text-base text-slate-200">
            Create a deck first to add cards.
          </p>
          <Button className="app-action-neon" onClick={onGoDecks}>
            Go to Decks
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activePanel === "inventory") {
    if (viewedInventoryCard) {
      return (
        <Card className="app-panel-soft rounded-[28px]">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
                  Deck Inventory
                </p>
                <CardTitle className="mt-1.5 text-slate-100">
                  {viewedInventoryCard.front}
                </CardTitle>
                <CardDescription className="mt-1.5 text-slate-300">
                  Viewing a saved card from {currentDeck?.name || "this deck"}.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewedInventoryCard(null)}
                className="app-action min-w-40"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Back to Inventory
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Flashcard
              key={`${viewedInventoryCard.id}-${viewedInventoryCard.updatedAt}`}
              card={viewedInventoryCard}
              previewMode
              onRate={() => {}}
              onTTS={onSpeakChinese}
              hasDedicatedChineseVoice={hasDedicatedChineseVoice}
            />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="app-panel-soft rounded-[28px]">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
                Deck Inventory
              </p>
              <CardTitle className="mt-1.5 text-slate-100">
                Deck Cards
              </CardTitle>
              <CardDescription className="mt-1.5 text-slate-300">
                Review the cards already stored in{" "}
                {currentDeck?.name || "the selected deck"}.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActivePanel("builder")}
              className="app-action min-w-40"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Card Builder
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="app-surface rounded-2xl p-3.5">
            <Label
              htmlFor="deck-card-search"
              className="text-xs uppercase tracking-[0.18em] text-slate-500"
            >
              Search Cards
            </Label>
            <Input
              id="deck-card-search"
              value={deckCardSearch}
              onChange={(event) => setDeckCardSearch(event.target.value)}
              placeholder="Character, pinyin or meaning"
              className="app-field mt-2.5"
            />
            <p className="mt-2 text-xs text-slate-500">
              {filteredCards.length} of {cardsInDeck.length} cards
            </p>
          </div>

          {cardsInDeck.length === 0 ? (
            <div className="app-surface rounded-2xl border-dashed p-5 text-sm text-slate-400">
              No cards in this deck yet.
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="app-surface rounded-2xl border-dashed p-5 text-sm text-slate-400">
              No cards matched that search.
            </div>
          ) : (
            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {filteredCards.map((card) => (
                <DeckCardRow
                  key={card.id}
                  card={card}
                  onDelete={onDeleteCard}
                  onViewCard={setViewedInventoryCard}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {duplicateParseAlert.open && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/56 px-4">
          <div className="app-panel w-full max-w-md rounded-[24px] border border-cyan-300/22 bg-[linear-gradient(180deg,rgba(8,12,18,0.94),rgba(4,7,12,0.96))] p-5 text-slate-100 shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_16px_54px_rgba(2,132,199,0.16)]">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-200/85">
              {duplicateParseAlert.title}
            </p>
            <p className="mt-2.5 text-sm text-slate-200">
              {duplicateParseAlert.message}
            </p>
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="app-action"
                onClick={() =>
                  setDuplicateParseAlert((prev) => ({ ...prev, open: false }))
                }
              >
                I understand
              </Button>
            </div>
          </div>
        </div>
      )}
      <Card className="app-panel rounded-[28px]">
        <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
              Card Builder
            </p>
            <CardTitle className="mt-1.5 text-xl text-slate-50 md:text-2xl">
              AI Word Analyzer
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-2xl text-slate-300">
              Copy the prompt, ask your AI tool for a structured word entry,
              then parse the copied response directly from your clipboard.
            </CardDescription>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-[216px] sm:flex-col sm:items-end">
            <div className="inline-flex min-w-0 flex-1 items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs text-slate-300 sm:w-full sm:flex-none">
              <span className="uppercase tracking-[0.22em] text-slate-500">
                Deck
              </span>
              <span className="max-w-[120px] truncate text-right text-sm font-medium text-slate-100 sm:max-w-[132px]">
                {currentDeck?.name || "Choose deck"}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActivePanel("inventory")}
              className="app-action shrink-0 sm:w-full"
            >
              Deck Inventory
            </Button>
          </div>
        </div>

        <div className="app-surface rounded-2xl p-3.5">
          <Label className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Save To Deck
          </Label>
          <Select value={currentDeck?.id} onValueChange={onSelectDeck}>
            <SelectTrigger className="app-field mt-2.5 w-full sm:w-[320px]">
              <SelectValue placeholder="Choose a deck" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
              {decks.map((deck) => (
                <SelectItem key={deck.id} value={deck.id}>
                  {deck.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

        <CardContent className="space-y-4 pt-0">
        <div className="app-surface rounded-2xl p-3.5">
          <Label
            htmlFor="word-input"
            className="text-xs uppercase tracking-[0.18em] text-slate-500"
          >
            Word input
          </Label>
          <Textarea
            id="word-input"
            value={state.wordInput}
            onChange={(event) =>
              dispatch({ type: "set-word", value: event.target.value })
            }
            placeholder="Enter a Chinese word..."
            rows={1}
            className="app-field mt-2.5 min-h-12 resize-none font-chinese-ui text-sm leading-snug placeholder:text-sm sm:text-sm sm:leading-snug sm:placeholder:text-sm"
          />
          {isInputDuplicateBlocked && (
            <p className="mt-2 text-xs text-amber-200">
              This word already exists in{" "}
              {duplicateDeckNames.length > 0
                ? `deck${duplicateDeckNames.length > 1 ? "s" : ""}: ${duplicateDeckNames.join(", ")}.`
                : "another deck."}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopyPrompt()}
              disabled={!state.wordInput.trim() || isInputDuplicateBlocked}
              className="app-action-neon"
            >
            <Copy className="mr-2 h-4 w-4" />
            {state.promptCopied ? "Prompt copied" : "Copy AI Prompt"}
          </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleParseFromClipboard()}
              disabled={state.parseStatus === "parsing"}
              className="app-action-positive"
            >
            {state.parseStatus === "parsing" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Parse AI Response
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => dispatch({ type: "clear" })}
            className="app-action"
          >
            Clear
          </Button>
        </div>

        {state.parseMessage && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              state.parseStatus === "success"
                ? "border-cyan-300/20 bg-cyan-300/8 text-cyan-100"
                : state.parseStatus === "error"
                  ? "border-amber-300/20 bg-amber-300/8 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="max-w-[780px]">{state.parseMessage}</p>
              {state.parseStatus === "error" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopyError()}
                  className="app-action-neon h-9 w-[170px] justify-center px-3.5 text-xs font-semibold whitespace-nowrap ring-1 ring-cyan-300/35"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {errorCopied ? "Copied" : "Copy Error Message"}
                </Button>
              )}
            </div>
          </div>
        )}

        {state.previewCard && (
          <div className="app-surface space-y-3 rounded-2xl p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/75">
                  Preview
                </p>
                <p className="mt-1.5 text-sm font-medium text-slate-200">
                  Flashcard preview
                </p>
                <p className="text-xs text-slate-500">
                  Token meanings and sentence audio are active in the preview.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onSpeakChinese(state.previewCard?.front || "", {
                      debugSource: "add-preview-word",
                    })
                  }
                  className="app-action"
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  Listen word
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSavePreviewCard()}
                  disabled={
                    state.previewCard
                      ? existingDeckWordKeys.has(
                          normalizeWordKey(state.previewCard.front),
                        )
                      : false
                  }
                  className="app-action-neon"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Add Card
                </Button>
              </div>
            </div>
            {state.previewCard &&
              existingDeckWordKeys.has(normalizeWordKey(state.previewCard.front)) && (
                <p className="text-xs text-amber-200">
                  This word is already in the selected deck.
                </p>
              )}

            <Flashcard
              key={`${state.previewCard.id}-${state.previewCard.front}-${state.previewCard.updatedAt}`}
              card={state.previewCard}
              previewMode
              onRate={() => {}}
              onTTS={onSpeakChinese}
              hasDedicatedChineseVoice={hasDedicatedChineseVoice}
            />
          </div>
        )}
        </CardContent>
      </Card>
    </>
  );
}
