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
  return normalized === "he" || normalized === "she" || normalized === "it";
}

export function beForm(subject: string): string {
  const normalized = subject.trim().toLowerCase();
  if (normalized === "i") return "am";
  if (normalized === "you" || normalized === "we" || normalized === "they") {
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
  if (normalized === "you" || normalized === "we" || normalized === "they") {
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
    .replace(/\b(what|where|why|how)\s+is\s+you\b/gi, "$1 are you")
    .replace(/\b(what|where|why|how)\s+are\s+i\b/gi, "$1 am I")
    .replace(/\b(why|what|where|how)\s+you\b/gi, "$1 do you")
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
    .replace(/\blanguage\b/gi, " ")
    .replace(/\s+or\s+(him|her|them|us|me)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pluralizeEnglishNoun(nounPhrase: string): string {
  const trimmed = nounPhrase.trim();
  if (!trimmed) {
    return trimmed;
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

export function toPastTense(verbPhrase: string): string {
  const [firstWord, ...rest] = verbPhrase.trim().split(/\s+/);
  if (!firstWord) {
    return verbPhrase;
  }

  const irregularPast: Record<string, string> = {
    go: "went",
    come: "came",
    eat: "ate",
    drink: "drank",
    see: "saw",
    know: "knew",
    buy: "bought",
    teach: "taught",
    speak: "spoke",
    do: "did",
    have: "had",
    sleep: "slept",
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
    take: "taken",
    find: "found",
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
    /^(a|an|the|this|that|these|those|my|your|his|her|its|our|their)\b/i.test(
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
    "friend",
    "person",
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
  ]);

  const firstWord = normalizedPredicate.split(/\s+/)[0]?.toLowerCase() || "";
  if (
    subject.toLowerCase() !== "i" &&
    subject.toLowerCase() !== "he" &&
    subject.toLowerCase() !== "she" &&
    subject.toLowerCase() !== "it" &&
    subject.toLowerCase() !== "you"
  ) {
    return normalizedPredicate;
  }

  if (!commonCountNouns.has(firstWord)) {
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

export function smoothFallbackTranslation(value: string): string {
  let result = value.replace(/\s+/g, " ").trim();

  result = result
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
    .replace(/\b(he|she|it) am\b/gi, "$1 is");

  result = result.replace(
    /\b(I|you|he|she|it)\s+(am|are|is)\s+([^,.!?]+)\b/i,
    (match, subject: string, copula: string, predicate: string) => {
      const updatedPredicate = addSimpleArticle(subject, predicate);
      return `${subject} ${copula} ${updatedPredicate}`;
    },
  );

  return capitalizeSentence(result.replace(/\s+([,.;!?])/g, "$1").trim());
}
