import { loadCedict } from "./loader";
import { buildExampleBreakdown } from "./index";

export type CedictValidationCase = {
  sentence: string;
  expectedSource?: "exact" | "rule" | "fallback";
  expectedTranslationIncludes: string[];
};

export const CEDICT_VALIDATION_CASES: CedictValidationCase[] = [
  {
    sentence: "你好吗？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["how", "you"],
  },
  { sentence: "我是学生。", expectedTranslationIncludes: ["i am", "student"] },
  { sentence: "他不是老师。", expectedTranslationIncludes: ["he", "teacher"] },
  { sentence: "我在中国。", expectedTranslationIncludes: ["i am", "china"] },
  {
    sentence: "我有一个朋友。",
    expectedTranslationIncludes: ["i have", "friend"],
  },
  { sentence: "你喜欢什么？", expectedTranslationIncludes: ["what", "like"] },
  {
    sentence: "他在哪儿工作？",
    expectedTranslationIncludes: ["where", "work"],
  },
  { sentence: "我把书给他了。", expectedTranslationIncludes: ["gave", "book"] },
  {
    sentence: "他被老师批评了。",
    expectedTranslationIncludes: ["by", "teacher"],
  },
  { sentence: "我看得懂。", expectedTranslationIncludes: ["can understand"] },
  {
    sentence: "我看不懂。",
    expectedTranslationIncludes: ["cannot understand"],
  },
  { sentence: "今天我很忙。", expectedTranslationIncludes: ["today", "busy"] },
  { sentence: "明天见。", expectedTranslationIncludes: ["tomorrow"] },
  { sentence: "你住在哪里？", expectedTranslationIncludes: ["where", "you"] },
  {
    sentence: "你为什么学中文？",
    expectedTranslationIncludes: ["why", "study"],
  },
  { sentence: "你给谁打电话？", expectedTranslationIncludes: ["who", "call"] },
  { sentence: "我在吃饭。", expectedTranslationIncludes: ["i am", "eating"] },
  { sentence: "我们比他们忙。", expectedTranslationIncludes: ["more", "than"] },
  { sentence: "不要说话。", expectedTranslationIncludes: ["do not", "speak"] },
  { sentence: "我找不到。", expectedTranslationIncludes: ["cannot find"] },
  { sentence: "我听得见。", expectedTranslationIncludes: ["can hear"] },
  { sentence: "他给我写信。", expectedTranslationIncludes: ["for me"] },
  { sentence: "她很高兴。", expectedTranslationIncludes: ["happy"] },
  { sentence: "我没有时间。", expectedTranslationIncludes: ["have", "time"] },
];

export async function runCedictValidation(): Promise<
  Array<{
    sentence: string;
    translation: string;
    translationSource: string;
    passed: boolean;
  }>
> {
  const index = await loadCedict();

  return CEDICT_VALIDATION_CASES.map((testCase) => {
    const result = buildExampleBreakdown(testCase.sentence, index);
    const lowerTranslation = result.translation.toLowerCase();
    const passedIncludes = testCase.expectedTranslationIncludes.every(
      (fragment) => lowerTranslation.includes(fragment),
    );
    const passedSource =
      !testCase.expectedSource ||
      result.translationSource === testCase.expectedSource;

    return {
      sentence: testCase.sentence,
      translation: result.translation,
      translationSource: result.translationSource,
      passed: passedIncludes && passedSource,
    };
  });
}
