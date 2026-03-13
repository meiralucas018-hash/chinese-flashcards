import { GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Flashcard from "@/components/flashcard/Flashcard";
import type { SpeakTextOptions } from "@/lib/tts";
import type { Card as CardType, QuizPerformanceInput, Rating } from "@/types";

interface StudyViewProps {
  studyQueue: CardType[];
  currentCardIndex: number;
  onEndSession: () => void;
  onRateCard: (
    cardId: string,
    rating: Rating,
    updates: Partial<CardType>,
  ) => void;
  onRecordQuizResult: (
    input: QuizPerformanceInput,
  ) => void | Promise<void>;
  onSpeakChinese: (text: string, options?: Partial<SpeakTextOptions>) => void;
  hasDedicatedChineseVoice: boolean;
}

export default function StudyView({
  studyQueue,
  currentCardIndex,
  onEndSession,
  onRateCard,
  onRecordQuizResult,
  onSpeakChinese,
  hasDedicatedChineseVoice,
}: StudyViewProps) {
  if (studyQueue.length === 0) {
    return (
      <Card className="app-panel-soft rounded-[28px]">
        <CardContent className="py-12 text-center text-slate-400">
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-cyan-200/70" />
          <p className="mb-4 text-base text-slate-200">
            No cards to study right now.
          </p>
          <p className="text-sm">
            Select a deck from Decks to start a session.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Flashcard
        key={studyQueue[currentCardIndex].id}
        card={studyQueue[currentCardIndex]}
        onRate={onRateCard}
        onRecordQuizResult={onRecordQuizResult}
        onTTS={onSpeakChinese}
        hasDedicatedChineseVoice={hasDedicatedChineseVoice}
        sessionProgress={{
          current: currentCardIndex + 1,
          total: studyQueue.length,
        }}
        onExitSession={onEndSession}
      />
    </div>
  );
}
