import { Suspense } from "react";
import PracticeQuiz from "@/components/PracticeQuiz";
import { Loader2 } from "lucide-react";

export default function PracticeQuizPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted"><Loader2 className="animate-spin text-brand" size={20} />Loading...</div>}>
      <PracticeQuiz library="practice" />
    </Suspense>
  );
}
