import { pickBestEntry, sanitizeMeaning, toCharacterInfo } from "./gloss";
import type { CedictIndex, WordSegment } from "./types";

type CandidateSegment = {
  segment: WordSegment;
  isDictionaryMatch: boolean;
  isUnknown: boolean;
  tokenLength: number;
  word: string;
};

type BeamState = {
  score: number;
  segments: WordSegment[];
  segmentCount: number;
  singleCharCount: number;
  unknownCount: number;
};

const MAX_TOKEN_LENGTH = 6;
const BEAM_WIDTH = 12;
const COMMON_EXPRESSIONS = new Set<string>([
  "为什么",
  "怎么",
  "怎么样",
  "是不是",
  "没有",
  "不要",
  "不能",
  "可以",
  "因为",
  "所以",
  "但是",
  "如果",
  "还是",
  "一起",
  "已经",
  "正在",
]);
const GRAMMAR_PARTICLES = new Set<string>([
  "了",
  "过",
  "着",
  "的",
  "得",
  "地",
  "吗",
  "吧",
  "呢",
  "把",
  "被",
  "给",
  "在",
  "不",
  "没",
]);

function isChinesePunctuation(char: string): boolean {
  return /[，。！？；：、“”‘’（）《》【】]/.test(char);
}

function buildDictionaryCandidate(
  word: string,
  startIndex: number,
  index: CedictIndex,
): CandidateSegment {
  const entry = pickBestEntry(index.get(word) || []);

  return {
    segment: {
      word,
      pinyin: entry?.pinyin || "",
      meaning: sanitizeMeaning(entry?.meanings?.join("; ") || ""),
      startIndex,
      endIndex: startIndex + word.length,
      chars: word.split("").map((char) => toCharacterInfo(char, index)),
    },
    isDictionaryMatch: true,
    isUnknown: false,
    tokenLength: word.length,
    word,
  };
}

function buildFallbackCandidate(
  char: string,
  startIndex: number,
  index: CedictIndex,
): CandidateSegment {
  const charInfo = toCharacterInfo(char, index);
  const hasDictionaryChar = Boolean((index.get(char) || []).length > 0);

  return {
    segment: {
      word: char,
      pinyin: charInfo.pinyin,
      meaning: charInfo.meaning,
      startIndex,
      endIndex: startIndex + 1,
      chars: [charInfo],
    },
    isDictionaryMatch: hasDictionaryChar,
    isUnknown:
      !hasDictionaryChar && !isChinesePunctuation(char) && /[\u4e00-\u9fff]/.test(char),
    tokenLength: 1,
    word: char,
  };
}

function collectCandidatesAt(
  sentence: string,
  position: number,
  index: CedictIndex,
): CandidateSegment[] {
  const candidates: CandidateSegment[] = [];
  const maxLength = Math.min(MAX_TOKEN_LENGTH, sentence.length - position);

  for (let length = maxLength; length >= 1; length -= 1) {
    const word = sentence.substring(position, position + length);
    const entries = index.get(word);
    if (!entries || entries.length === 0) {
      continue;
    }

    candidates.push(buildDictionaryCandidate(word, position, index));
  }

  const fallbackChar = sentence[position];
  if (!candidates.some((candidate) => candidate.word === fallbackChar)) {
    candidates.push(buildFallbackCandidate(fallbackChar, position, index));
  }

  return candidates;
}

function scoreCandidate(
  candidate: CandidateSegment,
  longestDictionaryLength: number,
): number {
  const { word, tokenLength, isDictionaryMatch, isUnknown } = candidate;
  let score = 0;

  // Prefer meaningful dictionary words, especially multi-character entries.
  if (isDictionaryMatch) {
    score += 22;
    score += tokenLength * 5;
  } else {
    score -= 18;
  }

  if (tokenLength >= 2) {
    score += 9;
  }
  if (tokenLength >= 3) {
    score += 7;
  }

  if (tokenLength === 1) {
    score -= 7;
  }

  if (isUnknown) {
    score -= 20;
  }

  // Penalize unnecessary splitting when a longer dictionary option exists now.
  if (longestDictionaryLength > tokenLength) {
    score -= (longestDictionaryLength - tokenLength) * 5;
  }

  if (COMMON_EXPRESSIONS.has(word)) {
    score += 10;
  }

  if (GRAMMAR_PARTICLES.has(word) && tokenLength === 1) {
    score -= 3;
  }

  if (isChinesePunctuation(word)) {
    score += 2;
  }

  return score;
}

function rankStates(states: BeamState[]): BeamState[] {
  return [...states].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.unknownCount !== right.unknownCount) {
      return left.unknownCount - right.unknownCount;
    }
    if (left.singleCharCount !== right.singleCharCount) {
      return left.singleCharCount - right.singleCharCount;
    }
    return left.segmentCount - right.segmentCount;
  });
}

export function segmentSentence(
  sentence: string,
  index: CedictIndex,
): WordSegment[] {
  if (!sentence) {
    return [];
  }

  const beamsByPosition = new Map<number, BeamState[]>();
  beamsByPosition.set(0, [
    {
      score: 0,
      segments: [],
      segmentCount: 0,
      singleCharCount: 0,
      unknownCount: 0,
    },
  ]);

  for (let position = 0; position < sentence.length; position += 1) {
    const states = beamsByPosition.get(position) || [];
    if (states.length === 0) {
      continue;
    }

    const candidates = collectCandidatesAt(sentence, position, index);
    const longestDictionaryLength = candidates
      .filter((candidate) => candidate.isDictionaryMatch)
      .reduce(
        (maxLength, candidate) => Math.max(maxLength, candidate.tokenLength),
        1,
      );

    for (const state of states) {
      for (const candidate of candidates) {
        const nextPosition = candidate.segment.endIndex;
        const nextScore =
          state.score +
          scoreCandidate(candidate, longestDictionaryLength) -
          1 -
          (candidate.tokenLength === 1 ? 2 : 0);

        const nextState: BeamState = {
          score: nextScore,
          segments: [...state.segments, candidate.segment],
          segmentCount: state.segmentCount + 1,
          singleCharCount:
            state.singleCharCount + (candidate.tokenLength === 1 ? 1 : 0),
          unknownCount: state.unknownCount + (candidate.isUnknown ? 1 : 0),
        };

        const bucket = beamsByPosition.get(nextPosition) || [];
        bucket.push(nextState);
        beamsByPosition.set(
          nextPosition,
          rankStates(bucket).slice(0, BEAM_WIDTH),
        );
      }
    }
  }

  const finalStates = beamsByPosition.get(sentence.length);
  if (!finalStates || finalStates.length === 0) {
    return sentence.split("").map((char, indexOffset) => {
      const charInfo = toCharacterInfo(char, index);
      return {
        word: char,
        pinyin: charInfo.pinyin,
        meaning: charInfo.meaning,
        startIndex: indexOffset,
        endIndex: indexOffset + 1,
        chars: [charInfo],
      };
    });
  }

  // Inline examples this beam search improves over greedy longest-match:
  // - "为什么" should stay as one common expression, not "为 / 什么".
  // - "是不是" should stay grouped when present in dictionary entries.
  // - "没有" should beat splitting into "没 / 有" in many contexts.
  return rankStates(finalStates)[0].segments;
}
