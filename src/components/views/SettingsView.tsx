import type { ChangeEvent } from "react";
import { Download, Settings, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SettingsViewProps {
  deckCount: number;
  cardCount: number;
  learnedCount: number;
  onExport: () => Promise<void>;
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export default function SettingsView({
  deckCount,
  cardCount,
  learnedCount,
  onExport,
  onImport,
}: SettingsViewProps) {
  return (
    <Card className="bg-gradient-to-b from-white/5 to-transparent border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings
        </CardTitle>
        <CardDescription>
          Manage local data and application settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-slate-300">
            Data Management
          </h4>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void onExport()}
              variant="outline"
              className="gap-2 border-slate-600 bg-white/[0.03] text-slate-200 hover:bg-blue-500/12 hover:text-blue-100"
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
                className="gap-2 border-slate-600 bg-white/[0.03] text-slate-200 hover:bg-blue-500/12 hover:text-blue-100"
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

        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-sm font-medium text-slate-300 mb-3">
            Statistics
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-blue-400">{deckCount}</p>
              <p className="text-xs text-slate-400">Decks</p>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-green-400">{cardCount}</p>
              <p className="text-xs text-slate-400">Cards</p>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-purple-400">
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
