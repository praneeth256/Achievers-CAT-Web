import LearnVideoPage from "@/components/LearnVideoPage";
import videoData from "@/lib/videoData";

export default function VarcLearnPage() {
  const modules = videoData["VARC"] ?? {};
  return (
    <LearnVideoPage
      section="VARC"
      subtitle="56 videos covering Verbal Ability, Critical Reasoning, Vocabulary & Etymology, and Reading Comprehension — chapter by chapter."
      modules={modules}
    />
  );
}
