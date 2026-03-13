const CHINESE_LANG_PREFERENCES = [
  "zh-CN",
  "zh-TW",
  "zh-Hans",
  "zh-Hant",
] as const;

const VOICE_LOAD_TIMEOUT_MS = 1500;
const POST_CANCEL_SPEAK_DELAY_MS = 150;
const ATTEMPT_TIMEOUT_MS = 10000;
const CHINESE_TTS_UNAVAILABLE_MESSAGE =
  "Chinese TTS is unavailable in this browser/voice configuration. Chrome currently works better for this feature.";

type MaybeVoice = SpeechSynthesisVoice | null;

let activeUtterance: SpeechSynthesisUtterance | null = null;
const badVoiceUris = new Set<string>();

interface BrowserDetails {
  name: "Edge" | "Chrome" | "Other";
  isEdge: boolean;
  isChrome: boolean;
}

interface ResolvedRequestedVoice {
  voice: MaybeVoice;
  requestedBy: "voiceURI" | "voiceName" | "auto";
  skippedRemoteOnline: boolean;
  skippedBadVoiceCache: boolean;
}

interface SpeakAttempt {
  stage:
    | "selected-local-zh"
    | "fallback-local-zh"
    | "browser-default-zh-lang"
    | "lang-only-zh"
    | "single-attempt";
  label: string;
  voice: MaybeVoice;
  lang: string;
  explicitVoiceAssigned: boolean;
  skippedRemoteOnline: boolean;
  skippedBadVoiceCache: boolean;
}

interface AttemptResult {
  ok: boolean;
  errorString: string;
  resolvedVoice: MaybeVoice;
  explicitVoiceAssigned: boolean;
  languageCompatibleSuccess: boolean;
}

export interface SpeakTextOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  voiceURI?: string;
  preferredLang?: string;
  debugSource?: string;
  forceDefaultVoice?: boolean;
  retryOnSynthesisFailure?: boolean;
  isFallbackRetry?: boolean;
}

export interface SpeechSynthesisStatus {
  supported: boolean;
  voicesCount: number;
  speaking: boolean;
  pending: boolean;
  paused: boolean;
}

export interface TtsDiagnosticsSnapshot {
  lastSource: string;
  lastStatus: string;
  lastErrorString: string;
  lastVoiceName: string;
  lastVoiceURI: string;
  originalFailingVoiceName: string;
  originalFailingVoiceURI: string;
  finalVoiceName: string;
  finalVoiceURI: string;
  explicitVoiceAssigned: boolean;
  successfulAttemptExplicitVoiceAssigned: boolean;
  fallbackRetryAttempted: boolean;
  fallbackRetrySucceeded: boolean;
  lang: string;
  text: string;
  textLength: number;
  voicesCount: number;
  browserName: string;
  browserIsEdge: boolean;
  browserIsChrome: boolean;
  chosenVoiceLocalService: boolean | null;
  chosenVoiceDefault: boolean | null;
  chosenVoiceLang: string;
  chosenVoiceName: string;
  chosenVoiceURI: string;
  chosenVoiceSkippedRemoteOnline: boolean;
  chosenVoiceSkippedBadCache: boolean;
  chosenVoiceFromBadCache: boolean;
  selectedVoiceAttempt: string;
  fallbackVoiceAttempt: string;
  finalSuccessfulVoice: string;
  finalFailureReason: string;
  cleanStatusMessage: string;
  skippedNonChineseBrowserDefault: boolean;
  languageCompatibleSuccess: boolean;
}

const DEFAULT_DIAGNOSTICS: TtsDiagnosticsSnapshot = {
  lastSource: "idle",
  lastStatus: "idle",
  lastErrorString: "",
  lastVoiceName: "",
  lastVoiceURI: "",
  originalFailingVoiceName: "",
  originalFailingVoiceURI: "",
  finalVoiceName: "",
  finalVoiceURI: "",
  explicitVoiceAssigned: false,
  successfulAttemptExplicitVoiceAssigned: false,
  fallbackRetryAttempted: false,
  fallbackRetrySucceeded: false,
  lang: "",
  text: "",
  textLength: 0,
  voicesCount: 0,
  browserName: "Other",
  browserIsEdge: false,
  browserIsChrome: false,
  chosenVoiceLocalService: null,
  chosenVoiceDefault: null,
  chosenVoiceLang: "",
  chosenVoiceName: "",
  chosenVoiceURI: "",
  chosenVoiceSkippedRemoteOnline: false,
  chosenVoiceSkippedBadCache: false,
  chosenVoiceFromBadCache: false,
  selectedVoiceAttempt: "",
  fallbackVoiceAttempt: "",
  finalSuccessfulVoice: "",
  finalFailureReason: "",
  cleanStatusMessage: "",
  skippedNonChineseBrowserDefault: false,
  languageCompatibleSuccess: false,
};

let diagnosticsSnapshot: TtsDiagnosticsSnapshot = DEFAULT_DIAGNOSTICS;
const diagnosticsListeners = new Set<
  (snapshot: TtsDiagnosticsSnapshot) => void
>();

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function getBrowserDetails(): BrowserDetails {
  if (typeof navigator === "undefined") {
    return {
      name: "Other",
      isEdge: false,
      isChrome: false,
    };
  }

  const ua = navigator.userAgent;
  const isEdge = ua.includes("Edg/");
  const isChrome = ua.includes("Chrome/") && !isEdge;

  return {
    name: isEdge ? "Edge" : isChrome ? "Chrome" : "Other",
    isEdge,
    isChrome,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function updateDiagnostics(
  patch: Partial<TtsDiagnosticsSnapshot>,
): TtsDiagnosticsSnapshot {
  diagnosticsSnapshot = {
    ...diagnosticsSnapshot,
    ...patch,
  };

  for (const listener of diagnosticsListeners) {
    listener(diagnosticsSnapshot);
  }

  return diagnosticsSnapshot;
}

function setAttemptVoiceDiagnostics(attempt: SpeakAttempt): void {
  updateDiagnostics({
    chosenVoiceLocalService: attempt.voice ? attempt.voice.localService : null,
    chosenVoiceDefault: attempt.voice ? attempt.voice.default : null,
    chosenVoiceLang: attempt.voice?.lang || attempt.lang,
    chosenVoiceName: attempt.voice?.name || "default browser voice",
    chosenVoiceURI: attempt.voice?.voiceURI || "",
    chosenVoiceSkippedRemoteOnline: attempt.skippedRemoteOnline,
    chosenVoiceSkippedBadCache: attempt.skippedBadVoiceCache,
    chosenVoiceFromBadCache: attempt.voice
      ? badVoiceUris.has(attempt.voice.voiceURI)
      : false,
  });
}

function resetAttemptDiagnostics(
  source: string,
  text: string,
  lang: string,
  voicesCount: number,
  browser: BrowserDetails,
): void {
  updateDiagnostics({
    lastSource: source,
    lastStatus: "requested",
    lastErrorString: "",
    lastVoiceName: "",
    lastVoiceURI: "",
    finalVoiceName: "",
    finalVoiceURI: "",
    explicitVoiceAssigned: false,
    successfulAttemptExplicitVoiceAssigned: false,
    fallbackRetryAttempted: false,
    fallbackRetrySucceeded: false,
    lang,
    text,
    textLength: text.length,
    voicesCount,
    browserName: browser.name,
    browserIsEdge: browser.isEdge,
    browserIsChrome: browser.isChrome,
    selectedVoiceAttempt: "",
    fallbackVoiceAttempt: "",
    finalSuccessfulVoice: "",
    finalFailureReason: "",
    cleanStatusMessage: "",
    skippedNonChineseBrowserDefault: false,
    languageCompatibleSuccess: false,
    chosenVoiceLocalService: null,
    chosenVoiceDefault: null,
    chosenVoiceLang: "",
    chosenVoiceName: "",
    chosenVoiceURI: "",
    chosenVoiceSkippedRemoteOnline: false,
    chosenVoiceSkippedBadCache: false,
    chosenVoiceFromBadCache: false,
  });
}

export function getTtsDiagnosticsSnapshot(): TtsDiagnosticsSnapshot {
  return diagnosticsSnapshot;
}

export function subscribeToTtsDiagnostics(
  listener: (snapshot: TtsDiagnosticsSnapshot) => void,
): () => void {
  diagnosticsListeners.add(listener);
  listener(diagnosticsSnapshot);

  return () => {
    diagnosticsListeners.delete(listener);
  };
}

export function isBadVoiceCached(voiceURI: string | undefined | null): boolean {
  return Boolean(voiceURI && badVoiceUris.has(voiceURI));
}

export function clearBadVoiceCache(): void {
  badVoiceUris.clear();
  updateDiagnostics({
    originalFailingVoiceName: "",
    originalFailingVoiceURI: "",
    chosenVoiceFromBadCache: false,
    chosenVoiceSkippedBadCache: false,
  });
}

function getVoiceLabel(voice: MaybeVoice): string {
  if (!voice) {
    return "default browser voice";
  }

  return `${voice.name} (${voice.lang})`;
}

function getResolvedVoiceLabel(voice: MaybeVoice): string {
  return voice?.name || "default browser voice";
}

function isChineseLang(lang: string | undefined): boolean {
  if (!lang) {
    return false;
  }

  return lang.toLowerCase().startsWith("zh");
}

function isChineseVoice(voice: SpeechSynthesisVoice): boolean {
  return isChineseLang(voice.lang);
}

function isOnlineNaturalVoice(voice: SpeechSynthesisVoice): boolean {
  const id = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return id.includes("online") || id.includes("natural");
}

function shouldAvoidEdgeOnlineNaturalVoice(
  voice: SpeechSynthesisVoice,
  browser: BrowserDetails,
): boolean {
  if (!browser.isEdge) {
    return false;
  }

  // Edge frequently reports synthesis-failed for these remote voices.
  return !voice.localService && isOnlineNaturalVoice(voice);
}

export function getSpeechSynthesisStatus(): SpeechSynthesisStatus {
  const synth = getSpeechSynthesis();

  if (!synth) {
    return {
      supported: false,
      voicesCount: 0,
      speaking: false,
      pending: false,
      paused: false,
    };
  }

  return {
    supported: true,
    voicesCount: synth.getVoices().length,
    speaking: synth.speaking,
    pending: synth.pending,
    paused: synth.paused,
  };
}

function languageScore(lang: string, preferredLang?: string): number {
  const normalized = lang.toLowerCase();
  const preferred = preferredLang?.toLowerCase();

  if (preferred && normalized === preferred) {
    return 100;
  }

  if (preferred && normalized.startsWith(preferred)) {
    return 95;
  }

  const preferredFromList = CHINESE_LANG_PREFERENCES.find(
    (item) => item.toLowerCase() === normalized,
  );

  if (preferredFromList) {
    return 90 - CHINESE_LANG_PREFERENCES.indexOf(preferredFromList);
  }

  if (normalized.startsWith("zh")) {
    return 70;
  }

  return 0;
}

function qualityScore(
  voice: SpeechSynthesisVoice,
  browser: BrowserDetails,
): number {
  const id = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = 0;

  if (voice.localService) {
    score += 12;
  }

  if (voice.default) {
    score += 2;
  }

  if (id.includes("google")) {
    score += 2;
  }

  if (
    id.includes("microsoft") ||
    id.includes("xiaoxiao") ||
    id.includes("huihui")
  ) {
    score += 2;
  }

  if (id.includes("female") || id.includes("male")) {
    score += 1;
  }

  if (id.includes("online")) {
    score -= 3;
  }

  if (shouldAvoidEdgeOnlineNaturalVoice(voice, browser)) {
    score -= 25;
  }

  return score;
}

export function getBestChineseVoice(
  voices: SpeechSynthesisVoice[],
  preferredLang?: string,
): MaybeVoice {
  if (!voices.length) {
    return null;
  }

  const browser = getBrowserDetails();
  const chineseVoices = voices.filter(
    (voice) =>
      languageScore(voice.lang, preferredLang) > 0 &&
      !badVoiceUris.has(voice.voiceURI),
  );

  if (!chineseVoices.length) {
    return null;
  }

  return (
    chineseVoices.slice().sort((a, b) => {
      const langDiff =
        languageScore(b.lang, preferredLang) -
        languageScore(a.lang, preferredLang);
      if (langDiff !== 0) {
        return langDiff;
      }

      if (a.localService !== b.localService) {
        return a.localService ? -1 : 1;
      }

      const qualityDiff = qualityScore(b, browser) - qualityScore(a, browser);
      if (qualityDiff !== 0) {
        return qualityDiff;
      }

      return a.name.localeCompare(b.name);
    })[0] ?? null
  );
}

export async function loadSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSpeechSynthesis();
  if (!synth) {
    return [];
  }

  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    return immediate;
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices());
    };

    const onVoicesChanged = () => {
      const available = synth.getVoices();
      if (available.length > 0) {
        finish();
      }
    };

    synth.addEventListener("voiceschanged", onVoicesChanged);
    setTimeout(finish, VOICE_LOAD_TIMEOUT_MS);
  });
}

function resolveRequestedVoice(
  voices: SpeechSynthesisVoice[],
  options: SpeakTextOptions,
  preferredLang: string,
  browser: BrowserDetails,
): ResolvedRequestedVoice {
  let skippedRemoteOnline = false;
  let skippedBadVoiceCache = false;

  if (!voices.length) {
    return {
      voice: null,
      requestedBy: "auto",
      skippedRemoteOnline,
      skippedBadVoiceCache,
    };
  }

  if (options.voiceURI) {
    const byUri = voices.find((voice) => voice.voiceURI === options.voiceURI);
    if (byUri) {
      if (badVoiceUris.has(byUri.voiceURI)) {
        skippedBadVoiceCache = true;
      } else if (shouldAvoidEdgeOnlineNaturalVoice(byUri, browser)) {
        skippedRemoteOnline = true;
      } else {
        return {
          voice: byUri,
          requestedBy: "voiceURI",
          skippedRemoteOnline,
          skippedBadVoiceCache,
        };
      }
    }
  }

  if (options.voiceName) {
    const byName = voices.find((voice) => voice.name === options.voiceName);
    if (byName) {
      if (badVoiceUris.has(byName.voiceURI)) {
        skippedBadVoiceCache = true;
      } else if (shouldAvoidEdgeOnlineNaturalVoice(byName, browser)) {
        skippedRemoteOnline = true;
      } else {
        return {
          voice: byName,
          requestedBy: "voiceName",
          skippedRemoteOnline,
          skippedBadVoiceCache,
        };
      }
    }
  }

  return {
    voice: getBestChineseVoice(voices, preferredLang),
    requestedBy: "auto",
    skippedRemoteOnline,
    skippedBadVoiceCache,
  };
}

function buildChineseAttempts(
  voices: SpeechSynthesisVoice[],
  preferredLang: string,
  requestedVoice: ResolvedRequestedVoice,
  forceDefaultVoice: boolean,
  browser: BrowserDetails,
): {
  attempts: SpeakAttempt[];
  skippedNonChineseBrowserDefault: boolean;
} {
  const attempts: SpeakAttempt[] = [];
  const requested = requestedVoice.voice;
  let skippedNonChineseBrowserDefault = false;

  if (!forceDefaultVoice) {
    if (requested && isChineseVoice(requested) && requested.localService) {
      attempts.push({
        stage: "selected-local-zh",
        label: `Selected Chinese local voice: ${getVoiceLabel(requested)}`,
        voice: requested,
        lang: requested.lang || preferredLang,
        explicitVoiceAssigned: true,
        skippedRemoteOnline: requestedVoice.skippedRemoteOnline,
        skippedBadVoiceCache: requestedVoice.skippedBadVoiceCache,
      });
    }

    const fallbackLocalZh = voices
      .filter(
        (voice) =>
          voice.localService &&
          isChineseVoice(voice) &&
          !badVoiceUris.has(voice.voiceURI) &&
          !shouldAvoidEdgeOnlineNaturalVoice(voice, browser),
      )
      .sort((a, b) => {
        const langDiff =
          languageScore(b.lang, preferredLang) -
          languageScore(a.lang, preferredLang);
        if (langDiff !== 0) {
          return langDiff;
        }
        return a.name.localeCompare(b.name);
      })
      .find((voice) => voice.voiceURI !== requested?.voiceURI);

    if (fallbackLocalZh) {
      attempts.push({
        stage: "fallback-local-zh",
        label: `Fallback local Chinese voice: ${getVoiceLabel(fallbackLocalZh)}`,
        voice: fallbackLocalZh,
        lang: fallbackLocalZh.lang || preferredLang,
        explicitVoiceAssigned: true,
        skippedRemoteOnline: false,
        skippedBadVoiceCache: false,
      });
    }
  }

  const defaultVoice =
    voices.find(
      (voice) =>
        voice.default &&
        !badVoiceUris.has(voice.voiceURI) &&
        !shouldAvoidEdgeOnlineNaturalVoice(voice, browser),
    ) || null;

  if (defaultVoice && isChineseVoice(defaultVoice)) {
    attempts.push({
      stage: "browser-default-zh-lang",
      label: `Browser default zh voice + zh-CN: ${getVoiceLabel(defaultVoice)}`,
      voice: defaultVoice,
      lang: "zh-CN",
      explicitVoiceAssigned: true,
      skippedRemoteOnline: false,
      skippedBadVoiceCache: false,
    });
  } else if (defaultVoice && !isChineseVoice(defaultVoice)) {
    skippedNonChineseBrowserDefault = true;
  }

  attempts.push({
    stage: "lang-only-zh",
    label: "No explicit voice, lang only: zh-CN",
    voice: null,
    lang: "zh-CN",
    explicitVoiceAssigned: false,
    skippedRemoteOnline: false,
    skippedBadVoiceCache: false,
  });

  return {
    attempts,
    skippedNonChineseBrowserDefault,
  };
}

function buildGenericAttempt(
  requestedVoice: ResolvedRequestedVoice,
  lang: string,
  forceDefaultVoice: boolean,
): SpeakAttempt {
  const selected = forceDefaultVoice ? null : requestedVoice.voice;

  return {
    stage: "single-attempt",
    label: selected
      ? `Single attempt with voice: ${getVoiceLabel(selected)}`
      : `Single attempt with browser-managed voice (${lang})`,
    voice: selected,
    lang,
    explicitVoiceAssigned: Boolean(selected),
    skippedRemoteOnline: requestedVoice.skippedRemoteOnline,
    skippedBadVoiceCache: requestedVoice.skippedBadVoiceCache,
  };
}

async function runAttempt(
  synth: SpeechSynthesis,
  text: string,
  options: SpeakTextOptions,
  source: string,
  voicesCount: number,
  attempt: SpeakAttempt,
  isChineseMode: boolean,
): Promise<AttemptResult> {
  synth.cancel();
  await delay(POST_CANCEL_SPEAK_DELAY_MS);

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = attempt.lang;
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;
  const explicitlyAssignedVoice = Boolean(attempt.voice);

  if (explicitlyAssignedVoice && attempt.voice) {
    utterance.voice = attempt.voice;
  }

  setAttemptVoiceDiagnostics(attempt);
  updateDiagnostics({
    lastSource: source,
    lastStatus: `attempt:${attempt.stage}:requested`,
    lastErrorString: "",
    lastVoiceName: attempt.voice?.name || "",
    lastVoiceURI: attempt.voice?.voiceURI || "",
    finalVoiceName: attempt.voice?.name || "",
    finalVoiceURI: attempt.voice?.voiceURI || "",
    explicitVoiceAssigned: explicitlyAssignedVoice,
    successfulAttemptExplicitVoiceAssigned: false,
    fallbackRetryAttempted: attempt.stage !== "selected-local-zh",
    fallbackRetrySucceeded: false,
    lang: utterance.lang,
    text,
    textLength: text.length,
    voicesCount,
  });

  const result = await new Promise<AttemptResult>((resolve) => {
    let settled = false;

    const finish = (value: AttemptResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      resolve(value);
    };

    const timeoutId = window.setTimeout(() => {
      updateDiagnostics({
        lastSource: source,
        lastStatus: `attempt:${attempt.stage}:timeout`,
        lastErrorString: "attempt-timeout",
      });
      finish({
        ok: false,
        errorString: "attempt-timeout",
        resolvedVoice: utterance.voice || attempt.voice,
        explicitVoiceAssigned: explicitlyAssignedVoice,
        languageCompatibleSuccess: false,
      });
    }, ATTEMPT_TIMEOUT_MS);

    utterance.onstart = () => {
      const finalVoice = utterance.voice || attempt.voice;
      updateDiagnostics({
        lastSource: source,
        lastStatus: `attempt:${attempt.stage}:onstart`,
        lastErrorString: "",
        finalVoiceName: getResolvedVoiceLabel(finalVoice),
        finalVoiceURI: finalVoice?.voiceURI || "",
      });
    };

    utterance.onend = () => {
      window.clearTimeout(timeoutId);
      const finalVoice = utterance.voice || attempt.voice;
      const languageCompatibleSuccess =
        !isChineseMode || !finalVoice || isChineseLang(finalVoice?.lang || "");

      updateDiagnostics({
        lastSource: source,
        lastStatus: languageCompatibleSuccess
          ? `attempt:${attempt.stage}:onend`
          : `attempt:${attempt.stage}:language-incompatible`,
        lastErrorString: languageCompatibleSuccess
          ? ""
          : "language-incompatible-voice",
        finalVoiceName: getResolvedVoiceLabel(finalVoice),
        finalVoiceURI: finalVoice?.voiceURI || "",
        explicitVoiceAssigned: explicitlyAssignedVoice,
        successfulAttemptExplicitVoiceAssigned: languageCompatibleSuccess
          ? explicitlyAssignedVoice
          : false,
        languageCompatibleSuccess,
        finalFailureReason: languageCompatibleSuccess
          ? ""
          : "language-incompatible-voice",
      });
      finish({
        ok: languageCompatibleSuccess,
        errorString: languageCompatibleSuccess
          ? ""
          : "language-incompatible-voice",
        resolvedVoice: finalVoice,
        explicitVoiceAssigned: explicitlyAssignedVoice,
        languageCompatibleSuccess,
      });
    };

    utterance.onerror = (event) => {
      window.clearTimeout(timeoutId);
      const primitiveError =
        typeof event.error === "string"
          ? event.error
          : event.error
            ? String(event.error)
            : String(event);
      const failedVoice = utterance.voice || attempt.voice;

      if (
        (primitiveError === "synthesis-failed" ||
          primitiveError === "voice-unavailable") &&
        failedVoice?.voiceURI
      ) {
        badVoiceUris.add(failedVoice.voiceURI);
      }

      updateDiagnostics({
        lastSource: source,
        lastStatus: `attempt:${attempt.stage}:onerror`,
        lastErrorString: primitiveError,
        lastVoiceName: failedVoice?.name || "",
        lastVoiceURI: failedVoice?.voiceURI || "",
        originalFailingVoiceName: failedVoice?.name || "",
        originalFailingVoiceURI: failedVoice?.voiceURI || "",
        explicitVoiceAssigned: explicitlyAssignedVoice,
        successfulAttemptExplicitVoiceAssigned: false,
        fallbackRetryAttempted: true,
        fallbackRetrySucceeded: false,
        finalFailureReason: primitiveError,
        languageCompatibleSuccess: false,
      });
      finish({
        ok: false,
        errorString: primitiveError,
        resolvedVoice: failedVoice,
        explicitVoiceAssigned: explicitlyAssignedVoice,
        languageCompatibleSuccess: false,
      });
    };

    activeUtterance = utterance;

    try {
      synth.speak(utterance);
      updateDiagnostics({
        lastSource: source,
        lastStatus: `attempt:${attempt.stage}:speak-invoked`,
      });
    } catch (error) {
      window.clearTimeout(timeoutId);
      finish({
        ok: false,
        errorString: String(error),
        resolvedVoice: attempt.voice,
        explicitVoiceAssigned: explicitlyAssignedVoice,
        languageCompatibleSuccess: false,
      });
    }
  });

  return result;
}

export function cancelSpeech(): void {
  const synth = getSpeechSynthesis();
  if (!synth) {
    return;
  }

  synth.cancel();
  activeUtterance = null;
}

export async function speakText(
  text: string,
  options: SpeakTextOptions = {},
): Promise<boolean> {
  const synth = getSpeechSynthesis();
  const trimmedText = text.trim();
  const source = options.debugSource || "unknown";
  const browser = getBrowserDetails();

  if (!synth || !trimmedText) {
    updateDiagnostics({
      lastSource: source,
      lastStatus: !synth ? "unsupported" : "empty-text",
      lastErrorString: !synth ? "speechSynthesis unavailable" : "empty text",
      text,
      textLength: trimmedText.length,
      voicesCount: synth?.getVoices().length || 0,
      lang: options.lang || "zh-CN",
      explicitVoiceAssigned: false,
      successfulAttemptExplicitVoiceAssigned: false,
      fallbackRetryAttempted: false,
      fallbackRetrySucceeded: false,
      lastVoiceName: "",
      lastVoiceURI: "",
      finalVoiceName: "",
      finalVoiceURI: "",
      browserName: browser.name,
      browserIsEdge: browser.isEdge,
      browserIsChrome: browser.isChrome,
      finalFailureReason: !synth ? "speechSynthesis unavailable" : "empty text",
      cleanStatusMessage: !synth ? CHINESE_TTS_UNAVAILABLE_MESSAGE : "",
      skippedNonChineseBrowserDefault: false,
      languageCompatibleSuccess: false,
    });
    return false;
  }

  let voices = synth.getVoices();
  if (!voices.length) {
    voices = await loadSpeechVoices();
  }

  const preferredLang = options.preferredLang || options.lang || "zh-CN";
  const requestedVoice = resolveRequestedVoice(
    voices,
    options,
    preferredLang,
    browser,
  );
  const isChineseRequest =
    isChineseLang(options.lang) || isChineseLang(preferredLang);

  resetAttemptDiagnostics(
    source,
    trimmedText,
    preferredLang,
    voices.length,
    browser,
  );

  const chineseAttemptPlan = isChineseRequest
    ? buildChineseAttempts(
        voices,
        preferredLang,
        requestedVoice,
        Boolean(options.forceDefaultVoice),
        browser,
      )
    : null;

  const attempts = chineseAttemptPlan
    ? chineseAttemptPlan.attempts
    : [
        buildGenericAttempt(
          requestedVoice,
          options.lang || preferredLang,
          Boolean(options.forceDefaultVoice),
        ),
      ];

  if (attempts.length > 0) {
    updateDiagnostics({
      selectedVoiceAttempt: attempts[0].label,
      fallbackVoiceAttempt:
        attempts.length > 1
          ? attempts
              .slice(1)
              .map((a) => a.label)
              .join(" | ")
          : "none",
      chosenVoiceSkippedRemoteOnline: requestedVoice.skippedRemoteOnline,
      chosenVoiceSkippedBadCache: requestedVoice.skippedBadVoiceCache,
      chosenVoiceFromBadCache: requestedVoice.voice
        ? badVoiceUris.has(requestedVoice.voice.voiceURI)
        : false,
      skippedNonChineseBrowserDefault: Boolean(
        chineseAttemptPlan?.skippedNonChineseBrowserDefault,
      ),
    });
  }

  let lastError = "";

  // Ordered fallback chain for Chinese avoids looping across broken voices.
  for (const attempt of attempts) {
    const result = await runAttempt(
      synth,
      trimmedText,
      options,
      source,
      voices.length,
      attempt,
      isChineseRequest,
    );

    if (result.ok) {
      const shouldExposeSuccessfulVoice =
        !isChineseRequest ||
        result.languageCompatibleSuccess ||
        !result.explicitVoiceAssigned;

      updateDiagnostics({
        finalVoiceName: getResolvedVoiceLabel(result.resolvedVoice),
        finalVoiceURI: result.resolvedVoice?.voiceURI || "",
        finalSuccessfulVoice: shouldExposeSuccessfulVoice
          ? getVoiceLabel(result.resolvedVoice)
          : "",
        finalFailureReason: "",
        cleanStatusMessage: "",
        fallbackRetryAttempted: attempts.length > 1,
        fallbackRetrySucceeded: attempt.stage !== "selected-local-zh",
        explicitVoiceAssigned: result.explicitVoiceAssigned,
        languageCompatibleSuccess: result.languageCompatibleSuccess,
      });
      return true;
    }

    lastError = result.errorString;
  }

  const finalFailureReason = lastError || "all-fallback-attempts-failed";
  updateDiagnostics({
    lastSource: source,
    lastStatus: "all-attempts-failed",
    lastErrorString: finalFailureReason,
    finalVoiceName: "",
    finalVoiceURI: "",
    finalSuccessfulVoice: "",
    finalFailureReason,
    cleanStatusMessage: isChineseRequest
      ? CHINESE_TTS_UNAVAILABLE_MESSAGE
      : finalFailureReason,
    fallbackRetryAttempted: attempts.length > 1,
    fallbackRetrySucceeded: false,
    languageCompatibleSuccess: false,
  });

  return false;
}
