import {
  ADVERB_TRANSLATIONS,
  COMPLEMENT_TRANSLATIONS,
  DYNAMIC_PASSIVE_PARTICIPLES,
  LOCATION_QUESTION_WORDS,
  QUESTION_WORD_TRANSLATIONS,
  RESULTATIVE_VERB_TRANSLATIONS,
  SUBJECT_TRANSLATIONS,
  TIME_TRANSLATIONS,
  VERB_TRANSLATIONS,
} from "./constants";
import {
  addSimpleArticle,
  beForm,
  buildEmbeddedWhClause,
  buildWhQuestion,
  buildYesNoQuestion,
  capitalizeSentence,
  conjugateVerb,
  doAux,
  formatLocationPhrase,
  haveForm,
  isPunctuationToken,
  isQuestionMarkToken,
  makeSentence,
  normalizeClauseOrder,
  possessiveForSubject,
  toGerund,
  toPastParticiple,
  toPastTense,
  wasWereForm,
  withSentenceContext,
} from "./english-utils";
import { pickPrimaryMeaning, translatePhrase } from "./gloss";
import type {
  RuleToken,
  TranslatedPhrase,
  TranslationResult,
  WordSegment,
} from "./types";

type RuleContext = {
  tokens: RuleToken[];
  isQuestion: boolean;
  timePhrase: string;
  subject: string;
  coreTokens: RuleToken[];
  adverbs: string[];
  head?: string;
  tail: RuleToken[];
};

type RuleMatcher = (context: RuleContext) => string | null;

const PREDICATE_MARKERS = new Set<string>([
  "是",
  "有",
  "很",
  "在",
  "比",
  "把",
  "被",
  "给",
  "不",
  "没",
  "没有",
  "吗",
]);

export type ParsedSentenceStructure = {
  subject: string;
  timePhrase: string;
  head?: string;
  tail: string[];
  adverbs: string[];
  isQuestion: boolean;
  tokens: string[];
};

function isPredicateStartToken(word: string): boolean {
  return (
    PREDICATE_MARKERS.has(word) ||
    Boolean(VERB_TRANSLATIONS[word]) ||
    Boolean(QUESTION_WORD_TRANSLATIONS[word])
  );
}

function normalizeHaveObjectPhrase(objectPhrase: string): string {
  const stripped = objectPhrase
    .replace(/\bclassifier\b.*$/gi, "")
    .replace(/\bindividual\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const dropLeadingOne = stripped.replace(/^(one|1)\s+/i, "").trim();
  if (!dropLeadingOne) {
    return stripped;
  }

  return addSimpleArticle("he", dropLeadingOne);
}

function findExplicitSubjectIndex(tokens: RuleToken[]): number {
  for (let index = 0; index < Math.min(tokens.length, 3); index += 1) {
    if (SUBJECT_TRANSLATIONS[tokens[index].word]) {
      return index;
    }
  }

  return -1;
}

function splitLeadingAdverbs(tokens: RuleToken[]): {
  adverbs: string[];
  remainder: RuleToken[];
} {
  const adverbs: string[] = [];
  let index = 0;

  while (index < tokens.length && ADVERB_TRANSLATIONS[tokens[index].word]) {
    adverbs.push(ADVERB_TRANSLATIONS[tokens[index].word]);
    index += 1;
  }

  return { adverbs, remainder: tokens.slice(index) };
}

function applyAdverbsToClause(
  clause: string,
  subject: string,
  adverbs: string[],
): string {
  if (adverbs.length === 0) {
    return clause;
  }

  const adverbText = adverbs.join(" ");
  const subjectPattern = new RegExp(
    `^${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`,
    "i",
  );
  if (subjectPattern.test(clause)) {
    return clause.replace(subjectPattern, `${subject} ${adverbText} `);
  }

  const auxiliaryPattern = /^(Can|Do|Does|Am|Are|Is)\s+/;
  if (auxiliaryPattern.test(clause)) {
    return clause.replace(
      auxiliaryPattern,
      (match) => `${match}${adverbText} `,
    );
  }

  return `${adverbText} ${clause}`.trim();
}

function normalizeVerbObjectPhrase(verb: string, objectPhrase: string): string {
  const normalizedObject = objectPhrase.trim();
  if (!normalizedObject) {
    return verb;
  }

  if (verb === "go" || verb === "come") {
    if (/^(to|home)\b/i.test(normalizedObject)) {
      return `${verb} ${normalizedObject}`;
    }

    return `${verb} ${formatLocationPhrase(normalizedObject, "motion")}`;
  }

  if (verb === "return") {
    if (/^home\b/i.test(normalizedObject)) {
      return `${verb} ${normalizedObject}`;
    }

    return `${verb} ${formatLocationPhrase(normalizedObject, "motion")}`;
  }

  if (verb === "live") {
    return `${verb} ${formatLocationPhrase(normalizedObject, "static")}`;
  }

  return `${verb} ${normalizedObject}`;
}

function translateVerbPhrase(tokens: RuleToken[]): TranslatedPhrase {
  if (tokens.length === 0) {
    return {
      text: "",
      isVerbPhrase: false,
      isPast: false,
      isExperienced: false,
      isOngoing: false,
    };
  }

  const combinedWord = `${tokens[0].word}${tokens[1]?.word || ""}`;
  const firstVerb =
    RESULTATIVE_VERB_TRANSLATIONS[combinedWord] ||
    VERB_TRANSLATIONS[tokens[0].word];
  const aspectMarkers = new Set(tokens.map((token) => token.word));
  const isPast = aspectMarkers.has("了");
  const isExperienced = aspectMarkers.has("过");
  const isOngoing = aspectMarkers.has("着");

  if (!firstVerb) {
    return {
      text: translatePhrase(tokens, true),
      isVerbPhrase: false,
      isPast,
      isExperienced,
      isOngoing,
    };
  }

  const remainingTokens = tokens.filter(
    (token, index) =>
      index !== 0 &&
      !(RESULTATIVE_VERB_TRANSLATIONS[combinedWord] && index === 1) &&
      token.word !== "了" &&
      token.word !== "过" &&
      token.word !== "着",
  );

  const nestedVerb = VERB_TRANSLATIONS[remainingTokens[0]?.word || ""];
  if (nestedVerb) {
    const nestedPhrase = translateVerbPhrase(remainingTokens);
    return {
      text: normalizeVerbObjectPhrase(firstVerb, nestedPhrase.text),
      isVerbPhrase: true,
      isPast: isPast || nestedPhrase.isPast,
      isExperienced: isExperienced || nestedPhrase.isExperienced,
      isOngoing: isOngoing || nestedPhrase.isOngoing,
    };
  }

  return {
    text: normalizeVerbObjectPhrase(
      firstVerb,
      translatePhrase(remainingTokens, true),
    ),
    isVerbPhrase: true,
    isPast,
    isExperienced,
    isOngoing,
  };
}

function normalizeDegreeComplement(text: string): string {
  return text
    .replace(/\bvery good\b/gi, "very well")
    .replace(/\bgood\b/gi, "well")
    .replace(/\bquite good\b/gi, "quite well")
    .trim();
}

function findQuestionWordIndex(tokens: RuleToken[]): number {
  return tokens.findIndex((token) =>
    Boolean(QUESTION_WORD_TRANSLATIONS[token.word]),
  );
}

function findFirstVerbIndex(tokens: RuleToken[]): number {
  return tokens.findIndex(
    (token, index) =>
      Boolean(VERB_TRANSLATIONS[token.word]) ||
      Boolean(
        RESULTATIVE_VERB_TRANSLATIONS[
          `${token.word}${tokens[index + 1]?.word || ""}`
        ],
      ),
  );
}

function buildAdjectiveSentence(
  subject: string,
  predicate: string,
  isQuestion: boolean,
  adverbs: string[],
): string {
  const clause = isQuestion
    ? buildYesNoQuestion(subject, "be", predicate).replace(/[?.!]$/, "")
    : `${subject} ${beForm(subject)} ${predicate}`;

  return makeSentence(
    normalizeClauseOrder(applyAdverbsToClause(clause, subject, adverbs)),
    isQuestion,
  );
}

function buildBeSentence(
  subject: string,
  predicate: string,
  isQuestion: boolean,
): string {
  const normalizedPredicate = addSimpleArticle(subject, predicate);
  if (isQuestion) {
    return buildYesNoQuestion(subject, "be", normalizedPredicate);
  }

  return makeSentence(
    `${subject} ${beForm(subject)} ${normalizedPredicate}`,
    false,
  );
}

function buildHaveSentence(
  subject: string,
  objectPhrase: string,
  isQuestion: boolean,
  isNegative: boolean,
): string {
  const normalizedObject = normalizeHaveObjectPhrase(objectPhrase);
  if (isQuestion) {
    return makeSentence(
      `${capitalizeSentence(doAux(subject))} ${subject.toLowerCase()} have ${normalizedObject}`,
      true,
    );
  }
  if (isNegative) {
    return makeSentence(
      `${subject} ${doAux(subject)} not have ${normalizedObject}`,
      false,
    );
  }

  return makeSentence(
    `${subject} ${haveForm(subject)} ${normalizedObject}`,
    false,
  );
}

function buildLocationSentence(
  subject: string,
  locationPhrase: string,
  isQuestion: boolean,
  isNegative: boolean,
): string {
  const location = formatLocationPhrase(locationPhrase, "static");

  if (isQuestion) {
    return buildYesNoQuestion(subject, "be", location);
  }
  if (isNegative) {
    return makeSentence(`${subject} ${beForm(subject)} not ${location}`, false);
  }

  return makeSentence(`${subject} ${beForm(subject)} ${location}`, false);
}

function buildProgressiveSentence(
  subject: string,
  actionPhrase: string,
  isQuestion: boolean,
  isNegative: boolean,
  adverbs: string[],
): string {
  const progressiveAction = toGerund(actionPhrase);
  const clause = isQuestion
    ? buildYesNoQuestion(subject, "be", progressiveAction).replace(/[?.!]$/, "")
    : `${subject} ${beForm(subject)}${isNegative ? " not" : ""} ${progressiveAction}`;

  return makeSentence(
    normalizeClauseOrder(applyAdverbsToClause(clause, subject, adverbs)),
    isQuestion,
  );
}

function buildComparisonSentence(
  subject: string,
  comparisonTarget: string,
  predicate: string,
  adverbs: string[],
): string {
  return makeSentence(
    applyAdverbsToClause(
      `${subject} ${beForm(subject)} more ${predicate} than ${comparisonTarget}`,
      subject,
      adverbs,
    ),
    false,
  );
}

function buildImperativeSentence(tokens: RuleToken[]): string | null {
  if (tokens.length === 0) {
    return null;
  }

  if (tokens[0].word === "不要" || (tokens[0].word === "不" && tokens[1])) {
    const verbIndex = 1;
    const combinedWord = `${tokens[verbIndex]?.word || ""}${tokens[verbIndex + 1]?.word || ""}`;
    const verb =
      RESULTATIVE_VERB_TRANSLATIONS[combinedWord] ||
      VERB_TRANSLATIONS[tokens[verbIndex]?.word || ""];
    if (!verb) {
      return null;
    }
    const objectTokens = RESULTATIVE_VERB_TRANSLATIONS[combinedWord]
      ? tokens.slice(verbIndex + 2)
      : tokens.slice(verbIndex + 1);

    return makeSentence(
      `Do not ${normalizeVerbObjectPhrase(verb, translatePhrase(objectTokens, true))}`.trim(),
      false,
    );
  }

  const combinedWord = `${tokens[0].word}${tokens[1]?.word || ""}`;
  const verb =
    RESULTATIVE_VERB_TRANSLATIONS[combinedWord] ||
    VERB_TRANSLATIONS[tokens[0].word];
  if (!verb) {
    return null;
  }

  const offset = RESULTATIVE_VERB_TRANSLATIONS[combinedWord] ? 2 : 1;
  return makeSentence(
    normalizeVerbObjectPhrase(
      verb,
      translatePhrase(tokens.slice(offset), true),
    ),
    false,
  );
}

function buildComplementSentence(
  subject: string,
  headWord: string,
  tail: RuleToken[],
  isQuestion: boolean,
  adverbs: string[],
): string | null {
  const baseVerb = VERB_TRANSLATIONS[headWord] || pickPrimaryMeaning(headWord);
  const complementKey = `${headWord}${tail.map((token) => token.word).join("")}`;
  const explicitComplement = COMPLEMENT_TRANSLATIONS[complementKey];

  if (explicitComplement?.positive) {
    return makeSentence(
      applyAdverbsToClause(
        `${subject} ${explicitComplement.positive}`,
        subject,
        adverbs,
      ),
      isQuestion,
    );
  }

  if (explicitComplement?.negative) {
    return makeSentence(
      applyAdverbsToClause(
        `${subject} ${explicitComplement.negative}`,
        subject,
        adverbs,
      ),
      false,
    );
  }

  if (tail[0]?.word === "得" && tail[1]?.word === "懂") {
    return makeSentence(
      applyAdverbsToClause(`${subject} can understand`, subject, adverbs),
      isQuestion,
    );
  }
  if (tail[0]?.word === "不" && tail[1]?.word === "懂") {
    return makeSentence(
      applyAdverbsToClause(`${subject} cannot understand`, subject, adverbs),
      false,
    );
  }

  if (tail[0]?.word === "得") {
    const degree = normalizeDegreeComplement(
      translatePhrase(tail.slice(1), false),
    );
    if (degree) {
      const clause =
        baseVerb === "do"
          ? `${subject} ${conjugateVerb(subject, baseVerb)} it ${degree}`
          : `${subject} ${conjugateVerb(subject, baseVerb)} ${degree}`;

      return makeSentence(
        applyAdverbsToClause(clause, subject, adverbs),
        isQuestion,
      );
    }
  }

  return null;
}

function buildPassiveSentence(
  subject: string,
  agent: string,
  verbPhrase: string,
  isPast: boolean,
): string {
  const participle = toPastParticiple(verbPhrase);
  const passiveAuxiliary =
    isPast && DYNAMIC_PASSIVE_PARTICIPLES.has(participle)
      ? "got"
      : isPast
        ? wasWereForm(subject)
        : beForm(subject);

  return makeSentence(
    `${subject} ${passiveAuxiliary} ${participle} by ${agent}`.trim(),
    false,
  );
}

function buildGiveSentence(
  subject: string,
  recipient: string,
  objectPhrase: string,
  isPast: boolean,
): string {
  const verb = isPast ? "gave" : conjugateVerb(subject, "give");
  return makeSentence(
    `${subject} ${verb} ${addSimpleArticle(subject, objectPhrase)} to ${recipient}`.trim(),
    false,
  );
}

function buildVerbSentence(
  subject: string,
  verb: string,
  objectPhrase: string,
  isQuestion: boolean,
  isNegative: boolean,
  objectIsVerbPhrase = false,
  isPast = false,
  isExperienced = false,
  isOngoing = false,
): string {
  if (verb === "can") {
    if (isQuestion) {
      return buildYesNoQuestion(subject, "modal", objectPhrase, {
        modal: "can",
      });
    }
    if (isNegative) {
      return makeSentence(`${subject} cannot ${objectPhrase}`.trim(), false);
    }

    return makeSentence(`${subject} can ${objectPhrase}`.trim(), false);
  }

  if (verb === "be called") {
    if (isQuestion) {
      return buildYesNoQuestion(subject, "be", `called ${objectPhrase}`.trim());
    }

    return makeSentence(`${subject} is called ${objectPhrase}`.trim(), false);
  }

  if (verb === "want" || verb === "like") {
    const actionOrObject =
      objectIsVerbPhrase && objectPhrase ? `to ${objectPhrase}` : objectPhrase;

    if (isQuestion) {
      return buildYesNoQuestion(
        subject,
        "do",
        `${verb} ${actionOrObject}`.trim(),
      );
    }
    if (isNegative) {
      return makeSentence(
        `${subject} ${doAux(subject)} not ${verb} ${actionOrObject}`.trim(),
        false,
      );
    }

    return makeSentence(
      `${subject} ${conjugateVerb(subject, verb)} ${actionOrObject}`.trim(),
      false,
    );
  }

  if (isOngoing) {
    return buildProgressiveSentence(
      subject,
      normalizeVerbObjectPhrase(verb, objectPhrase),
      isQuestion,
      isNegative,
      [],
    );
  }

  if (isQuestion) {
    return buildYesNoQuestion(subject, "do", `${verb} ${objectPhrase}`.trim());
  }
  if (isNegative) {
    return makeSentence(
      `${subject} ${doAux(subject)} not ${verb} ${objectPhrase}`.trim(),
      false,
    );
  }
  if (isExperienced) {
    return makeSentence(
      `${subject} ${haveForm(subject)} ${toPastParticiple(normalizeVerbObjectPhrase(verb, objectPhrase))} before`.trim(),
      false,
    );
  }
  if (isPast) {
    return makeSentence(
      `${subject} ${toPastTense(normalizeVerbObjectPhrase(verb, objectPhrase === verb ? "" : objectPhrase))}`.trim(),
      false,
    );
  }

  return makeSentence(
    `${subject} ${conjugateVerb(subject, verb)} ${objectPhrase}`.trim(),
    false,
  );
}

function buildQuestionWordSentence(
  subject: string,
  questionWord: string,
  head: string | undefined,
  tail: RuleToken[],
): string | null {
  const translatedQuestion = QUESTION_WORD_TRANSLATIONS[questionWord];
  if (!translatedQuestion || !head) {
    return null;
  }

  if (head === "是" || head === "在") {
    return buildWhQuestion(translatedQuestion, subject, "be", "");
  }

  const verb = VERB_TRANSLATIONS[head];
  if (!verb) {
    return null;
  }

  if (verb === "can") {
    return buildWhQuestion(
      translatedQuestion,
      subject,
      "modal",
      "",
      translatePhrase(tail, true),
      { modal: "can" },
    );
  }

  return buildWhQuestion(
    translatedQuestion,
    subject,
    "do",
    verb,
    translatePhrase(tail, true),
  );
}

function toInfinitiveActionPhrase(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "do it";
  }
  if (/^(do|say|make|write|read|call|use|study|work|learn|speak)$/i.test(normalized)) {
    return `${normalized} it`;
  }

  return normalized.replace(/^to\s+/i, "");
}

function buildEmbeddedQuestionSentence(
  subject: string,
  verb: string,
  tail: RuleToken[],
): string | null {
  // Target fixtures for iteration 3:
  // 你为什么学中文 | 你在哪儿工作 | 你叫什么名字
  // 他给谁打电话 | 你想怎么做 | 你会不会说中文 | 这本书是谁的
  // Expected shape examples:
  // - Why do you study Chinese?
  // - Where do you work?
  // - What is your name?
  // - Who does he call on the phone?
  // - How do you want to do it?
  const questionIndex = findQuestionWordIndex(tail);
  if (questionIndex === -1) {
    return null;
  }

  const questionWord = tail[questionIndex].word;
  const before = translatePhrase(tail.slice(0, questionIndex), true);
  const after = translatePhrase(tail.slice(questionIndex + 1), true);

  if (verb === "be called" && questionWord === "什么") {
    if (
      /\bname\b/i.test(after) ||
      tail.some((token) => token.word === "名字")
    ) {
      return makeSentence(
        normalizeClauseOrder(`What is ${possessiveForSubject(subject)} name`),
        true,
      );
    }

    return buildWhQuestion("what", subject, "be", "called");
  }

  if (LOCATION_QUESTION_WORDS.has(questionWord)) {
    return buildWhQuestion("where", subject, "do", verb, before);
  }

  if (questionWord === "什么") {
    return buildWhQuestion(
      "what",
      subject,
      verb === "can" ? "modal" : "do",
      verb === "can" ? "" : verb,
      [before, after].filter(Boolean).join(" "),
      verb === "can" ? { modal: "can" } : undefined,
    );
  }

  if (questionWord === "谁") {
    return buildWhQuestion(
      "who",
      subject,
      verb === "can" ? "modal" : "do",
      verb === "can" ? "" : verb,
      [before, after].filter(Boolean).join(" "),
      verb === "can" ? { modal: "can" } : undefined,
    );
  }

  if (questionWord === "怎么") {
    if (verb === "want" || verb === "like") {
      const actionPhrase = [before, after].filter(Boolean).join(" ").trim();
      const normalizedAction = toInfinitiveActionPhrase(actionPhrase);
      const [embeddedVerb, ...embeddedTail] = normalizedAction.split(/\s+/);
      const embedded = buildEmbeddedWhClause("how", {
        verb: embeddedVerb || "do",
        object: embeddedTail.join(" "),
        infinitive: true,
      }).replace(/^how\s+/i, "");

      return buildWhQuestion("how", subject, "do", verb, embedded);
    }

    return buildWhQuestion(
      "how",
      subject,
      verb === "can" ? "modal" : "do",
      verb === "can" ? "" : verb,
      [before, after].filter(Boolean).join(" "),
      verb === "can" ? { modal: "can" } : undefined,
    );
  }

  if (questionWord === "为什么") {
    return buildWhQuestion(
      "why",
      subject,
      verb === "can" ? "modal" : "do",
      verb === "can" ? "" : verb,
      [before, after].filter(Boolean).join(" "),
      verb === "can" ? { modal: "can" } : undefined,
    );
  }

  return null;
}

function buildContext(wordSegments: WordSegment[]): RuleContext | null {
  const tokens = wordSegments.map<RuleToken>((segment) => ({
    word: segment.word,
    meaning: segment.meaning,
  }));

  let isQuestion = false;
  while (
    tokens.length > 0 &&
    isPunctuationToken(tokens[tokens.length - 1].word)
  ) {
    if (isQuestionMarkToken(tokens[tokens.length - 1].word)) {
      isQuestion = true;
    }
    tokens.pop();
  }

  if (tokens.length > 0 && tokens[tokens.length - 1].word === "吗") {
    isQuestion = true;
    tokens.pop();
  }

  if (tokens.length === 0) {
    return null;
  }

  const explicitSubjectIndex = findExplicitSubjectIndex(tokens);
  if (explicitSubjectIndex === -1) {
    let prefixIndex = 0;
    while (
      prefixIndex < tokens.length &&
      TIME_TRANSLATIONS[tokens[prefixIndex].word]
    ) {
      prefixIndex += 1;
    }

    const imperativeSentence = buildImperativeSentence(
      tokens.slice(prefixIndex),
    );
    if (imperativeSentence) {
      return {
        tokens,
        isQuestion,
        timePhrase: translatePhrase(tokens.slice(0, prefixIndex)),
        subject: "",
        coreTokens: [],
        adverbs: [],
        tail: [],
      };
    }
  }

  let leadingTimeTokens: RuleToken[] = [];
  let subjectTokens: RuleToken[] = [];
  let remainderTokens: RuleToken[] = [];

  if (explicitSubjectIndex !== -1) {
    leadingTimeTokens = tokens.slice(0, explicitSubjectIndex);
    subjectTokens = [tokens[explicitSubjectIndex]];
    remainderTokens = tokens.slice(explicitSubjectIndex + 1);
  } else {
    let cursor = 0;
    while (cursor < tokens.length && TIME_TRANSLATIONS[tokens[cursor].word]) {
      cursor += 1;
    }

    leadingTimeTokens = tokens.slice(0, cursor);

    let predicateIndex = -1;
    for (let index = cursor + 1; index < tokens.length; index += 1) {
      if (isPredicateStartToken(tokens[index].word)) {
        predicateIndex = index;
        break;
      }
    }

    if (predicateIndex === -1) {
      predicateIndex = Math.min(cursor + 1, tokens.length);
    }

    subjectTokens = tokens.slice(cursor, predicateIndex);
    remainderTokens = tokens.slice(predicateIndex);
  }

  if (subjectTokens.length === 0) {
    return null;
  }

  const subject =
    translatePhrase(subjectTokens, false) ||
    SUBJECT_TRANSLATIONS[subjectTokens[0].word] ||
    pickPrimaryMeaning(subjectTokens[0].meaning);
  if (!subject) {
    return null;
  }

  const trailingTimeTokens: RuleToken[] = [];
  while (
    remainderTokens.length > 0 &&
    TIME_TRANSLATIONS[remainderTokens[0].word]
  ) {
    trailingTimeTokens.push(remainderTokens[0]);
    remainderTokens = remainderTokens.slice(1);
  }

  const { adverbs, remainder } = splitLeadingAdverbs(remainderTokens);
  const coreTokens = [...subjectTokens, ...remainderTokens];
  const timePhrase = [
    translatePhrase(leadingTimeTokens),
    translatePhrase(trailingTimeTokens),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    tokens,
    isQuestion,
    timePhrase,
    subject,
    coreTokens,
    adverbs,
    head: remainder[0]?.word,
    tail: remainder.slice(1),
  };
}

function matchImperativeRule(context: RuleContext): string | null {
  if (context.subject) {
    return null;
  }

  let prefixIndex = 0;
  while (
    prefixIndex < context.tokens.length &&
    TIME_TRANSLATIONS[context.tokens[prefixIndex].word]
  ) {
    prefixIndex += 1;
  }

  const imperativeSentence = buildImperativeSentence(
    context.tokens.slice(prefixIndex),
  );
  return imperativeSentence
    ? withSentenceContext(
        imperativeSentence,
        translatePhrase(context.tokens.slice(0, prefixIndex)),
      )
    : null;
}

function matchComplementRule(context: RuleContext): string | null {
  if (
    !context.head ||
    (context.tail[0]?.word !== "得" && context.tail[0]?.word !== "不")
  ) {
    return null;
  }

  const sentence = buildComplementSentence(
    context.subject,
    context.head,
    context.tail,
    context.isQuestion,
    context.adverbs,
  );

  return sentence ? withSentenceContext(sentence, context.timePhrase) : null;
}

function matchQuestionWordRule(context: RuleContext): string | null {
  if (!QUESTION_WORD_TRANSLATIONS[context.head || ""]) {
    return null;
  }

  const sentence = buildQuestionWordSentence(
    context.subject,
    context.head || "",
    context.tail[0]?.word,
    context.tail.slice(1),
  );
  return sentence ? withSentenceContext(sentence, context.timePhrase) : null;
}

function matchShiPredicateRule(context: RuleContext): string | null {
  if (context.head !== "是") {
    return null;
  }

  const predicate = translatePhrase(context.tail, false);
  if (!predicate) {
    return null;
  }

  return withSentenceContext(
    applyAdverbsToClause(
      buildBeSentence(context.subject, predicate, context.isQuestion).replace(
        /[?.!]$/,
        "",
      ),
      context.subject,
      context.adverbs,
    ) + (context.isQuestion ? "?" : "."),
    context.timePhrase,
  );
}

function matchBaRule(context: RuleContext): string | null {
  if (context.head !== "把") {
    return null;
  }

  const giveIndex = context.tail.findIndex((token) => token.word === "给");
  if (giveIndex > 0) {
    const recipientActionIndex = findFirstVerbIndex(
      context.tail.slice(giveIndex + 1),
    );
    if (recipientActionIndex > 0) {
      const objectPhrase = translatePhrase(
        context.tail.slice(0, giveIndex),
        true,
      );
      const recipient = translatePhrase(
        context.tail.slice(giveIndex + 1, giveIndex + 1 + recipientActionIndex),
        true,
      );
      const actionTokens = context.tail.slice(
        giveIndex + 1 + recipientActionIndex,
      );
      const resultativeKey = `${actionTokens[0]?.word || ""}${actionTokens[1]?.word || ""}`;
      const actionWord =
        RESULTATIVE_VERB_TRANSLATIONS[resultativeKey] ||
        VERB_TRANSLATIONS[actionTokens[0]?.word || ""];
      const actionOffset = RESULTATIVE_VERB_TRANSLATIONS[resultativeKey]
        ? 2
        : 1;
      const actionPhrase = translateVerbPhrase(
        actionTokens.slice(actionOffset),
      );

      if (objectPhrase && recipient && actionWord) {
        const sentence =
          actionWord === "give"
            ? buildGiveSentence(
                context.subject,
                recipient,
                objectPhrase,
                actionTokens.some((token) => token.word === "了"),
              )
            : buildVerbSentence(
                context.subject,
                actionWord,
                [objectPhrase, actionPhrase.text, `to ${recipient}`]
                  .filter(Boolean)
                  .join(" "),
                false,
                false,
                false,
                actionPhrase.isPast ||
                  actionTokens.some((token) => token.word === "了"),
                actionPhrase.isExperienced,
                actionPhrase.isOngoing,
              );

        return withSentenceContext(sentence, context.timePhrase);
      }
    }
  }

  const actionIndex = findFirstVerbIndex(context.tail);
  if (actionIndex <= 0) {
    return null;
  }

  const objectPhrase = translatePhrase(
    context.tail.slice(0, actionIndex),
    true,
  );
  const actionTokens = context.tail.slice(actionIndex);
  const resultativeKey = `${actionTokens[0]?.word || ""}${actionTokens[1]?.word || ""}`;
  const actionWord =
    RESULTATIVE_VERB_TRANSLATIONS[resultativeKey] ||
    VERB_TRANSLATIONS[actionTokens[0]?.word || ""];
  const actionOffset = RESULTATIVE_VERB_TRANSLATIONS[resultativeKey] ? 2 : 1;

  if (!actionWord) {
    return null;
  }

  if (actionWord === "give") {
    const recipient = translatePhrase(actionTokens.slice(actionOffset), true);
    return objectPhrase && recipient
      ? withSentenceContext(
          buildGiveSentence(
            context.subject,
            recipient,
            objectPhrase,
            actionTokens.some((token) => token.word === "了"),
          ),
          context.timePhrase,
        )
      : null;
  }

  if (actionWord === "finish" && objectPhrase) {
    return withSentenceContext(
      makeSentence(
        `${context.subject} ${actionTokens.some((token) => token.word === "了") ? "finished" : conjugateVerb(context.subject, "finish")} ${objectPhrase}`,
        false,
      ),
      context.timePhrase,
    );
  }

  const actionPhrase = translateVerbPhrase(actionTokens.slice(actionOffset));
  return withSentenceContext(
    buildVerbSentence(
      context.subject,
      actionWord,
      [objectPhrase, actionPhrase.text].filter(Boolean).join(" "),
      false,
      false,
      false,
      actionPhrase.isPast || actionTokens.some((token) => token.word === "了"),
      actionPhrase.isExperienced,
      actionPhrase.isOngoing,
    ),
    context.timePhrase,
  );
}

function matchBeiRule(context: RuleContext): string | null {
  if (context.head !== "被") {
    return null;
  }

  const actionIndex = findFirstVerbIndex(context.tail);
  if (actionIndex <= 0) {
    return null;
  }

  const agent = translatePhrase(context.tail.slice(0, actionIndex), true);
  const actionPhrase = translateVerbPhrase(context.tail.slice(actionIndex));
  return agent && actionPhrase.text
    ? withSentenceContext(
        buildPassiveSentence(
          context.subject,
          agent,
          actionPhrase.text,
          actionPhrase.isPast || actionPhrase.isExperienced,
        ),
        context.timePhrase,
      )
    : null;
}

function matchGeiRule(context: RuleContext): string | null {
  if (context.head !== "给") {
    return null;
  }

  if (context.tail[0]?.word === "谁") {
    const actionTokens = context.tail.slice(1);
    const actionVerb = VERB_TRANSLATIONS[actionTokens[0]?.word || ""];
    if (actionVerb === "call") {
      return withSentenceContext(
        buildWhQuestion("who", context.subject, "do", "call", "on the phone"),
        context.timePhrase,
      );
    }
    if (actionVerb) {
      return withSentenceContext(
        buildWhQuestion("who", context.subject, "do", actionVerb),
        context.timePhrase,
      );
    }
  }

  const actionIndex = findFirstVerbIndex(context.tail);
  if (actionIndex > 0) {
    const recipient = translatePhrase(context.tail.slice(0, actionIndex), true);
    const actionTokens = context.tail.slice(actionIndex);
    const actionVerb = VERB_TRANSLATIONS[actionTokens[0]?.word || ""];
    const actionPhrase = translateVerbPhrase(actionTokens.slice(1));
    return recipient && actionVerb
      ? withSentenceContext(
          buildVerbSentence(
            context.subject,
            actionVerb,
            `${actionPhrase.text} for ${recipient}`.trim(),
            false,
            false,
            actionPhrase.isVerbPhrase,
            actionPhrase.isPast,
            actionPhrase.isExperienced,
            actionPhrase.isOngoing,
          ),
          context.timePhrase,
        )
      : null;
  }

  const recipient = translatePhrase(context.tail.slice(0, 1), true);
  const objectPhrase = translatePhrase(context.tail.slice(1), true);
  return recipient && objectPhrase
    ? withSentenceContext(
        buildGiveSentence(context.subject, recipient, objectPhrase, false),
        context.timePhrase,
      )
    : null;
}

function matchHenPredicateRule(context: RuleContext): string | null {
  if (context.head !== "很") {
    return null;
  }

  const predicate = translatePhrase(context.tail, false);
  const degreePredicate =
    predicate && /^(very|quite|too|really)\b/i.test(predicate)
      ? predicate
      : predicate
        ? `very ${predicate}`
        : "";

  return degreePredicate
    ? withSentenceContext(
        buildAdjectiveSentence(
          context.subject,
          degreePredicate,
          context.isQuestion,
          context.adverbs,
        ),
        context.timePhrase,
      )
    : null;
}

function matchZaiLocationRule(context: RuleContext): string | null {
  if (context.head !== "在") {
    return null;
  }

  const actionPhrase = translateVerbPhrase(context.tail);
  if (actionPhrase.isVerbPhrase) {
    return withSentenceContext(
      buildProgressiveSentence(
        context.subject,
        actionPhrase.text,
        context.isQuestion,
        false,
        context.adverbs,
      ),
      context.timePhrase,
    );
  }

  const location = translatePhrase(context.tail, false);
  return location
    ? withSentenceContext(
        applyAdverbsToClause(
          buildLocationSentence(
            context.subject,
            location,
            context.isQuestion,
            false,
          ).replace(/[?.!]$/, ""),
          context.subject,
          context.adverbs,
        ) + (context.isQuestion ? "?" : "."),
        context.timePhrase,
      )
    : null;
}

function matchYouHaveRule(context: RuleContext): string | null {
  if (context.head !== "有") {
    return null;
  }

  const objectPhrase = translatePhrase(context.tail, true);
  return objectPhrase
    ? withSentenceContext(
        applyAdverbsToClause(
          buildHaveSentence(
            context.subject,
            objectPhrase,
            context.isQuestion,
            false,
          ).replace(/[?.!]$/, ""),
          context.subject,
          context.adverbs,
        ) + (context.isQuestion ? "?" : "."),
        context.timePhrase,
      )
    : null;
}

function matchBiRule(context: RuleContext): string | null {
  if (context.head !== "比") {
    return null;
  }

  const comparisonTarget = translatePhrase(context.tail.slice(0, 1), true);
  const predicate = translatePhrase(context.tail.slice(1), false);
  return comparisonTarget && predicate
    ? withSentenceContext(
        buildComparisonSentence(
          context.subject,
          comparisonTarget,
          predicate,
          context.adverbs,
        ),
        context.timePhrase,
      )
    : null;
}

function matchNegationRule(context: RuleContext): string | null {
  if (
    context.head !== "不" &&
    context.head !== "没" &&
    context.head !== "没有"
  ) {
    return null;
  }

  const negativeHead = context.tail[0]?.word;
  const negativeTail = context.tail.slice(1);

  if (negativeHead === "是") {
    const predicate = translatePhrase(negativeTail, false);
    return predicate
      ? withSentenceContext(
          buildAdjectiveSentence(
            context.subject,
            `not ${addSimpleArticle(context.subject, predicate)}`,
            false,
            context.adverbs,
          ),
          context.timePhrase,
        )
      : null;
  }

  if (negativeHead === "在") {
    const actionPhrase = translateVerbPhrase(negativeTail);
    if (actionPhrase.isVerbPhrase) {
      return withSentenceContext(
        buildProgressiveSentence(
          context.subject,
          actionPhrase.text,
          false,
          true,
          context.adverbs,
        ),
        context.timePhrase,
      );
    }

    const location = translatePhrase(negativeTail, false);
    return location
      ? withSentenceContext(
          applyAdverbsToClause(
            buildLocationSentence(
              context.subject,
              location,
              false,
              true,
            ).replace(/[?.!]$/, ""),
            context.subject,
            context.adverbs,
          ) + ".",
          context.timePhrase,
        )
      : null;
  }

  if (negativeHead === "有" || context.head === "没有") {
    const objectPhrase = translatePhrase(
      context.head === "没有" ? context.tail : negativeTail,
      true,
    );
    return objectPhrase
      ? withSentenceContext(
          applyAdverbsToClause(
            buildHaveSentence(
              context.subject,
              objectPhrase,
              false,
              true,
            ).replace(/[?.!]$/, ""),
            context.subject,
            context.adverbs,
          ) + ".",
          context.timePhrase,
        )
      : null;
  }

  const negativeVerb = VERB_TRANSLATIONS[negativeHead || ""];
  if (!negativeVerb) {
    return null;
  }

  const objectPhrase = translateVerbPhrase(negativeTail);
  return withSentenceContext(
    applyAdverbsToClause(
      buildVerbSentence(
        context.subject,
        negativeVerb,
        objectPhrase.text,
        false,
        true,
        objectPhrase.isVerbPhrase,
        objectPhrase.isPast,
        objectPhrase.isExperienced,
        objectPhrase.isOngoing,
      ).replace(/[?.!]$/, ""),
      context.subject,
      context.adverbs,
    ) + ".",
    context.timePhrase,
  );
}

function matchVerbRule(context: RuleContext): string | null {
  const verb = VERB_TRANSLATIONS[context.head || ""];
  if (!verb) {
    return null;
  }

  if (
    (verb === "live" || verb === "work") &&
    context.tail[0]?.word === "在" &&
    (context.tail[1]?.word === "哪里" || context.tail[1]?.word === "哪儿")
  ) {
    return withSentenceContext(
      buildWhQuestion("where", context.subject, "do", verb),
      context.timePhrase,
    );
  }

  if (
    verb === "study" &&
    context.head === "学" &&
    context.coreTokens[1]?.word === "为什么"
  ) {
    return withSentenceContext(
      buildWhQuestion(
        "why",
        context.subject,
        "do",
        "study",
        translatePhrase(context.tail, true),
      ),
      context.timePhrase,
    );
  }

  const embeddedQuestionSentence = buildEmbeddedQuestionSentence(
    context.subject,
    verb,
    context.tail,
  );
  if (embeddedQuestionSentence) {
    return withSentenceContext(embeddedQuestionSentence, context.timePhrase);
  }

  const objectPhrase = translateVerbPhrase(context.tail);
  return withSentenceContext(
    applyAdverbsToClause(
      buildVerbSentence(
        context.subject,
        verb,
        objectPhrase.text,
        context.isQuestion,
        false,
        objectPhrase.isVerbPhrase,
        objectPhrase.isPast,
        objectPhrase.isExperienced,
        objectPhrase.isOngoing,
      ).replace(/[?.!]$/, ""),
      context.subject,
      context.adverbs,
    ) + (context.isQuestion ? "?" : "."),
    context.timePhrase,
  );
}

function matchFallbackPredicateRule(context: RuleContext): string | null {
  if (!context.head) {
    return null;
  }

  const predicate = translatePhrase(
    context.coreTokens.slice(1 + context.adverbs.length),
    false,
  );
  return predicate
    ? withSentenceContext(
        buildAdjectiveSentence(
          context.subject,
          predicate,
          context.isQuestion,
          context.adverbs,
        ),
        context.timePhrase,
      )
    : null;
}

const ORDERED_RULES: RuleMatcher[] = [
  matchImperativeRule,
  matchComplementRule,
  matchQuestionWordRule,
  matchShiPredicateRule,
  matchBaRule,
  matchBeiRule,
  matchGeiRule,
  matchHenPredicateRule,
  matchZaiLocationRule,
  matchYouHaveRule,
  matchBiRule,
  matchNegationRule,
  matchVerbRule,
  matchFallbackPredicateRule,
];

const RULE_TRANSLATION_ACCEPTANCE_SCORE = 58;
const FUNCTION_WORDS = new Set<string>([
  "a",
  "an",
  "the",
  "am",
  "are",
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "to",
  "for",
  "by",
  "with",
  "of",
  "in",
  "on",
  "at",
  "from",
  "as",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "that",
  "this",
  "these",
  "those",
  "my",
  "your",
  "his",
  "her",
  "our",
  "their",
  "its",
  "not",
]);
const SUBJECT_WORDS = new Set<string>([
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "it",
  "who",
  "what",
  "where",
  "why",
  "how",
]);
const AUXILIARY_WORDS = new Set<string>([
  "am",
  "are",
  "is",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "can",
  "could",
  "will",
  "would",
  "should",
  "may",
  "might",
  "must",
]);
const IMPERATIVE_STARTERS = new Set<string>([
  "ask",
  "be",
  "bring",
  "call",
  "close",
  "come",
  "do",
  "finish",
  "follow",
  "get",
  "give",
  "go",
  "have",
  "help",
  "keep",
  "learn",
  "listen",
  "look",
  "make",
  "open",
  "put",
  "read",
  "return",
  "say",
  "speak",
  "stand",
  "start",
  "stay",
  "stop",
  "study",
  "take",
  "tell",
  "think",
  "turn",
  "wait",
  "walk",
  "watch",
  "work",
  "write",
]);

function tokenizeEnglishWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
}

function normalizeEnglishForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[/.!?;,:'"()\[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function usefulWordCount(words: string[]): number {
  return words.filter((word) => !FUNCTION_WORDS.has(word)).length;
}

function overlapRatio(leftWords: string[], rightWords: string[]): number {
  const leftSet = new Set(leftWords);
  const rightSet = new Set(rightWords);
  const sharedCount = [...leftSet].filter((word) => rightSet.has(word)).length;
  return sharedCount / Math.max(leftSet.size, rightSet.size, 1);
}

function isLikelyImperative(words: string[]): boolean {
  if (words.length === 0) {
    return false;
  }

  const [firstWord, secondWord] = words;
  if (firstWord === "do" && secondWord === "not") {
    return true;
  }

  return !SUBJECT_WORDS.has(firstWord) && IMPERATIVE_STARTERS.has(firstWord);
}

function hasSubjectVerbShape(words: string[]): boolean {
  if (words.length < 2) {
    return false;
  }

  if (
    ["what", "where", "why", "how", "who"].includes(words[0]) &&
    AUXILIARY_WORDS.has(words[1])
  ) {
    return true;
  }

  return (
    SUBJECT_WORDS.has(words[0]) &&
    words.slice(1, 4).some((word) => AUXILIARY_WORDS.has(word))
  );
}

function hasBrokenPunctuation(text: string): boolean {
  return (
    /\s{2,}/.test(text) ||
    /\s+[,.!?;:]/.test(text) ||
    /[,.!?;:]{2,}/.test(text) ||
    /[,;:](?=[A-Za-z])/g.test(text)
  );
}

function deriveRuleConfidence(score: number): number {
  const clampedScore = Math.max(RULE_TRANSLATION_ACCEPTANCE_SCORE, Math.min(95, score));
  return Number(
    (
      0.55 +
      ((clampedScore - RULE_TRANSLATION_ACCEPTANCE_SCORE) /
        (95 - RULE_TRANSLATION_ACCEPTANCE_SCORE)) *
        0.35
    ).toFixed(2),
  );
}

export function scoreRuleTranslation(
  translation: string,
  literalGloss: string,
): number {
  const trimmedTranslation = translation.trim();
  if (!trimmedTranslation) {
    return 0;
  }

  const translationWords = tokenizeEnglishWords(trimmedTranslation);
  const glossWords = tokenizeEnglishWords(literalGloss);
  const normalizedTranslation = normalizeEnglishForComparison(trimmedTranslation);
  const normalizedGloss = normalizeEnglishForComparison(literalGloss);
  const imperative = isLikelyImperative(translationWords);
  const usefulWords = usefulWordCount(translationWords);

  let score = 50;

  if (/[\u3400-\u9fff]/.test(trimmedTranslation)) {
    score -= 35;
  }
  if (/\//.test(trimmedTranslation)) {
    score -= 16;
  }
  if (normalizedTranslation === normalizedGloss && normalizedTranslation) {
    score -= 32;
  } else if (
    normalizedGloss &&
    overlapRatio(translationWords, glossWords) >= 0.85 &&
    Math.abs(translationWords.length - glossWords.length) <= 1
  ) {
    score -= 18;
  }
  if (/\b(is|are|am|do|does|can|to)\s+\1\b/i.test(trimmedTranslation)) {
    score -= 20;
  }
  if (/^(what is you|where is you|why you|what you)\b/i.test(normalizedTranslation)) {
    score -= 18;
  }
  if (/\b(to|for|by|with|of)\s*[.?!]?$/i.test(trimmedTranslation)) {
    score -= 14;
  }
  if (hasBrokenPunctuation(trimmedTranslation)) {
    score -= 12;
  }
  if (
    /\bclassifier\b|\bvariant of\b|\badverb of degree\b|\bto have\b|\bto be\b/.test(
      normalizedTranslation,
    )
  ) {
    score -= 18;
  }
  if (translationWords.length <= 1) {
    score -= imperative ? 4 : 24;
  } else if (usefulWords < 2 && !imperative) {
    score -= 16;
  }

  // Reward outputs that look like real English clauses or clean imperatives.
  if (hasSubjectVerbShape(translationWords)) {
    score += 16;
  } else if (imperative) {
    score += 12;
  }
  if (!/[\u3400-\u9fff]/.test(trimmedTranslation) && !/\//.test(trimmedTranslation)) {
    score += 8;
  }
  if (!hasBrokenPunctuation(trimmedTranslation)) {
    score += 6;
  }
  if (usefulWords >= 2 || imperative) {
    score += 6;
  }

  return Math.max(0, Math.min(100, score));
}

export function isAcceptableRuleTranslation(
  translation: string,
  literalGloss: string,
): boolean {
  return (
    scoreRuleTranslation(translation, literalGloss) >=
    RULE_TRANSLATION_ACCEPTANCE_SCORE
  );
}

export function buildRuleBasedTranslation(
  wordSegments: WordSegment[],
): string | null {
  const context = buildContext(wordSegments);
  if (!context) {
    return null;
  }

  for (const rule of ORDERED_RULES) {
    const sentence = rule(context);
    if (sentence) {
      return sentence;
    }
  }

  return null;
}

export function parseSentenceStructure(
  wordSegments: WordSegment[],
): ParsedSentenceStructure | null {
  const context = buildContext(wordSegments);
  if (!context) {
    return null;
  }

  return {
    subject: context.subject,
    timePhrase: context.timePhrase,
    head: context.head,
    tail: context.tail.map((token) => token.word),
    adverbs: context.adverbs,
    isQuestion: context.isQuestion,
    tokens: context.tokens.map((token) => token.word),
  };
}

export function buildNaturalTranslation(
  wordSegments: WordSegment[],
  literalGloss: string,
): Omit<TranslationResult, "literalGloss"> {
  const ruleBasedTranslation = buildRuleBasedTranslation(wordSegments);
  const ruleScore = ruleBasedTranslation
    ? scoreRuleTranslation(ruleBasedTranslation, literalGloss)
    : 0;

  if (
    ruleBasedTranslation &&
    isAcceptableRuleTranslation(ruleBasedTranslation, literalGloss)
  ) {

    return {
      translation: ruleBasedTranslation,
      translationSource: "rule",
      confidence: deriveRuleConfidence(ruleScore),
    };
  }

  // Weak rule output is safer to discard than to surface as a confident sentence.
  return {
    translation: literalGloss,
    translationSource: "fallback",
    confidence: 0.42,
  };
}

export function buildTranslationResult(
  wordSegments: WordSegment[],
  literalGloss: string,
): Omit<TranslationResult, "literalGloss"> {
  return buildNaturalTranslation(wordSegments, literalGloss);
}
