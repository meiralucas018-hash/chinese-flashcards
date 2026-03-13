import type { Card } from "@/types";
import { deriveCorePracticeTask } from "@/lib/flashcard-practice";
import type {
  FlashcardCompatibleData,
  GrammarItem,
  ParsedWordResponse,
} from "./types";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

function uniqueCharacters(word: string): string[] {
  return [...word].filter(
    (char, index, chars) =>
      /[\u3400-\u9FFF]/.test(char) && chars.indexOf(char) === index,
  );
}

function deriveGrammarNotes(
  word: string,
  examples: FlashcardCompatibleData["examples"],
): GrammarItem[] {
  const normalizedWord = normalizeText(word);

  return examples
    .flatMap((example) => example.grammar)
    .filter((item, index, items) => {
      const matchesWord = normalizeText(item.textSpan) === normalizedWord;
      const signature = `${item.textSpan}|${item.grammarName}|${item.structure}`;

      return (
        matchesWord &&
        items.findIndex(
          (candidate) =>
            `${candidate.textSpan}|${candidate.grammarName}|${candidate.structure}` ===
            signature,
        ) === index
      );
    });
}

export async function mapParsedWordResponseToFlashcard(
  data: ParsedWordResponse,
): Promise<FlashcardCompatibleData> {
  const examples = data.examples.map((example) => ({
    ...example,
    tokens: example.tokens.map((token) => ({ ...token })),
    grammar: example.grammar.map((item) => ({ ...item })),
  }));

  return {
    front: data.wordEntry.word,
    pinyin: data.wordEntry.pinyin,
    meaning: data.wordEntry.meaning,
    wordClass: data.wordEntry.wordClass,
    hskLevel: data.wordEntry.hskLevel,
    usageNote: data.wordEntry.usageNote,
    pairedWordsNote: data.wordEntry.pairedWordsNote,
    pairs: data.pairs.map((pair) => ({ ...pair })),
    grammarNotes: deriveGrammarNotes(data.wordEntry.word, examples),
    examples,
    practiceTask: deriveCorePracticeTask({
      front: data.wordEntry.word,
      pinyin: data.wordEntry.pinyin,
      meaning: data.wordEntry.meaning,
      pairs: data.pairs,
      examples,
    }),
    practiceCharacters: uniqueCharacters(data.wordEntry.word),
    tts: {
      word: data.wordEntry.word,
      exampleSentences: examples.map((example) => example.sentence),
    },
    metadata: data.metadata,
  };
}

export async function adaptParsedAiWordToCard(
  parsed: ParsedWordResponse,
  options?: { id?: string; deckId?: string },
): Promise<Card> {
  const flashcardData = await mapParsedWordResponseToFlashcard(parsed);

  return {
    ...flashcardData,
    id: options?.id || "preview-card",
    deckId: options?.deckId || "",
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    nextReview: Date.now(),
    lastReview: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
