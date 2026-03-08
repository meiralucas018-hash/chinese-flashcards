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
    /[\u3400-\u9fff]/.test(normalized) ||
    /\//.test(normalized) ||
    /\badverb of degree\b|\bclassifier\b|\bor him\b|\blanguage\b|\bto have\b|\bto be\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    /^(what|where|why|how|who)\s+(am|are|is|was|were|do|does|did|can|could|will|would|should|may|might|must)\b/.test(
      normalized,
    ) ||
    /\b(i|you|he|she|we|they|it)\b/.test(normalized) ||
    /^(do not|go|come|look|listen|stop|wait|take|give|open|close|study|read|write|speak|ask)\b/.test(
      normalized,
    )
  );
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
  const fallbackTranslation = {
    translation: literalGloss,
    translationSource: "fallback" as const,
    confidence: 0.42,
  };
  let resolvedTranslation: {
    translation: string;
    translationSource: TranslationSource;
    confidence?: number;
  };

  if (options?.translation?.trim()) {
    resolvedTranslation = {
      translation: options.translation.trim(),
      translationSource: "exact",
      confidence: 1,
    };
  } else if (ruleTranslation.translationSource === "rule") {
    resolvedTranslation = ruleTranslation;
  } else if (
    exactTranslation &&
    isNaturalEnglishCandidate(exactTranslation.translation)
  ) {
    resolvedTranslation = exactTranslation;
  } else {
    resolvedTranslation = fallbackTranslation;
  }

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
