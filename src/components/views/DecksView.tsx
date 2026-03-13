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
  const totalCards = decks.reduce(
    (sum, deck) => sum + (deckStatsMap[deck.id]?.total || 0),
    0,
  );
  const totalDue = decks.reduce(
    (sum, deck) => sum + (deckStatsMap[deck.id]?.due || 0),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="app-panel mx-auto w-full max-w-5xl rounded-[30px] p-4 sm:p-5">
        <div className="app-surface rounded-[22px] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2.5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
                Deck Library
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-[2rem]">
                Your Decks
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Organize study sets, monitor due cards, and continue review
                from a single calm command center.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge
                variant="outline"
                className="app-chip px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em]"
              >
                {decks.length} {decks.length === 1 ? "Deck" : "Decks"}
              </Badge>
              <Badge
                variant="outline"
                className="app-chip-warm px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em]"
              >
                {totalDue} due
              </Badge>
              <Badge
                variant="outline"
                className="app-chip-neon px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em]"
              >
                {totalCards} cards
              </Badge>
            </div>
          </div>

          <div className="mt-4">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="app-action-neon h-10 px-5">
                  <Plus className="mr-2 h-4 w-4" />
                  New Deck
                </Button>
              </DialogTrigger>
              <DialogContent className="app-panel rounded-[28px] text-slate-100">
                <DialogHeader>
                  <DialogTitle className="text-slate-50">
                    Create New Deck
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a new deck to organize your flashcards.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="deckName" className="text-slate-200">
                      Deck Name
                    </Label>
                    <Input
                      id="deckName"
                      value={newDeckName}
                      onChange={(event) => setNewDeckName(event.target.value)}
                      placeholder="e.g., HSK 1 Vocabulary"
                      className="app-field"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deckDesc" className="text-slate-200">
                      Description (optional)
                    </Label>
                    <Input
                      id="deckDesc"
                      value={newDeckDescription}
                      onChange={(event) =>
                        setNewDeckDescription(event.target.value)
                      }
                      placeholder="e.g., Basic HSK level 1 words"
                      className="app-field"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    className="app-action-neon"
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
        </div>
      </div>

      {decks.length === 0 ? (
        <Card className="app-panel-soft mx-auto max-w-3xl rounded-[28px]">
          <CardContent className="py-12 text-center text-slate-400">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-cyan-200/70" />
            <p className="text-base text-slate-200">
              No decks yet. Create your first deck to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2">
          {decks.map((deck) => {
            const stats = deckStatsMap[deck.id] || {
              total: 0,
              due: 0,
              learned: 0,
            };

            return (
              <Card
                key={deck.id}
                className="app-panel-soft group w-full rounded-[30px] border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/22 hover:shadow-[0_18px_54px_rgba(4,12,20,0.48)]"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <CardTitle className="text-2xl tracking-tight text-slate-100">
                        {deck.name}
                      </CardTitle>
                      <CardDescription className="text-sm leading-6 text-slate-400">
                        {deck.description || "No description"}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-rose-300 hover:bg-rose-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="app-panel rounded-[24px] text-slate-100">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-slate-50">
                            Delete Deck?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            This permanently deletes {deck.name} and all of its
                            cards.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="app-action">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => onDeleteDeck(deck.id)}
                            className="app-action-danger"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="app-surface space-y-4 rounded-2xl p-4">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="app-chip-neon">
                        {stats.total} cards
                      </Badge>
                      {stats.due > 0 && (
                        <Badge variant="outline" className="app-chip-warm">
                          {stats.due} due
                        </Badge>
                      )}
                    </div>
                    {stats.total > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          <span>Progress</span>
                          <span>
                            {Math.round((stats.learned / stats.total) * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={(stats.learned / stats.total) * 100}
                          className="h-1.5 bg-slate-800/90"
                        />
                      </div>
                    )}
                    <div className="grid gap-2 pt-1 sm:grid-cols-2">
                      <Button
                        size="sm"
                        onClick={() => onStudyDeck(deck.id)}
                        disabled={stats.due === 0}
                        className="app-action-neon h-10 w-full disabled:opacity-45"
                      >
                        <GraduationCap className="mr-1 h-4 w-4" />
                        Study ({stats.due})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectDeckForCards(deck)}
                        className="app-action h-10 w-full"
                      >
                        <Plus className="mr-1 h-4 w-4" />
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
