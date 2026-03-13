import {
  ADJECTIVE_TRANSLATIONS,
  MEASURE_WORDS,
  NOUN_TRANSLATIONS,
  SUBJECT_TRANSLATIONS,
  VERB_TRANSLATIONS,
} from "./constants";
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
  "不知道",
  "不但",
  "不仅",
  "可以",
  "即使",
  "即便",
  "哪怕",
  "无论",
  "不管",
  "就算",
  "就算是",
  "既然",
  "一旦",
  "除非",
  "否则",
  "为了",
  "关于",
  "对于",
  "比起",
  "来说",
  "而且",
  "因为",
  "所以",
  "但是",
  "如果",
  "还是",
  "一起",
  "已经",
  "正在",
  "下课",
  "写作业",
  "这个问题",
  "这件事",
  "时间",
  "越来越",
]);
const EXTRA_LEXICAL_SEGMENTS: Record<
  string,
  { pinyin: string; meaning: string }
> = {
  写作业: {
    pinyin: "xie3 zuo4 ye4",
    meaning: "do homework",
  },
  看电影: {
    pinyin: "kan4 dian4 ying3",
    meaning: "watch a movie",
  },
  看电视: {
    pinyin: "kan4 dian4 shi4",
    meaning: "watch TV",
  },
  洗衣服: {
    pinyin: "xi3 yi1 fu5",
    meaning: "wash clothes",
  },
  上大学: {
    pinyin: "shang4 da4 xue2",
    meaning: "attend university",
  },
  发消息: {
    pinyin: "fa1 xiao1 xi5",
    meaning: "send a message",
  },
};
const COMMON_CHINESE_SURNAMES = new Set<string>([
  "王",
  "李",
  "张",
  "刘",
  "陈",
  "杨",
  "黄",
  "赵",
  "周",
  "吴",
  "徐",
  "孙",
  "马",
  "朱",
  "胡",
  "郭",
  "何",
  "高",
  "林",
  "罗",
  "郑",
  "梁",
  "谢",
  "宋",
  "唐",
  "许",
  "韩",
  "冯",
  "邓",
  "曹",
  "彭",
  "曾",
  "肖",
  "田",
  "董",
  "袁",
  "潘",
  "于",
  "蒋",
  "蔡",
  "余",
  "杜",
  "叶",
  "程",
  "苏",
  "魏",
  "吕",
  "丁",
  "任",
  "沈",
  "姚",
  "卢",
  "姜",
  "崔",
  "钟",
  "谭",
  "陆",
  "汪",
  "范",
  "金",
  "石",
  "廖",
  "贾",
  "夏",
  "韦",
  "傅",
  "方",
  "白",
  "邹",
  "孟",
  "熊",
  "秦",
  "邱",
  "江",
  "尹",
  "薛",
  "闫",
  "段",
  "雷",
  "侯",
  "龙",
  "史",
  "陶",
  "黎",
  "贺",
  "顾",
  "毛",
  "郝",
  "龚",
  "邵",
  "万",
  "钱",
  "严",
  "武",
  "戴",
  "莫",
  "孔",
  "向",
  "汤",
]);
const NAME_TITLE_SUFFIXES: Record<string, string> = {
  老师: "Teacher",
  先生: "Mr.",
  女士: "Ms.",
  同学: "classmate",
};
const ENTITY_SUFFIX_TRANSLATIONS: Record<string, string> = {
  大学: "University",
  公司: "Company",
};
const ENTITY_PREFIX_TRANSLATIONS: Record<string, string> = {
  北京: "Beijing",
  上海: "Shanghai",
  中国: "China",
  清华: "Tsinghua",
  北大: "Peking",
};
const NAME_INTERNAL_FORBIDDEN_CHARS = new Set<string>([
  "了",
  "过",
  "着",
  "的",
  "得",
  "地",
  "吗",
  "吧",
  "呢",
  "啊",
  "呀",
  "啦",
  "就",
  "在",
  "是",
  "有",
  "很",
  "也",
  "都",
  "不",
  "没",
  "上",
  "下",
  "来",
  "去",
  "回",
  "到",
  "给",
  "对",
  "向",
  "把",
  "被",
  "快",
  "慢",
  "再",
  "还",
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
  const meaning = MEASURE_WORDS.has(word)
    ? "classifier"
    : sanitizeMeaning(entry?.meanings?.join("; ") || "");

  return {
    segment: {
      word,
      pinyin: entry?.pinyin || "",
      meaning,
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
      !hasDictionaryChar &&
      !isChinesePunctuation(char) &&
      /[\u4e00-\u9fff]/.test(char),
    tokenLength: 1,
    word: char,
  };
}

function buildLexicalCandidate(
  word: string,
  startIndex: number,
  index: CedictIndex,
): CandidateSegment {
  const lexicalEntry = EXTRA_LEXICAL_SEGMENTS[word];

  return {
    segment: {
      word,
      pinyin: lexicalEntry.pinyin,
      meaning: lexicalEntry.meaning,
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

function buildHeuristicCandidate(
  word: string,
  startIndex: number,
  index: CedictIndex,
  pinyin: string,
  meaning: string,
): CandidateSegment {
  return {
    segment: {
      word,
      pinyin,
      meaning,
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

function isChineseText(value: string): boolean {
  return /^[\u4e00-\u9fff]+$/.test(value);
}

function formatRomanizedSyllable(pinyin: string): string {
  const normalized = pinyin.replace(/[1-5]/g, "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized[0].toUpperCase() + normalized.slice(1);
}

function romanizeChineseWord(word: string, index: CedictIndex): string {
  const entry = pickBestEntry(index.get(word) || []);
  const source =
    entry?.pinyin ||
    word
      .split("")
      .map((char) => toCharacterInfo(char, index).pinyin)
      .filter(Boolean)
      .join(" ");

  const syllables = source
    .split(/\s+/)
    .filter(Boolean)
    .map(formatRomanizedSyllable);
  return syllables.join("");
}

function hasLikelyNameBoundary(
  sentence: string,
  endIndex: number,
  index: CedictIndex,
): boolean {
  if (endIndex >= sentence.length) {
    return true;
  }

  const nextChar = sentence[endIndex];
  if (isChinesePunctuation(nextChar)) {
    return true;
  }

  if (
    GRAMMAR_PARTICLES.has(nextChar) ||
    Boolean(VERB_TRANSLATIONS[nextChar]) ||
    Boolean(SUBJECT_TRANSLATIONS[nextChar]) ||
    nextChar === "在" ||
    nextChar === "是"
  ) {
    return true;
  }

  const nextTwo = sentence.substring(endIndex, endIndex + 2);
  return Boolean(index.get(nextTwo)?.length || VERB_TRANSLATIONS[nextTwo]);
}

function hasLikelyEntityBoundaryBefore(
  sentence: string,
  position: number,
): boolean {
  if (position === 0) {
    return true;
  }

  const previousChar = sentence[position - 1];
  if (isChinesePunctuation(previousChar)) {
    return true;
  }

  return GRAMMAR_PARTICLES.has(previousChar);
}

function isPlausibleGivenNameBody(value: string): boolean {
  return (
    isChineseText(value) &&
    value.split("").every((char) => !NAME_INTERNAL_FORBIDDEN_CHARS.has(char))
  );
}

function collectHeuristicEntityCandidates(
  sentence: string,
  position: number,
  index: CedictIndex,
): CandidateSegment[] {
  const candidates: CandidateSegment[] = [];

  const nicknameWord = sentence.substring(position, position + 2);
  if (
    nicknameWord.length === 2 &&
    (nicknameWord[0] === "小" || nicknameWord[0] === "老") &&
    COMMON_CHINESE_SURNAMES.has(nicknameWord[1]) &&
    !index.get(nicknameWord)?.length &&
    hasLikelyEntityBoundaryBefore(sentence, position) &&
    hasLikelyNameBoundary(sentence, position + 2, index)
  ) {
    const first = romanizeChineseWord(nicknameWord[0], index);
    const surname = romanizeChineseWord(nicknameWord[1], index);
    candidates.push(
      buildHeuristicCandidate(
        nicknameWord,
        position,
        index,
        nicknameWord
          .split("")
          .map((char) => toCharacterInfo(char, index).pinyin)
          .join(" "),
        `${first} ${surname}`,
      ),
    );
  }

  const titleWord = sentence.substring(position, position + 3);
  const titleSuffix = titleWord.slice(1);
  if (
    titleWord.length === 3 &&
    COMMON_CHINESE_SURNAMES.has(titleWord[0]) &&
    NAME_TITLE_SUFFIXES[titleSuffix] &&
    !index.get(titleWord)?.length &&
    hasLikelyEntityBoundaryBefore(sentence, position) &&
    hasLikelyNameBoundary(sentence, position + 3, index)
  ) {
    const surname = romanizeChineseWord(titleWord[0], index);
    candidates.push(
      buildHeuristicCandidate(
        titleWord,
        position,
        index,
        titleWord
          .split("")
          .map((char) => toCharacterInfo(char, index).pinyin)
          .join(" "),
        `${NAME_TITLE_SUFFIXES[titleSuffix]} ${surname}`,
      ),
    );
  }

  for (const length of [3, 2]) {
    const word = sentence.substring(position, position + length);
    if (
      word.length === length &&
      COMMON_CHINESE_SURNAMES.has(word[0]) &&
      isPlausibleGivenNameBody(word.slice(1)) &&
      !index.get(word)?.length &&
      hasLikelyEntityBoundaryBefore(sentence, position) &&
      hasLikelyNameBoundary(sentence, position + length, index)
    ) {
      const surname = romanizeChineseWord(word[0], index);
      const givenName = romanizeChineseWord(word.slice(1), index);
      candidates.push(
        buildHeuristicCandidate(
          word,
          position,
          index,
          word
            .split("")
            .map((char) => toCharacterInfo(char, index).pinyin)
            .join(" "),
          `${surname} ${givenName}`,
        ),
      );
    }
  }

  for (const suffix of Object.keys(ENTITY_SUFFIX_TRANSLATIONS)) {
    const maxLength = Math.min(6, sentence.length - position);
    for (let length = maxLength; length >= suffix.length + 2; length -= 1) {
      const word = sentence.substring(position, position + length);
      if (
        !word.endsWith(suffix) ||
        !isChineseText(word) ||
        index.get(word)?.length ||
        !hasLikelyNameBoundary(sentence, position + length, index)
      ) {
        continue;
      }

      const prefix = word.slice(0, -suffix.length);
      const prefixMeaning =
        ENTITY_PREFIX_TRANSLATIONS[prefix] ||
        romanizeChineseWord(prefix, index);
      candidates.push(
        buildHeuristicCandidate(
          word,
          position,
          index,
          word
            .split("")
            .map((char) => toCharacterInfo(char, index).pinyin)
            .join(" "),
          `${prefixMeaning} ${ENTITY_SUFFIX_TRANSLATIONS[suffix]}`,
        ),
      );
      break;
    }
  }

  return candidates;
}

function collectCandidatesAt(
  sentence: string,
  position: number,
  index: CedictIndex,
): CandidateSegment[] {
  const candidates: CandidateSegment[] = [];
  candidates.push(
    ...collectHeuristicEntityCandidates(sentence, position, index),
  );
  for (const word of Object.keys(EXTRA_LEXICAL_SEGMENTS)) {
    if (sentence.startsWith(word, position)) {
      candidates.push(buildLexicalCandidate(word, position, index));
    }
  }

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

function splitCompactNegativeSegment(
  segment: WordSegment,
  index: CedictIndex,
): WordSegment[] | null {
  let negativeWord = "";
  let remainder = "";

  if (segment.word.startsWith("没有") && segment.word.length > 2) {
    negativeWord = "没有";
    remainder = segment.word.slice(2);
  } else if (segment.word.startsWith("没") && segment.word.length > 1) {
    negativeWord = "没";
    remainder = segment.word.slice(1);
  } else if (segment.word.startsWith("不") && segment.word.length > 1) {
    negativeWord = "不";
    remainder = segment.word.slice(1);
  } else {
    return null;
  }

  const remainderMeaning =
    ADJECTIVE_TRANSLATIONS[remainder] || NOUN_TRANSLATIONS[remainder];
  if (!remainderMeaning) {
    return null;
  }

  const negativeChars = segment.chars.slice(0, negativeWord.length);
  const remainderChars = segment.chars.slice(negativeWord.length);
  const negativeEntry = pickBestEntry(index.get(negativeWord) || []);
  const remainderEntry = pickBestEntry(index.get(remainder) || []);

  return [
    {
      word: negativeWord,
      pinyin:
        negativeEntry?.pinyin ||
        negativeChars
          .map((char) => char.pinyin)
          .filter(Boolean)
          .join(" "),
      meaning: negativeWord === "不" ? "not" : "not have",
      startIndex: segment.startIndex,
      endIndex: segment.startIndex + negativeWord.length,
      chars: negativeChars,
    },
    {
      word: remainder,
      pinyin:
        remainderEntry?.pinyin ||
        remainderChars
          .map((char) => char.pinyin)
          .filter(Boolean)
          .join(" "),
      meaning:
        sanitizeMeaning(remainderEntry?.meanings?.join("; ") || "") ||
        remainderMeaning,
      startIndex: segment.startIndex + negativeWord.length,
      endIndex: segment.endIndex,
      chars: remainderChars,
    },
  ];
}

function splitSubjectVerbExperientialSegment(
  segment: WordSegment,
  nextSegment: WordSegment | undefined,
  index: CedictIndex,
): WordSegment[] | null {
  if (nextSegment?.word !== "过" || !segment.word.endsWith("去")) {
    return null;
  }

  const subjectWord = segment.word.slice(0, -1);
  if (!SUBJECT_TRANSLATIONS[subjectWord]) {
    return null;
  }

  const subjectChars = segment.chars.slice(0, -1);
  const verbChars = segment.chars.slice(-1);
  const subjectEntry = pickBestEntry(index.get(subjectWord) || []);
  const quEntry = pickBestEntry(index.get("去") || []);

  return [
    {
      word: subjectWord,
      pinyin:
        subjectEntry?.pinyin ||
        subjectChars
          .map((char) => char.pinyin)
          .filter(Boolean)
          .join(" "),
      meaning:
        sanitizeMeaning(subjectEntry?.meanings?.join("; ") || "") ||
        SUBJECT_TRANSLATIONS[subjectWord],
      startIndex: segment.startIndex,
      endIndex: segment.endIndex - 1,
      chars: subjectChars,
    },
    {
      word: "去",
      pinyin:
        quEntry?.pinyin ||
        verbChars
          .map((char) => char.pinyin)
          .filter(Boolean)
          .join(" "),
      meaning:
        sanitizeMeaning(quEntry?.meanings?.join("; ") || "") ||
        VERB_TRANSLATIONS["去"],
      startIndex: segment.endIndex - 1,
      endIndex: segment.endIndex,
      chars: verbChars,
    },
  ];
}

function mergeVerbCompoundSegment(
  segment: WordSegment,
  nextSegment: WordSegment | undefined,
  index: CedictIndex,
): WordSegment | null {
  if (!nextSegment || segment.word !== "想" || nextSegment.word !== "好") {
    return null;
  }

  const mergedWord = "想好";

  const entry = pickBestEntry(index.get(mergedWord) || []);

  return {
    word: mergedWord,
    pinyin:
      entry?.pinyin ||
      [segment.pinyin, nextSegment.pinyin].filter(Boolean).join(" "),
    meaning:
      sanitizeMeaning(entry?.meanings?.join("; ") || "") ||
      VERB_TRANSLATIONS[mergedWord] ||
      segment.meaning,
    startIndex: segment.startIndex,
    endIndex: nextSegment.endIndex,
    chars: [...segment.chars, ...nextSegment.chars],
  };
}

function normalizeSegmentOutput(
  segments: WordSegment[],
  index: CedictIndex,
): WordSegment[] {
  const normalized: WordSegment[] = [];

  for (
    let indexPosition = 0;
    indexPosition < segments.length;
    indexPosition += 1
  ) {
    const segment = segments[indexPosition];
    const nextSegment = segments[indexPosition + 1];
    const thirdSegment = segments[indexPosition + 2];

    const experientialSplit = splitSubjectVerbExperientialSegment(
      segment,
      nextSegment,
      index,
    );
    if (experientialSplit) {
      normalized.push(...experientialSplit);
      continue;
    }

    const mergedCompound = mergeVerbCompoundSegment(
      segment,
      nextSegment,
      index,
    );
    if (mergedCompound) {
      normalized.push(mergedCompound);
      indexPosition += 1;
      continue;
    }

    if (
      (segment.word === "不" &&
        (nextSegment?.word === "知道" ||
          (nextSegment?.word === "知" && thirdSegment?.word === "道"))) ||
      (segment.word === "不知" && nextSegment?.word === "道")
    ) {
      const mergedWord = "不知道";
      const mergedSegments =
        segment.word === "不知"
          ? [segment, nextSegment]
          : nextSegment.word === "知道"
            ? [segment, nextSegment]
            : [segment, nextSegment, thirdSegment];
      const entry = pickBestEntry(index.get(mergedWord) || []);

      normalized.push({
        word: mergedWord,
        pinyin:
          entry?.pinyin ||
          mergedSegments
            .map((item) => item.pinyin)
            .filter(Boolean)
            .join(" "),
        meaning: sanitizeMeaning(entry?.meanings?.join("; ") || "not know"),
        startIndex: segment.startIndex,
        endIndex: mergedSegments[mergedSegments.length - 1].endIndex,
        chars: mergedSegments.flatMap((item) => item.chars),
      });
      indexPosition += mergedSegments.length - 1;
      continue;
    }

    const perspectiveMatch = segment.word.match(
      /^对(我|你|您|他|她|它|我们|你们|他们|她们|它们)来说$/,
    );
    if (perspectiveMatch) {
      const [, pronounWord] = perspectiveMatch;
      const duiInfo = toCharacterInfo("对", index);
      const laishuoEntry = pickBestEntry(index.get("来说") || []);
      const pronounEntry = pickBestEntry(index.get(pronounWord) || []);

      normalized.push(
        {
          word: "对",
          pinyin: duiInfo.pinyin,
          meaning: "toward",
          startIndex: segment.startIndex,
          endIndex: segment.startIndex + 1,
          chars: [duiInfo],
        },
        {
          word: pronounWord,
          pinyin: pronounEntry?.pinyin || "",
          meaning: sanitizeMeaning(pronounEntry?.meanings?.join("; ") || ""),
          startIndex: segment.startIndex + 1,
          endIndex: segment.startIndex + 1 + pronounWord.length,
          chars: pronounWord
            .split("")
            .map((char) => toCharacterInfo(char, index)),
        },
        {
          word: "来说",
          pinyin: "lai2 shuo1",
          meaning: sanitizeMeaning(
            laishuoEntry?.meanings?.join("; ") || "speaking of",
          ),
          startIndex: segment.endIndex - 2,
          endIndex: segment.endIndex,
          chars: ["来", "说"].map((char) => toCharacterInfo(char, index)),
        },
      );
      continue;
    }

    if (segment.word === "一" && nextSegment?.word === "旦") {
      const mergedWord = "一旦";
      const entry = pickBestEntry(index.get(mergedWord) || []);

      normalized.push({
        word: mergedWord,
        pinyin:
          entry?.pinyin ||
          [segment.pinyin, nextSegment.pinyin].filter(Boolean).join(" "),
        meaning: sanitizeMeaning(entry?.meanings?.join("; ") || "once"),
        startIndex: segment.startIndex,
        endIndex: nextSegment.endIndex,
        chars: [...segment.chars, ...nextSegment.chars],
      });
      indexPosition += 1;
      continue;
    }

    if (segment.word === "来" && nextSegment?.word === "说") {
      const mergedWord = "来说";
      const entry = pickBestEntry(index.get(mergedWord) || []);

      normalized.push({
        word: mergedWord,
        pinyin: "lai2 shuo1",
        meaning: sanitizeMeaning(entry?.meanings?.join("; ") || "speaking of"),
        startIndex: segment.startIndex,
        endIndex: nextSegment.endIndex,
        chars: [...segment.chars, ...nextSegment.chars],
      });
      indexPosition += 1;
      continue;
    }

    if (segment.word === "就算" && nextSegment?.word === "是") {
      normalized.push({
        word: "就算是",
        pinyin: "jiu4 suan4 shi4",
        meaning: "even if",
        startIndex: segment.startIndex,
        endIndex: nextSegment.endIndex,
        chars: [...segment.chars, ...nextSegment.chars],
      });
      indexPosition += 1;
      continue;
    }

    if (
      segment.word === "这" &&
      nextSegment?.word === "件" &&
      thirdSegment?.word === "事"
    ) {
      const mergedWord = "这件事";
      const entry = pickBestEntry(index.get(mergedWord) || []);

      normalized.push({
        word: mergedWord,
        pinyin:
          entry?.pinyin ||
          [segment.pinyin, nextSegment.pinyin, thirdSegment.pinyin]
            .filter(Boolean)
            .join(" "),
        meaning: sanitizeMeaning(entry?.meanings?.join("; ") || "this matter"),
        startIndex: segment.startIndex,
        endIndex: thirdSegment.endIndex,
        chars: [...segment.chars, ...nextSegment.chars, ...thirdSegment.chars],
      });
      indexPosition += 2;
      continue;
    }

    if (segment.word === "把门") {
      const baInfo = toCharacterInfo("把", index);
      const menInfo = toCharacterInfo("门", index);

      normalized.push(
        {
          word: "把",
          pinyin: baInfo.pinyin,
          meaning: "disposal marker",
          startIndex: segment.startIndex,
          endIndex: segment.startIndex + 1,
          chars: [baInfo],
        },
        {
          word: "门",
          pinyin: menInfo.pinyin,
          meaning: "door",
          startIndex: segment.startIndex + 1,
          endIndex: segment.endIndex,
          chars: [menInfo],
        },
      );
      continue;
    }

    const splitNegativeSegments = splitCompactNegativeSegment(segment, index);
    if (splitNegativeSegments) {
      normalized.push(...splitNegativeSegments);
      continue;
    }

    normalized.push(segment);
  }

  return normalized;
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
  return normalizeSegmentOutput(rankStates(finalStates)[0].segments, index);
}
