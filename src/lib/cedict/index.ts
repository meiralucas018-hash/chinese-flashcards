import type { ExampleBreakdown } from "@/types";
import {
  buildLiteralGloss,
  pickBestEntry,
  pickPrimaryMeaning,
  toBreakdownSegments,
} from "./gloss";
import { loadCedict, parseCedictLine } from "./loader";
import {
  buildNaturalTranslation,
  buildTranslationResult,
  parseSentenceStructure,
} from "./rule-translation";
import { searchCedict } from "./search";
import { segmentSentence } from "./segmenter";
import type { CedictIndex, TranslationSource } from "./types";

function getExactSentenceTranslation(
  sentence: string,
  index: CedictIndex,
): {
  translation: string;
  translationSource: TranslationSource;
  confidence?: number;
} | null {
  const normalizedSentence = sentence.replace(/[。！？!?]+$/g, "").trim();
  if (!normalizedSentence) {
    return null;
  }

  const exactEntries = index.get(normalizedSentence);
  if (!exactEntries || exactEntries.length === 0) {
    return null;
  }

  const entry = pickBestEntry(exactEntries);
  const translation = pickPrimaryMeaning(entry.meanings.join("; "));
  return translation
    ? {
        translation,
        translationSource: "exact",
        confidence: 0.92,
      }
    : null;
}

function isNaturalEnglishCandidate(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (
    /\badverb of degree\b|\bclassifier\b|\bor him\b|\blanguage\b|\bto have\b|\bto be\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /\b(i|you|he|she|we|they|it)\b/.test(normalized);
}

export function buildExampleBreakdown(
  sentence: string,
  index: CedictIndex,
  options?: { translation?: string; pinyinOverride?: string },
): ExampleBreakdown {
  const trimmedSentence = sentence.trim();
  if (!trimmedSentence) {
    return {
      sentence: "",
      pinyin: "",
      translation: "",
      literalGloss: "",
      translationSource: "fallback",
      confidence: 0,
      segments: [],
    };
  }

  const wordSegments = segmentSentence(trimmedSentence, index);
  const literalGloss = buildLiteralGloss(wordSegments);
  const exactTranslation = getExactSentenceTranslation(trimmedSentence, index);
  const ruleTranslation = buildNaturalTranslation(wordSegments, literalGloss);
  const resolvedTranslation = options?.translation?.trim()
    ? {
        translation: options.translation.trim(),
        translationSource: "exact" as const,
        confidence: 1,
      }
    : ruleTranslation.translationSource === "fallback" &&
        exactTranslation &&
        isNaturalEnglishCandidate(exactTranslation.translation)
      ? exactTranslation
      : buildTranslationResult(wordSegments, literalGloss);

  return {
    sentence: trimmedSentence,
    pinyin:
      options?.pinyinOverride?.trim() ||
      wordSegments
        .map((segment) => segment.pinyin)
        .filter(Boolean)
        .join(" "),
    translation: resolvedTranslation.translation,
    literalGloss,
    translationSource: resolvedTranslation.translationSource,
    confidence: resolvedTranslation.confidence,
    segments: toBreakdownSegments(wordSegments),
  };
}

export {
  buildLiteralGloss,
  buildNaturalTranslation,
  loadCedict,
  parseCedictLine,
  parseSentenceStructure,
  searchCedict,
  segmentSentence,
};
export * from "./types";
