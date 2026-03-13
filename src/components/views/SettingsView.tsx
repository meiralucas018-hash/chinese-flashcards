import { useEffect, useState, type ChangeEvent } from "react";
import { Download, Settings, Upload, Volume2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSpeechSynthesisStatus,
  type SpeakTextOptions,
  type TtsDiagnosticsSnapshot,
} from "@/lib/tts";

type TtsSettingPatch = {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  studyMode?: boolean;
  preferredLang?: string;
};

export interface SettingsViewProps {
  deckCount: number;
  cardCount: number;
  learnedCount: number;
  onExport: () => Promise<void>;
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string;
  selectedVoiceLabel: string;
  selectedVoiceFailed: boolean;
  ttsDiagnostics: TtsDiagnosticsSnapshot;
  playbackRate: number;
  pitch: number;
  volume: number;
  studyMode: boolean;
  preferredLang: string;
  voicesLoaded: boolean;
  hasDedicatedChineseVoice: boolean;
  onTtsSettingChange: (patch: TtsSettingPatch) => void;
  onSpeakTest: (text: string, options?: Partial<SpeakTextOptions>) => void;
  onClearBadVoiceCache: () => void;
}

export default function SettingsView({
  deckCount,
  cardCount,
  learnedCount,
  onExport,
  onImport,
  voices,
  selectedVoiceURI,
  selectedVoiceLabel,
  selectedVoiceFailed,
  ttsDiagnostics,
  playbackRate,
  pitch,
  volume,
  studyMode,
  preferredLang,
  voicesLoaded,
  hasDedicatedChineseVoice,
  onTtsSettingChange,
  onSpeakTest,
  onClearBadVoiceCache,
}: SettingsViewProps) {
  const preferredLanguageOptions = ["zh-CN", "zh-TW", "zh-Hans", "zh-Hant"];
  const [synthStatus, setSynthStatus] = useState(() =>
    getSpeechSynthesisStatus(),
  );

  useEffect(() => {
    const updateStatus = () => {
      setSynthStatus(getSpeechSynthesisStatus());
    };

    updateStatus();
    const timer = window.setInterval(updateStatus, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Card className="app-panel rounded-[28px]">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
          Preferences
        </p>
        <CardTitle className="flex items-center gap-2 text-slate-50">
          <Settings className="w-5 h-5" />
          Settings
        </CardTitle>
        <CardDescription className="text-slate-300">
          Manage local data and application settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="app-surface space-y-4 rounded-2xl p-4">
          <h4 className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Data Management
          </h4>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void onExport()}
              variant="outline"
              className="app-action gap-2"
            >
              <Download className="w-4 h-4" />
              Export Data
            </Button>
            <div>
              <label htmlFor="import-file" className="sr-only">
                Import flashcard data JSON file
              </label>
              <input
                type="file"
                accept=".json"
                onChange={(event) => void onImport(event)}
                className="hidden"
                id="import-file"
                aria-label="Import flashcard data JSON file"
              />
              <Button
                variant="outline"
                className="app-action gap-2"
                onClick={() => document.getElementById("import-file")?.click()}
              >
                <Upload className="w-4 h-4" />
                Import Data
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            All data stays local on this device. Import validates and normalizes
            cards/decks.
          </p>
        </div>

        <div className="border-t border-white/10 pt-4">
          <Accordion type="single" collapsible>
            <AccordionItem
              value="advanced-settings"
              className="app-surface rounded-2xl px-4"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-200">
                    Advanced settings
                  </p>
                  <p className="text-xs text-slate-500">
                    Chinese TTS voice, language, playback tuning, and
                    diagnostics.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Preferred language
                    </p>
                    <Select
                      value={preferredLang}
                      onValueChange={(value) =>
                        onTtsSettingChange({ preferredLang: value })
                      }
                    >
                      <SelectTrigger className="app-field w-full">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {preferredLanguageOptions.map((lang) => (
                          <SelectItem key={lang} value={lang}>
                            {lang}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Voice
                    </p>
                    <Select
                      value={selectedVoiceURI || "auto"}
                      onValueChange={(value) =>
                        onTtsSettingChange({
                          voiceURI: value === "auto" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger className="app-field w-full">
                        <SelectValue placeholder="Auto-select Chinese voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          Auto-select Chinese voice
                        </SelectItem>
                        {voices.map((voice) => (
                          <SelectItem
                            key={voice.voiceURI}
                            value={voice.voiceURI}
                          >
                            {voice.name} ({voice.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Speed</span>
                      <span>{playbackRate.toFixed(2)}x</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={[playbackRate]}
                      onValueChange={(value) =>
                        onTtsSettingChange({ rate: value[0] ?? playbackRate })
                      }
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Pitch</span>
                      <span>{pitch.toFixed(2)}</span>
                    </div>
                    <Slider
                      min={0.5}
                      max={1.5}
                      step={0.05}
                      value={[pitch]}
                      onValueChange={(value) =>
                        onTtsSettingChange({ pitch: value[0] ?? pitch })
                      }
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Volume</span>
                      <span>{volume.toFixed(2)}</span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={[volume]}
                      onValueChange={(value) =>
                        onTtsSettingChange({ volume: value[0] ?? volume })
                      }
                    />
                  </div>
                </div>

                <div className="app-surface flex items-center justify-between rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm text-slate-200">Study mode</p>
                    <p className="text-xs text-slate-500">
                      Plays slightly slower for clearer listening.
                    </p>
                  </div>
                  <Switch
                    checked={studyMode}
                    onCheckedChange={(checked) =>
                      onTtsSettingChange({ studyMode: checked })
                    }
                  />
                </div>

                <div className="app-surface rounded-xl p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Runtime Test Modes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="app-action gap-2"
                      onClick={() =>
                        onSpeakTest("你好", {
                          debugSource: "settings-test-selected-voice",
                        })
                      }
                    >
                      <Volume2 className="h-4 w-4" />
                      Test with selected voice
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="app-action gap-2"
                      onClick={() =>
                        onSpeakTest("你好", {
                          debugSource: "settings-test-auto-chinese-voice",
                          voiceURI: undefined,
                          voiceName: undefined,
                        })
                      }
                    >
                      <Volume2 className="h-4 w-4" />
                      Test with auto-picked Chinese voice
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="app-action-neon gap-2"
                      onClick={() =>
                        onSpeakTest("你好", {
                          debugSource: "settings-test-browser-default-voice",
                          forceDefaultVoice: true,
                          voiceURI: undefined,
                          voiceName: undefined,
                          lang: "zh-CN",
                        })
                      }
                    >
                      <Volume2 className="h-4 w-4" />
                      Test with browser default voice
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    All three buttons speak the same text: 你好
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {voicesLoaded
                      ? `${voices.length} system voices detected.`
                      : "Loading system voices..."}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="app-action"
                      onClick={onClearBadVoiceCache}
                    >
                      Clear bad voice cache
                    </Button>
                    <p className="text-xs text-slate-500">
                      Clears session-only failed voice entries.
                    </p>
                  </div>
                  {!hasDedicatedChineseVoice && (
                    <p className="mt-1 text-xs text-amber-300/90">
                      No dedicated Chinese voice was detected. Playback still
                      works with zh-CN, but installing a Chinese system voice
                      usually sounds better.
                    </p>
                  )}
                  {(selectedVoiceFailed ||
                    ttsDiagnostics.originalFailingVoiceName) && (
                    <p className="mt-2 text-xs text-amber-300/90">
                      Selected voice failed. Fallback/default voice was used.
                    </p>
                  )}
                  {ttsDiagnostics.cleanStatusMessage && (
                    <p className="mt-2 text-xs text-amber-200/95">
                      {ttsDiagnostics.cleanStatusMessage}
                    </p>
                  )}
                </div>

                <div className="app-surface rounded-xl p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Diagnostics
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                      <div className="app-field rounded-xl px-3 py-2">
                      Voices loaded: {synthStatus.voicesCount}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Selected voice: {selectedVoiceLabel}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Chinese voice found:{" "}
                      {hasDedicatedChineseVoice ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Supported: {synthStatus.supported ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      speaking: {synthStatus.speaking ? "true" : "false"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      pending: {synthStatus.pending ? "true" : "false"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      paused: {synthStatus.paused ? "true" : "false"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Selected voice URI: {selectedVoiceURI || "auto"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Browser: {ttsDiagnostics.browserName || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Browser is Edge:{" "}
                      {ttsDiagnostics.browserIsEdge ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Browser is Chrome:{" "}
                      {ttsDiagnostics.browserIsChrome ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Skipped non-Chinese browser default:{" "}
                      {ttsDiagnostics.skippedNonChineseBrowserDefault
                        ? "yes"
                        : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last source: {ttsDiagnostics.lastSource || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last status: {ttsDiagnostics.lastStatus || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last error: {ttsDiagnostics.lastErrorString || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last voice name: {ttsDiagnostics.lastVoiceName || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last voice URI: {ttsDiagnostics.lastVoiceURI || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Original failing voice:{" "}
                      {ttsDiagnostics.originalFailingVoiceName || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Final voice used: {ttsDiagnostics.finalVoiceName || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Chosen voice localService:{" "}
                      {String(ttsDiagnostics.chosenVoiceLocalService)}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Chosen voice default:{" "}
                      {String(ttsDiagnostics.chosenVoiceDefault)}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Chosen voice lang: {ttsDiagnostics.chosenVoiceLang || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Chosen voice name: {ttsDiagnostics.chosenVoiceName || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Chosen voice URI: {ttsDiagnostics.chosenVoiceURI || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Skipped for remote/online:{" "}
                      {ttsDiagnostics.chosenVoiceSkippedRemoteOnline
                        ? "yes"
                        : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Skipped for bad voice cache:{" "}
                      {ttsDiagnostics.chosenVoiceSkippedBadCache ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Came from bad voice cache:{" "}
                      {ttsDiagnostics.chosenVoiceFromBadCache ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Explicit voice assigned:{" "}
                      {ttsDiagnostics.explicitVoiceAssigned ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Successful attempt explicit voice:{" "}
                      {ttsDiagnostics.successfulAttemptExplicitVoiceAssigned
                        ? "yes"
                        : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Language-compatible success:{" "}
                      {ttsDiagnostics.languageCompatibleSuccess ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Fallback retry attempted:{" "}
                      {ttsDiagnostics.fallbackRetryAttempted ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Fallback retry succeeded:{" "}
                      {ttsDiagnostics.fallbackRetrySucceeded ? "yes" : "no"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Selected voice attempt:{" "}
                      {ttsDiagnostics.selectedVoiceAttempt || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Fallback voice attempt:{" "}
                      {ttsDiagnostics.fallbackVoiceAttempt || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Final successful voice:{" "}
                      {ttsDiagnostics.finalSuccessfulVoice || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Final failure reason:{" "}
                      {ttsDiagnostics.finalFailureReason || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last lang: {ttsDiagnostics.lang || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last text: {ttsDiagnostics.text || "-"}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last text length: {ttsDiagnostics.textLength}
                    </div>
                      <div className="app-field rounded-xl px-3 py-2">
                      Last voices count: {ttsDiagnostics.voicesCount}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="border-t border-white/10 pt-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Statistics
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="app-surface rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-cyan-300">{deckCount}</p>
              <p className="text-xs text-slate-400">Decks</p>
            </div>
            <div className="app-surface rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{cardCount}</p>
              <p className="text-xs text-slate-400">Cards</p>
            </div>
            <div className="app-surface rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-cyan-200">
                {learnedCount}
              </p>
              <p className="text-xs text-slate-400">Learned</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
