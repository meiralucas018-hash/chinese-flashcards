import { useState } from "react";
import { BookOpen, GraduationCap, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Deck } from "@/types";

interface DecksViewProps {
  decks: Deck[];
  deckStatsMap: Record<string, { total: number; due: number; learned: number }>;
  onCreateDeck: (name: string, description: string) => Promise<boolean>;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onStudyDeck: (deckId: string) => void;
  onSelectDeckForCards: (deck: Deck) => void;
}

export default function DecksView({
  decks,
  deckStatsMap,
  onCreateDeck,
  onDeleteDeck,
  onStudyDeck,
  onSelectDeckForCards,
}: DecksViewProps) {
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDescription, setNewDeckDescription] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-semibold text-slate-100">Your Decks</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="border border-blue-500/40 bg-blue-500/20 text-slate-100 hover:bg-blue-500/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Deck
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle>Create New Deck</DialogTitle>
              <DialogDescription>
                Create a new deck to organize your flashcards.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deckName">Deck Name</Label>
                <Input
                  id="deckName"
                  value={newDeckName}
                  onChange={(event) => setNewDeckName(event.target.value)}
                  placeholder="e.g., HSK 1 Vocabulary"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deckDesc">Description (optional)</Label>
                <Input
                  id="deckDesc"
                  value={newDeckDescription}
                  onChange={(event) =>
                    setNewDeckDescription(event.target.value)
                  }
                  placeholder="e.g., Basic HSK level 1 words"
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  const created = await onCreateDeck(
                    newDeckName,
                    newDeckDescription,
                  );
                  if (created) {
                    setNewDeckName("");
                    setNewDeckDescription("");
                    setIsCreateOpen(false);
                  }
                }}
              >
                Create Deck
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {decks.length === 0 ? (
        <Card className="mx-auto max-w-3xl bg-slate-800/30 border-slate-700">
          <CardContent className="py-12 text-center text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No decks yet. Create your first deck to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          {decks.map((deck) => {
            const stats = deckStatsMap[deck.id] || {
              total: 0,
              due: 0,
              learned: 0,
            };

            return (
              <Card
                key={deck.id}
                className="bg-gradient-to-b from-white/5 to-transparent border-slate-700 hover:border-blue-500/50 transition-colors"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-slate-100">
                        {deck.name}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {deck.description || "No description"}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Deck?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes {deck.name} and all of its
                            cards.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => onDeleteDeck(deck.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className="text-blue-400 border-blue-400/50"
                      >
                        {stats.total} cards
                      </Badge>
                      {stats.due > 0 && (
                        <Badge
                          variant="outline"
                          className="text-yellow-400 border-yellow-400/50"
                        >
                          {stats.due} due
                        </Badge>
                      )}
                    </div>
                    {stats.total > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>Progress</span>
                          <span>
                            {Math.round((stats.learned / stats.total) * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={(stats.learned / stats.total) * 100}
                          className="h-1.5 bg-slate-700"
                        />
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => onStudyDeck(deck.id)}
                        disabled={stats.due === 0}
                        className="flex-1 bg-green-500/20 border border-green-500/40 hover:bg-green-500/30 text-green-400 disabled:opacity-50"
                      >
                        <GraduationCap className="w-4 h-4 mr-1" />
                        Study ({stats.due})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectDeckForCards(deck)}
                        className="flex-1 border-slate-600 hover:bg-slate-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Cards
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
