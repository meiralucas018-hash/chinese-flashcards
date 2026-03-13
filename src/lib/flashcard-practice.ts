import type { PairItem, PracticeQuestion, PracticeTask } from "@/lib/ai/types";
import type { CardExample } from "@/types";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

export function deriveDisplayPairs(
  word: string,
  pairs: PairItem[],
): PairItem[] {
  if (pairs.length <= 1) {
    return pairs;
  }

  const normalizedWord = normalizeText(word);
  const filteredPairs = pairs.filter(
    (pair) => normalizeText(pair.text) !== normalizedWord,
  );

  return filteredPairs.length > 0 ? filteredPairs : pairs;
}

export function deriveCorePair(
  word: string,
  pairs: PairItem[],
): PairItem | null {
  const displayPairs = deriveDisplayPairs(word, pairs);
  return displayPairs[0] || pairs[0] || null;
}

export function deriveCoreExample(input: {
  word: string;
  pairs: PairItem[];
  examples: CardExample[];
}): CardExample | null {
  const corePair = deriveCorePair(input.word, input.pairs);

  if (corePair) {
    const matchingExample = input.examples.find(
      (example) =>
        normalizeText(example.pairText) === normalizeText(corePair.text),
    );

    if (matchingExample) {
      return matchingExample;
    }
  }

  return input.examples[0] || null;
}

export function deriveRelatedExamples(input: {
  word: string;
  pairs: PairItem[];
  examples: CardExample[];
}): CardExample[] {
  const coreExample = deriveCoreExample(input);

  if (!coreExample) {
    return input.examples;
  }

  return input.examples.filter(
    (example) => example.exampleIndex !== coreExample.exampleIndex,
  );
}

export function deriveFallbackPracticeTask(input: {
  front: string;
  pinyin: string;
  meaning: string;
  pairs: PairItem[];
  examples: CardExample[];
}): PracticeTask {
  const primaryPair = deriveCorePair(input.front, input.pairs);
  const primaryExample = deriveCoreExample({
    word: input.front,
    pairs: input.pairs,
    examples: input.examples,
  });

  const questions: PracticeQuestion[] = [
    {
      index: 1,
      aspect: "word",
      prompt: `Write the Chinese word that means: ${input.meaning}`,
      answer: input.front,
    },
    {
      index: 2,
      aspect: "pinyin",
      prompt: `Write the pinyin for ${input.front}.`,
      answer: input.pinyin,
    },
    {
      index: 3,
      aspect: "meaning",
      prompt: `Write a natural English meaning for ${input.front}.`,
      answer: input.meaning,
    },
  ];

  if (primaryPair) {
    questions.push({
      index: questions.length + 1,
      aspect: "paired_word",
      prompt: `Write the core phrase built with ${input.front}.`,
      answer: primaryPair.text,
    });
  }

  if (primaryExample) {
    questions.push({
      index: questions.length + 1,
      aspect: "example",
      prompt: `Which core phrase completes this sentence: ${primaryExample.sentence}`,
      answer: primaryExample.pairText || primaryPair?.text || input.front,
    });
  }

  return {
    instruction:
      "Recall the main word and the key phrase from the main sentence, then reveal the expected answer to check yourself.",
    questions: questions.slice(0, 5),
  };
}

export const deriveCorePracticeTask = deriveFallbackPracticeTask;
