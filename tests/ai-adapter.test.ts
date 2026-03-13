import { describe, expect, it } from "vitest";
import {
  adaptParsedAiWordToCard,
  mapParsedWordResponseToFlashcard,
} from "@/lib/ai/flashcardAdapter";
import type { ParsedWordResponse } from "@/lib/ai/types";

const PARSED_WORD: ParsedWordResponse = {
  wordEntry: {
    word: "分享",
    pinyin: "fēnxiǎng",
    meaning:
      "Used when giving part of something, such as ideas, experiences, or feelings, to other people so they can also have it.",
    wordClass: "verb",
    hskLevel: "HSK 4",
    usageNote:
      "Common verb for sharing ideas, experiences, feelings, or things with other people.",
    pairedWordsNote:
      "These paired words show common ways 分享 appears in real communication.",
  },
  pairs: [
    {
      index: 1,
      text: "分享经验",
      composition: "分享+经验",
      meaning: "to share experience",
    },
    {
      index: 2,
      text: "分享快乐",
      composition: "分享+快乐",
      meaning: "to share happiness",
    },
  ],
  examples: [
    {
      exampleIndex: 1,
      pairText: "分享经验",
      sentence: "老师请大家分享经验。",
      pinyin: "Lǎoshī qǐng dàjiā fēnxiǎng jīngyàn.",
      translation: "The teacher asked everyone to share their experience.",
      tokens: [
        { index: 1, text: "老师", pinyin: "lǎoshī", meaning: "teacher" },
        { index: 2, text: "请", pinyin: "qǐng", meaning: "to ask politely" },
        { index: 3, text: "大家", pinyin: "dàjiā", meaning: "everyone" },
        {
          index: 4,
          text: "分享经验",
          pinyin: "fēnxiǎng jīngyàn",
          meaning: "to share experience",
        },
      ],
      grammar: [
        {
          index: 1,
          textSpan: "分享经验",
          grammarName: "verb-object structure",
          structure: "分享 + noun object",
          function: "shows what is being shared",
          explanation:
            "分享经验 is a common verb-object phrase built with 分享 plus a noun object. It shows the natural thing being shared, so the sentence teaches how 分享 is typically used with content like experience.",
        },
      ],
    },
    {
      exampleIndex: 2,
      pairText: "分享快乐",
      sentence: "她总是和朋友分享快乐。",
      pinyin: "Tā zǒngshì hé péngyou fēnxiǎng kuàilè.",
      translation: "She always shares happiness with her friends.",
      tokens: [
        { index: 1, text: "她", pinyin: "tā", meaning: "she" },
        { index: 2, text: "总是", pinyin: "zǒngshì", meaning: "always" },
        { index: 3, text: "和", pinyin: "hé", meaning: "with" },
        { index: 4, text: "朋友", pinyin: "péngyou", meaning: "friend" },
        {
          index: 5,
          text: "分享快乐",
          pinyin: "fēnxiǎng kuàilè",
          meaning: "to share happiness",
        },
      ],
      grammar: [],
    },
  ],
  practice: {
    instruction:
      "Write each answer from memory, then reveal the expected answer to check yourself.",
    questions: [
      {
        index: 1,
        aspect: "pinyin",
        prompt: "Write the pinyin for 分享.",
        answer: "fēnxiǎng",
      },
      {
        index: 2,
        aspect: "meaning",
        prompt: "Write a natural English meaning for 分享.",
        answer: "to share with others",
      },
      {
        index: 3,
        aspect: "paired_word",
        prompt: "Write one common paired word that uses 分享.",
        answer: "分享经验",
      },
    ],
  },
  metadata: {
    parseMode: "word-entry-v3",
    repaired: false,
    repairNotes: [],
    inputWord: "分享",
  },
};

describe("mapParsedWordResponseToFlashcard", () => {
  it("maps parsed data to flashcard-compatible data without CEDICT-derived fields", async () => {
    const mapped = await mapParsedWordResponseToFlashcard(PARSED_WORD);

    expect(mapped.front).toBe("分享");
    expect(mapped.meaning).toContain("giving part of something");
    expect(mapped.pairedWordsNote).toContain("common ways");
    expect(mapped.hskLevel).toBe("HSK 4");
    expect(mapped.examples).toHaveLength(2);
    expect(mapped.examples[0].pairText).toBe("分享经验");
    expect(mapped.examples[0].tokens[3].meaning).toBe("to share experience");
    expect(mapped.practiceTask.questions[0].aspect).toBe("word");
    expect(mapped.practiceTask.questions[3].answer).toBe("分享经验");
    expect(
      mapped.practiceTask.questions.every(
        (question) => question.aspect !== "grammar",
      ),
    ).toBe(true);
    expect(mapped.grammarNotes).toEqual([]);
    expect(mapped.practiceCharacters).toEqual(["分", "享"]);
    expect(mapped.tts.exampleSentences).toEqual([
      "老师请大家分享经验。",
      "她总是和朋友分享快乐。",
    ]);
  });
});

describe("adaptParsedAiWordToCard", () => {
  it("creates a card that preserves token-driven preview data", async () => {
    const card = await adaptParsedAiWordToCard(PARSED_WORD, {
      id: "card-1",
      deckId: "deck-1",
    });

    expect(card.front).toBe("分享");
    expect(card.deckId).toBe("deck-1");
    expect(card.examples[0].tokens.length).toBeGreaterThan(0);
    expect(card.examples[1].pairText).toBe("分享快乐");
    expect(card.practiceTask.questions).toHaveLength(5);
    expect(card.metadata.parseMode).toBe("word-entry-v3");
  });
});
