import { Loader2, Search, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { convertPinyinTones } from "@/lib/pinyin";
import type { SearchResult } from "@/lib/cedict";

interface SearchViewProps {
  query: string;
  isSearching: boolean;
  results: SearchResult | null;
  onQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  onSpeak: (text: string) => void;
}

export default function SearchView({
  query,
  isSearching,
  results,
  onQueryChange,
  onSearch,
  onSpeak,
}: SearchViewProps) {
  return (
    <Card className="app-panel rounded-[28px]">
      <CardHeader>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/75">
          Reference
        </p>
        <CardTitle className="flex items-center gap-2 text-slate-50">
          <Search className="w-5 h-5" />
          Search Characters
        </CardTitle>
        <CardDescription className="text-slate-300">
          Search local CC-CEDICT data for characters and words.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="app-surface rounded-2xl p-4">
          <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Enter Chinese character or word..."
            className="app-field"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void onSearch();
              }
            }}
          />
          <Button
            onClick={() => void onSearch()}
            disabled={isSearching}
            className="app-action-neon"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
        </div>

        {results && (
          <div className="space-y-4 mt-6">
            {results.words.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium text-cyan-200/90">
                  Words
                </h4>
                <div className="grid gap-2">
                  {results.words.map((word) => (
                    <div
                      key={`${word.word}-${word.pinyin}-${word.meaning}`}
                      className="rounded-2xl border border-white/8 bg-slate-950/45 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          className="text-2xl text-cyan-200 hover:scale-105 transition-transform"
                          onClick={() => onSpeak(word.word)}
                        >
                          {word.word}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-200/90">
                            {convertPinyinTones(word.pinyin)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSpeak(word.word)}
                            className="text-slate-300 hover:bg-cyan-300/10 hover:text-cyan-100"
                          >
                            <Volume2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-slate-300 mb-2">
                        {word.meaning || "No meaning available"}
                      </p>
                      {word.chars.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {word.chars.map((charInfo) => (
                            <Badge
                              key={`${word.word}-${charInfo.char}-${charInfo.pinyin}`}
                              variant="outline"
                              className="border-white/10 bg-white/[0.03] text-slate-300"
                            >
                              {charInfo.char} •{" "}
                              {convertPinyinTones(charInfo.pinyin)} •{" "}
                              {charInfo.meaning || "No meaning"}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {results.characters.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium text-cyan-200/90">
                  Characters
                </h4>
                <div className="grid gap-2">
                  {results.characters.map((char) => (
                    <div
                      key={`${char.char}-${char.pinyin}-${char.meaning}`}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/45 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-3xl text-cyan-200 hover:scale-110 transition-transform"
                          onClick={() => onSpeak(char.char)}
                        >
                          {char.char}
                        </button>
                        <div>
                          <p className="text-cyan-200/90">
                            {convertPinyinTones(char.pinyin)}
                          </p>
                          <p className="text-sm text-slate-400">
                            {char.meaning || "No meaning available"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSpeak(char.char)}
                        className="text-slate-300 hover:bg-cyan-300/10 hover:text-cyan-100"
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
