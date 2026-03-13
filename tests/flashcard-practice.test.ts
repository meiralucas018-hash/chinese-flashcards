import { describe, expect, it } from "vitest";
import {
  deriveCoreExample,
  deriveCorePair,
  deriveDisplayPairs,
  deriveFallbackPracticeTask,
} from "@/lib/flashcard-practice";
import type { PairItem } from "@/lib/ai/types";
import type { CardExample } from "@/types";

const PAIRS: PairItem[] = [
  { index: 1, text: "分享", composition: "分享", meaning: "to share" },
  {
    index: 2,
    text: "分享经验",
    composition: "分享+经验",
    meaning: "to share experience",
  },
  {
    index: 3,
    text: "分享快乐",
    composition: "分享+快乐",
    meaning: "to share happiness",
  },
  {
    index: 4,
    text: "分享想法",
    composition: "分享+想法",
    meaning: "to share ideas",
  },
];

const EXAMPLES: CardExample[] = [
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
        textSpan: "请",
        grammarName: "polite expression usage",
        structure: "请 + person + verb phrase",
        function: "softens a request",
        explanation:
          "请 introduces a polite request in this sentence. It makes the teacher's instruction sound natural and respectful.",
      },
    ],
  },
];

describe("deriveDisplayPairs", () => {
  it("filters out the bare target word when more specific collocations exist", () => {
    const result = deriveDisplayPairs("分享", PAIRS);

    expect(result.map((pair) => pair.text)).toEqual([
      "分享经验",
      "分享快乐",
      "分享想法",
    ]);
  });

  it("keeps the original pair when it is the only option", () => {
    const result = deriveDisplayPairs("分享", [PAIRS[0]]);
    expect(result.map((pair) => pair.text)).toEqual(["分享"]);
  });
});

describe("deriveFallbackPracticeTask", () => {
  it("creates written recall questions from existing study data", () => {
    const displayPairs = deriveDisplayPairs("分享", PAIRS);
    const task = deriveFallbackPracticeTask({
      front: "分享",
      pinyin: "fēnxiǎng",
      meaning: "to share with others",
      pairs: displayPairs,
      examples: EXAMPLES,
    });

    expect(task.instruction).toContain(
      "Recall the main word and the key phrase from the main sentence",
    );
    expect(task.questions).toHaveLength(5);
    expect(task.questions.map((question) => question.aspect)).toEqual([
      "word",
      "pinyin",
      "meaning",
      "paired_word",
      "example",
    ]);
    expect(task.questions[3].answer).toBe("分享经验");
    expect(task.questions[4].answer).toBe("分享经验");
  });

  it("still returns a minimal written recall set when examples are missing", () => {
    const task = deriveFallbackPracticeTask({
      front: "分享",
      pinyin: "fēnxiǎng",
      meaning: "to share with others",
      pairs: deriveDisplayPairs("分享", PAIRS),
      examples: [],
    });

    expect(task.questions.length).toBe(4);
    expect(task.questions[0].aspect).toBe("word");
    expect(task.questions[3].aspect).toBe("paired_word");
  });
});

describe("core study selection helpers", () => {
  it("chooses the first display pair as the core pair", () => {
    expect(deriveCorePair("分享", PAIRS)?.text).toBe("分享经验");
  });

  it("chooses the example that matches the core pair", () => {
    const coreExample = deriveCoreExample({
      word: "分享",
      pairs: PAIRS,
      examples: EXAMPLES,
    });

    expect(coreExample?.pairText).toBe("分享经验");
  });
});
