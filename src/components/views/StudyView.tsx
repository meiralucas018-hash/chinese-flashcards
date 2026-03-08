import { ChevronLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Flashcard from "@/components/flashcard/Flashcard";
import type { Card as CardType, Rating } from "@/types";

interface StudyViewProps {
  studyQueue: CardType[];
  currentCardIndex: number;
  onEndSession: () => void;
  onRateCard: (
    cardId: string,
    rating: Rating,
    updates: Partial<CardType>,
  ) => void;
  onSpeakChinese: (text: string) => void;
}

export default function StudyView({
  studyQueue,
  currentCardIndex,
  onEndSession,
  onRateCard,
  onSpeakChinese,
}: StudyViewProps) {
  if (studyQueue.length === 0) {
    return (
      <Card className="bg-slate-800/30 border-slate-700">
        <CardContent className="py-12 text-center text-slate-400">
          <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-4">No cards to study right now.</p>
          <p className="text-sm">
            Select a deck from Decks to start a session.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEndSession}
          className="text-slate-300 hover:bg-white/[0.06] hover:text-slate-50"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          End Session
        </Button>
        <div className="text-slate-400 text-sm">
          Card {currentCardIndex + 1} of {studyQueue.length}
        </div>
      </div>
      <Progress
        value={((currentCardIndex + 1) / studyQueue.length) * 100}
        className="h-1 bg-slate-700"
      />
      <Flashcard
        key={studyQueue[currentCardIndex].id}
        card={studyQueue[currentCardIndex]}
        onRate={onRateCard}
        onTTS={onSpeakChinese}
      />
    </div>
  );
}
