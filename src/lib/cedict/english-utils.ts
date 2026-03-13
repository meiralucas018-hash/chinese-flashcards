import {
  AT_LOCATIONS,
  ENGLISH_POSSESSIVES,
  FRONTED_TIME_PHRASES,
  IN_LOCATIONS,
  POSSESSIVE_PRONOUN_TRANSLATIONS,
} from "./constants";

export function isQuestionMarkToken(word: string): boolean {
  return /^[？?]$/.test(word);
}

export function isPunctuationToken(word: string): boolean {
  return /^[，。！？!?、,.]$/.test(word);
}

export function isThirdPersonSingular(subject: string): boolean {
  const normalized = subject.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (["i", "you", "we", "they"].includes(normalized)) {
    return false;
  }

  if (["he", "she", "it", "this", "that"].includes(normalized)) {
    return true;
  }

  if (normalized.includes(" and ")) {
    return false;
  }

  if (/^(these|those)\b/.test(normalized)) {
    return false;
  }

  if (
    /^(two|three|four|five|six|seven|eight|nine|ten|many|several|few)\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const headWord = words[words.length - 1] || normalized;
  if (
    headWord === "people" ||
    headWord === "children" ||
    headWord === "men" ||
    headWord === "women"
  ) {
    return false;
  }

  if (headWord.endsWith("s") && !headWord.endsWith("ss")) {
    return false;
  }

  return true;
}

export function beForm(subject: string): string {
  const normalized = subject.trim().toLowerCase();
  if (normalized === "i") return "am";
  if (!isThirdPersonSingular(normalized)) {
    return "are";
  }

  return "is";
}

export function haveForm(subject: string): string {
  return isThirdPersonSingular(subject) ? "has" : "have";
}

export function doAux(subject: string): string {
  return isThirdPersonSingular(subject) ? "does" : "do";
}

export function wasWereForm(subject: string): string {
  const normalized = subject.trim().toLowerCase();
  if (normalized === "i") {
    return "was";
  }

  if (!isThirdPersonSingular(normalized)) {
    return "were";
  }

  return "was";
}

export function conjugateVerb(subject: string, verb: string): string {
  if (!isThirdPersonSingular(subject)) {
    return verb;
  }

  if (verb === "have") return "has";
  if (verb === "be called") return "is called";
  if (verb === "can" || verb.startsWith("be ") || verb.includes(" ")) {
    return verb;
  }
  if (verb.endsWith("y") && !/[aeiou]y$/i.test(verb)) {
    return `${verb.slice(0, -1)}ies`;
  }
  if (/(s|sh|ch|x|z|o)$/i.test(verb)) {
    return `${verb}es`;
  }

  return `${verb}s`;
}

export function conjugatePredicatePhrase(
  subject: string,
  predicatePhrase: string,
): string {
  const trimmed = predicatePhrase.trim();
  if (!trimmed) {
    return trimmed;
  }

  const [firstWord, ...rest] = trimmed.split(/\s+/);
  const lowerFirstWord = firstWord.toLowerCase();

  if (lowerFirstWord === "be") {
    return [beForm(subject), ...rest].join(" ").trim();
  }

  if (
    lowerFirstWord === "can" ||
    lowerFirstWord === "will" ||
    lowerFirstWord === "would" ||
    lowerFirstWord === "should" ||
    lowerFirstWord === "could" ||
    lowerFirstWord === "may" ||
    lowerFirstWord === "might" ||
    lowerFirstWord === "must"
  ) {
    return trimmed;
  }

  return [conjugateVerb(subject, firstWord), ...rest].join(" ").trim();
}

export function capitalizeSentence(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function lowercaseFirst(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function makeSentence(text: string, isQuestion: boolean): string {
  const trimmed = capitalizeSentence(text.replace(/\s+/g, " ").trim());
  if (!trimmed) {
    return "";
  }

  const withoutPunctuation = trimmed.replace(/[.?!]+$/, "");
  return `${withoutPunctuation}${isQuestion ? "?" : "."}`;
}

export type QuestionAuxiliaryType = "be" | "do" | "modal" | "have";

type QuestionOptions = {
  modal?: string;
  subjectOverride?: string;
  forceBareVerb?: boolean;
};

type EmbeddedClauseParts = {
  subject?: string;
  verb?: string;
  object?: string;
  copulaPredicate?: string;
  modal?: string;
  infinitive?: boolean;
};

function normalizeQuestionWord(whWord: string): string {
  return capitalizeSentence(whWord.trim().toLowerCase() || "what");
}

function normalizedSubject(subject: string, subjectOverride?: string): string {
  return (subjectOverride || subject).trim().toLowerCase() || subject.trim();
}

export function normalizeClauseOrder(text: string): string {
  let normalized = text.replace(/\s+/g, " ").trim();

  normalized = normalized
    .replace(
      /\b(is|are|am|do|does|did|can|could|should|would|will|to)\s+\1\b/gi,
      "$1",
    )
    .replace(/\bwhy do you not\b/gi, "why don't you")
    .replace(/\bwhy does he not\b/gi, "why doesn't he")
    .replace(/\bwhy does she not\b/gi, "why doesn't she")
    .replace(/\bwhy do we not\b/gi, "why don't we")
    .replace(/\b(what|where|why|how)\s+is\s+you\b/gi, "$1 are you")
    .replace(/\b(what|where|why|how)\s+are\s+i\b/gi, "$1 am I")
    .replace(/\b(why|what|where|how)\s+you\b/gi, "$1 do you")
    .replace(/\b(why|what|where|how)\s+do\s+you('re|'ve)\b/gi, "$1 you$2")
    .replace(
      /\b(why|what|where|how)\s+do\s+you\s+(are|were|have|had|can|could|will|would|should|may|might|must)\b/gi,
      "$1 you $2",
    )
    .replace(
      /\bwhat\s+([^\s]+)\s+(do|does|did)\s+([^\s]+)\b/gi,
      "what $2 $3 $1",
    )
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,.;!?])(\S)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

export function stripClassifierGloss(text: string): string {
  return text
    .replace(/\(.*?\)/g, " ")
    .replace(/\bclassifier\b.*$/gi, " ")
    .replace(/\bmeasure word\b.*$/gi, " ")
    .replace(/\bcl:\b.*$/gi, " ")
    .replace(/\badverb of degree\b/gi, " ")
    .replace(/\s+or\s+(him|her|them|us|me)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function replaceStandaloneObject(
  phrase: string,
  objectPhrase: string,
): string {
  const normalizedPhrase = phrase.trim();
  const normalizedObject = objectPhrase.trim();
  if (!normalizedPhrase || !normalizedObject) {
    return normalizedPhrase;
  }

  return normalizedPhrase.replace(/\bit\b/gi, normalizedObject);
}

export function pluralizeEnglishNoun(nounPhrase: string): string {
  const trimmed = nounPhrase.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^piece of\b/i.test(trimmed)) {
    return trimmed.replace(/^piece\b/i, "pieces");
  }

  if (/^period of\b/i.test(trimmed)) {
    return trimmed.replace(/^period\b/i, "periods");
  }

  const parts = trimmed.split(/\s+/);
  const lastWord = parts[parts.length - 1].toLowerCase();
  const irregularPlurals: Record<string, string> = {
    person: "people",
    man: "men",
    woman: "women",
    child: "children",
  };

  let plural = irregularPlurals[lastWord] || "";
  if (!plural) {
    if (/[^aeiou]y$/i.test(lastWord)) {
      plural = `${lastWord.slice(0, -1)}ies`;
    } else if (/(s|sh|ch|x|z)$/i.test(lastWord)) {
      plural = `${lastWord}es`;
    } else {
      plural = `${lastWord}s`;
    }
  }

  parts[parts.length - 1] = plural;
  return parts.join(" ");
}

export function possessivePronounForDeterminer(value: string): string {
  const normalized = value.trim().toLowerCase();
  return POSSESSIVE_PRONOUN_TRANSLATIONS[normalized] || value.trim();
}

export function buildYesNoQuestion(
  subject: string,
  auxiliaryType: QuestionAuxiliaryType,
  predicateOrVerbPhrase: string,
  options?: QuestionOptions,
): string {
  const subjectText = normalizedSubject(subject, options?.subjectOverride);
  const predicate = predicateOrVerbPhrase.trim();

  const clause =
    auxiliaryType === "be"
      ? `${beForm(subject)} ${subjectText} ${predicate}`
      : auxiliaryType === "modal"
        ? `${options?.modal || "can"} ${subjectText} ${predicate}`
        : auxiliaryType === "have"
          ? `${haveForm(subject)} ${subjectText} ${predicate}`
          : `${doAux(subject)} ${subjectText} ${predicate}`;

  return makeSentence(normalizeClauseOrder(clause), true);
}

export function buildWhQuestion(
  whWord: string,
  subject: string,
  auxiliaryType: QuestionAuxiliaryType,
  verb: string,
  objectPhrase?: string,
  options?: QuestionOptions,
): string {
  const wh = normalizeQuestionWord(whWord);
  const subjectText = normalizedSubject(subject, options?.subjectOverride);
  const object = objectPhrase?.trim() || "";
  const verbText = (options?.forceBareVerb ? verb : verb.trim()).trim();

  const tail = [verbText, object].filter(Boolean).join(" ");
  const clause =
    auxiliaryType === "be"
      ? `${wh} ${beForm(subject)} ${subjectText} ${tail}`
      : auxiliaryType === "modal"
        ? `${wh} ${options?.modal || "can"} ${subjectText} ${tail}`
        : auxiliaryType === "have"
          ? `${wh} ${haveForm(subject)} ${subjectText} ${tail}`
          : `${wh} ${doAux(subject)} ${subjectText} ${tail}`;

  return makeSentence(normalizeClauseOrder(clause), true);
}

export function buildEmbeddedWhClause(
  whWord: string,
  clauseParts: EmbeddedClauseParts,
): string {
  const wh = whWord.trim().toLowerCase() || "what";
  const subject = clauseParts.subject?.trim().toLowerCase() || "it";
  const object = clauseParts.object?.trim() || "";
  const verb = clauseParts.verb?.trim() || "";

  let clause = "";
  if (clauseParts.infinitive && verb) {
    clause = `${wh} to ${[verb, object].filter(Boolean).join(" ")}`;
  } else if (clauseParts.copulaPredicate) {
    clause = `${wh} ${subject} ${beForm(subject)} ${clauseParts.copulaPredicate.trim()}`;
  } else if (clauseParts.modal && verb) {
    clause = `${wh} ${subject} ${clauseParts.modal} ${[verb, object].filter(Boolean).join(" ")}`;
  } else if (verb) {
    clause = `${wh} ${subject} ${conjugateVerb(subject, verb)} ${object}`;
  } else {
    clause = `${wh} ${subject}`;
  }

  return normalizeClauseOrder(clause);
}

export function toGerund(verbPhrase: string): string {
  const [firstWord, ...rest] = verbPhrase.trim().split(/\s+/);
  if (!firstWord) {
    return verbPhrase;
  }

  let gerund = firstWord;
  if (firstWord === "be") {
    gerund = "being";
  } else if (firstWord.endsWith("ie")) {
    gerund = `${firstWord.slice(0, -2)}ying`;
  } else if (firstWord.endsWith("e") && firstWord !== "be") {
    gerund = `${firstWord.slice(0, -1)}ing`;
  } else {
    gerund = `${firstWord}ing`;
  }

  return [gerund, ...rest].join(" ");
}

export function sentenceWithoutPunctuation(text: string): string {
  return text.replace(/[.?!]+$/, "").trim();
}

export function appendClauseEnding(clause: string, ending: string): string {
  const baseClause = sentenceWithoutPunctuation(clause);
  const normalizedEnding = ending.trim();
  if (!baseClause || !normalizedEnding) {
    return baseClause;
  }

  const escapedEnding = normalizedEnding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapedEnding}\\b`, "i").test(baseClause)
    ? baseClause
    : `${baseClause} ${normalizedEnding}`.trim();
}

export function buildHaveNotInLongTimeClause(
  subject: string,
  completedPredicate: string,
): string {
  return `${subject} ${haveForm(subject)} not ${completedPredicate.trim()} in a long time`.trim();
}

export function buildDidNotEndUpClause(
  subject: string,
  verbPhrase: string,
): string {
  return `${subject} did not end up ${toGerund(verbPhrase)}`.trim();
}

export function buildDidNotEvenByClause(
  subject: string,
  verbPhrase: string,
  timePhrase: string,
): string {
  const baseClause = `${subject} did not ${verbPhrase}`.trim();
  const normalizedTimePhrase = timePhrase.trim();

  return normalizedTimePhrase
    ? `${baseClause} even by ${normalizedTimePhrase}`
    : baseClause;
}

export function buildEndedUpClause(
  subject: string,
  verbPhrase: string,
): string {
  return `${subject} ended up ${toGerund(verbPhrase)}`.trim();
}

export function buildDidNotUntilClause(
  subject: string,
  verbPhrase: string,
  timePhrase: string,
): string {
  const baseClause = `${subject} did not ${verbPhrase}`.trim();
  const normalizedTimePhrase = timePhrase.trim();

  return normalizedTimePhrase
    ? `${baseClause} until ${normalizedTimePhrase}`
    : baseClause;
}

export function buildPastPerfectClause(
  subject: string,
  predicate: string,
  options?: { negative?: boolean; trailingAdverb?: string },
): string {
  const normalizedPredicate = predicate.trim();
  if (!subject.trim() || !normalizedPredicate) {
    return [subject.trim(), normalizedPredicate]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const core = `${subject} had${options?.negative ? " not" : ""} ${toPastParticiple(normalizedPredicate)}`;
  const trailingAdverb = options?.trailingAdverb?.trim() || "";
  return trailingAdverb ? `${core} ${trailingAdverb}` : core;
}

export function buildModalPerfectClause(
  subject: string,
  modal: "would" | "could",
  predicate: string,
  options?: { already?: boolean; trailingAdverb?: string; timePhrase?: string },
): string {
  const normalizedPredicate = predicate.trim();
  if (!subject.trim() || !normalizedPredicate) {
    return [subject.trim(), `${modal} have`, normalizedPredicate]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  const perfect = `${subject} ${modal} have ${toPastParticiple(normalizedPredicate)}`;
  const withAlready = options?.already ? `${perfect} already` : perfect;
  const trailingAdverb = options?.trailingAdverb?.trim() || "";
  const timed = options?.timePhrase?.trim() || "";

  return [withAlready, trailingAdverb, timed].filter(Boolean).join(" ").trim();
}

export function normalizeProgressiveEnglish(verbPhrase: string): string {
  const normalized = verbPhrase.trim();
  if (!normalized) {
    return normalized;
  }

  return normalized
    .replace(/\beat (?:a |the )?meal\b/gi, "eat")
    .replace(/\bread (?:a |the )?book\b/gi, "read")
    .replace(/\s+/g, " ")
    .trim();
}

export function toPastTense(verbPhrase: string): string {
  const [firstWord, ...rest] = verbPhrase.trim().split(/\s+/);
  if (!firstWord) {
    return verbPhrase;
  }

  const irregularPast: Record<string, string> = {
    go: "went",
    come: "came",
    run: "ran",
    bring: "brought",
    blow: "blew",
    understand: "understood",
    eat: "ate",
    drink: "drank",
    see: "saw",
    know: "knew",
    buy: "bought",
    teach: "taught",
    speak: "spoke",
    break: "broke",
    do: "did",
    have: "had",
    sleep: "slept",
    give: "gave",
    read: "read",
    hear: "heard",
    send: "sent",
    take: "took",
    put: "put",
    get: "got",
    tell: "told",
    forget: "forgot",
    fall: "fell",
  };

  let past = irregularPast[firstWord] || "";
  if (!past) {
    if (firstWord.endsWith("e")) {
      past = `${firstWord}d`;
    } else if (firstWord.endsWith("y") && !/[aeiou]y$/i.test(firstWord)) {
      past = `${firstWord.slice(0, -1)}ied`;
    } else {
      past = `${firstWord}ed`;
    }
  }

  return [past, ...rest].join(" ");
}

export function toPastParticiple(verbPhrase: string): string {
  const [firstWord, ...rest] = verbPhrase.trim().split(/\s+/);
  if (!firstWord) {
    return verbPhrase;
  }

  const irregularParticiples: Record<string, string> = {
    go: "gone",
    come: "come",
    run: "run",
    bring: "brought",
    blow: "blown",
    break: "broken",
    understand: "understood",
    eat: "eaten",
    drink: "drunk",
    see: "seen",
    know: "known",
    buy: "bought",
    teach: "taught",
    speak: "spoken",
    do: "done",
    have: "had",
    sleep: "slept",
    write: "written",
    give: "given",
    read: "read",
    hear: "heard",
    send: "sent",
    take: "taken",
    find: "found",
    put: "put",
    get: "gotten",
    tell: "told",
    forget: "forgotten",
    fall: "fallen",
  };

  const participle = irregularParticiples[firstWord] || toPastTense(firstWord);
  return [participle, ...rest].join(" ");
}

export function possessiveForSubject(subject: string): string {
  return ENGLISH_POSSESSIVES[subject] || `${subject}'s`;
}

export function addSimpleArticle(subject: string, predicate: string): string {
  const normalizedPredicate = predicate.trim();
  if (!normalizedPredicate) {
    return predicate;
  }

  if (
    /^(a|an|the|this|that|these|those|my|your|his|her|its|our|their|not)\b/i.test(
      normalizedPredicate,
    )
  ) {
    return normalizedPredicate;
  }

  if (/\b(s|people|children|men|women)\b/i.test(normalizedPredicate)) {
    return normalizedPredicate;
  }

  const commonCountNouns = new Set([
    "student",
    "teacher",
    "doctor",
    "document",
    "friend",
    "item",
    "message",
    "movie",
    "person",
    "period",
    "piece",
    "book",
    "photo",
    "letter",
    "door",
    "worker",
    "engineer",
    "manager",
    "parent",
    "child",
    "boy",
    "girl",
    "lawyer",
    "nurse",
    "driver",
    "chef",
    "artist",
    "musician",
    "professor",
    "brother",
    "sister",
    "store",
  ]);

  const predicateWords = normalizedPredicate.split(/\s+/);
  const firstWord = predicateWords[0]?.toLowerCase() || "";
  const headWord =
    predicateWords[1]?.toLowerCase() === "of"
      ? firstWord
      : predicateWords[predicateWords.length - 1]?.toLowerCase() || "";
  if (
    subject.toLowerCase() !== "i" &&
    subject.toLowerCase() !== "he" &&
    subject.toLowerCase() !== "she" &&
    subject.toLowerCase() !== "it" &&
    subject.toLowerCase() !== "you"
  ) {
    return normalizedPredicate;
  }

  if (!commonCountNouns.has(headWord)) {
    return normalizedPredicate;
  }

  const article = /^[aeiou]/i.test(firstWord) ? "an" : "a";
  return `${article} ${normalizedPredicate}`;
}

export function formatLocationPhrase(
  locationPhrase: string,
  mode: "static" | "motion" = "static",
): string {
  const normalizedLocation = locationPhrase.trim();
  if (!normalizedLocation) {
    return normalizedLocation;
  }

  if (/^(at|in|on|to|from)\b/i.test(normalizedLocation)) {
    return normalizedLocation;
  }

  const lower = normalizedLocation.toLowerCase();
  if (lower === "home") {
    return mode === "motion" ? "home" : "at home";
  }

  if (mode === "motion") {
    return `to ${normalizedLocation}`;
  }
  if (AT_LOCATIONS.has(lower)) {
    return `at ${normalizedLocation}`;
  }
  if (IN_LOCATIONS.has(lower)) {
    return `in ${normalizedLocation}`;
  }

  return `in ${normalizedLocation}`;
}

export function withSentenceContext(
  sentence: string,
  timePhrase: string,
): string {
  if (!timePhrase) {
    return sentence;
  }

  const punctuation = sentence.match(/[?.!]$/)?.[0] || ".";
  const bareSentence = sentence.replace(/[?.!]$/, "");
  if (FRONTED_TIME_PHRASES.has(timePhrase.toLowerCase())) {
    return `${capitalizeSentence(timePhrase)}, ${lowercaseFirst(bareSentence)}${punctuation}`.replace(
      /, i\b/,
      ", I",
    );
  }

  return `${bareSentence} ${timePhrase}${punctuation}`;
}

export function joinSentenceClauses(
  firstClause: string,
  secondClause: string,
  options?: { linker?: string; punctuation?: "." | "?" },
): string {
  const left = sentenceWithoutPunctuation(firstClause).trim();
  const right = lowercaseFirst(
    sentenceWithoutPunctuation(secondClause).trim(),
  ).replace(/^i\b/, "I");
  if (!left) {
    return makeSentence(right, options?.punctuation === "?");
  }
  if (!right) {
    return makeSentence(left, options?.punctuation === "?");
  }

  return `${left}${options?.linker || ", "}${right}${options?.punctuation || "."}`;
}

export function normalizeLightVerbPhrasing(value: string): string {
  return value
    .replace(
      /\b(do|does|did|speak|speaks|spoke|talk|talks|talked|write|writes|wrote|read|reads|study|studies|studied|work|works|worked|cook|cooks|cooked|learn|learns|learned|learnt)\s+(very|quite|really|too)\s+good\b/gi,
      "$1 $2 well",
    )
    .replace(
      /\b(do|does|did|speak|speaks|spoke|talk|talks|talked|write|writes|wrote|read|reads|study|studies|studied|work|works|worked|cook|cooks|cooked|learn|learns|learned|learnt)\s+good\b/gi,
      "$1 well",
    );
}

function normalizeBasicSubjectVerbAgreement(value: string): string {
  return value
    .replace(/^me\b/i, "I")
    .replace(/\bI is\b/g, "I am")
    .replace(/\bI are\b/g, "I am")
    .replace(/\byou am\b/gi, "you are")
    .replace(/\byou is\b/gi, "you are")
    .replace(/\bwe is\b/gi, "we are")
    .replace(/\bwe am\b/gi, "we are")
    .replace(/\bthey is\b/gi, "they are")
    .replace(/\bthey am\b/gi, "they are")
    .replace(/\b(he|she|it) are\b/gi, "$1 is")
    .replace(/\b(he|she|it) am\b/gi, "$1 is")
    .replace(
      /\b(I|you|he|she|it|we|they)\s+be\s+([^,.!?]+)/gi,
      (match, subject: string, predicate: string) =>
        `${subject} ${beForm(subject)} ${predicate.trim()}`,
    );
}

function normalizeLiteralGlossLeakage(value: string): string {
  const sawSlashGloss = /\//.test(value);
  let result = sawSlashGloss ? value.replace(/\s*\/\s*/g, " ") : value;

  result = result
    .replace(/\bChina student\b/gi, "Chinese student")
    .replace(/\bhome inn\b/gi, "store")
    .replace(/\bsend out news\b/gi, "send a message")
    .replace(/\bpat (?:photograph|photo)\b/gi, "take a photo")
    .replace(/\bpat (?:photographs|photos)\b/gi, "take photos")
    .replace(/\bto give a discount\b/gi, "be on sale")
    .replace(/\bmove motionless\b/gi, "move it")
    .replace(/\bsmall table\b/gi, "items")
    .replace(/\bto expound Buddhist teachings\b/gi, "explain")
    .replace(/\blocal surname [A-Z][a-z]+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return sawSlashGloss
    ? result.replace(/\b(am)\s+the first time\b/gi, "is the first time")
    : result;
}

function normalizeQuestionCleanup(value: string): string {
  return value.replace(/\bcan or not\b/gi, "can you");
}

export function normalizeArticleChoice(value: string): string {
  let result = value.replace(
    /\b(my|your|his|her|its|our|their)\s+one\b/gi,
    (match, determiner: string) =>
      POSSESSIVE_PRONOUN_TRANSLATIONS[determiner.toLowerCase()] || match,
  );

  result = result.replace(
    /\b(a|an)\s+(mine|yours|his|hers|its|ours|theirs)\b/gi,
    "$2",
  );

  return result.replace(
    /\b(I|you|he|she|it|we|they|this|that)\s+(am|are|is|was|were)\s+([^,.!?]+)\b/i,
    (match, subject: string, copula: string, predicate: string) => {
      if (/\bby\b/i.test(predicate)) {
        return `${subject} ${copula} ${predicate}`;
      }

      const normalizedPredicate = addSimpleArticle(subject, predicate);
      return `${subject} ${copula} ${normalizedPredicate}`;
    },
  );
}

export function normalizePronounInsertion(
  value: string,
  subject?: string,
): string {
  const normalizedSubject = subject?.trim();
  if (!normalizedSubject) {
    return value;
  }

  const clauseSubject =
    normalizedSubject.toLowerCase() === "i"
      ? "I"
      : normalizedSubject.toLowerCase();

  return value.replace(
    /\bwhen hearing it\b/gi,
    `when ${clauseSubject} ${conjugateVerb(normalizedSubject, "hear")} it`,
  );
}

export function normalizeRedundantWording(value: string): string {
  return value
    .replace(/\b(very|quite|really|too)\s+well\s+well\b/gi, "$1 well")
    .replace(/\bwell\s+well\b/gi, "well")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuantifiedNounPhrases(value: string): string {
  const quantifiedNounPattern =
    /\b(these|those|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+([a-z-]+?)(?:s)?\s+(book|teacher|student|movie|message|photo|letter|door|worker|engineer|manager|parent|child)\b/gi;

  return value.replace(
    quantifiedNounPattern,
    (match, quantifier: string, modifier: string, noun: string) =>
      `${quantifier} ${modifier} ${pluralizeEnglishNoun(noun)}`,
  );
}

export function normalizeFinalEnglishClause(
  value: string,
  options?: { subject?: string },
): string {
  const punctuation = value.match(/[.?!]+$/)?.[0] || "";
  let result = sentenceWithoutPunctuation(value);

  result = stripClassifierGloss(result);
  result = normalizeLiteralGlossLeakage(result);
  result = normalizeBasicSubjectVerbAgreement(result);
  result = normalizeLightVerbPhrasing(result);
  result = normalizeQuestionCleanup(result);
  result = normalizeArticleChoice(result);
  result = normalizePronounInsertion(result, options?.subject);
  result = normalizeQuantifiedNounPhrases(result);
  result = normalizeRedundantWording(result);
  result = normalizeClauseOrder(result);

  if (!result) {
    return "";
  }

  return `${capitalizeSentence(result)}${punctuation}`;
}

export function smoothFallbackTranslation(value: string): string {
  let result = stripClassifierGloss(value).replace(/\s+/g, " ").trim();

  result = normalizeLiteralGlossLeakage(result);
  result = normalizeBasicSubjectVerbAgreement(result);
  result = normalizeQuestionCleanup(result);

  result = result.replace(
    /\b(I|you|he|she|it)\s+(am|are|is)\s+([^,.!?]+)\b/i,
    (match, subject: string, copula: string, predicate: string) => {
      const updatedPredicate = addSimpleArticle(subject, predicate);
      return `${subject} ${copula} ${updatedPredicate}`;
    },
  );

  return normalizeFinalEnglishClause(
    result.replace(/\s+([,.;!?])/g, "$1").trim(),
  );
}
