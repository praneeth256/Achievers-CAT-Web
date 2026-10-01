import LearnVideoPage from "@/components/LearnVideoPage";
import videoData from "@/lib/videoData";

export default function QuantLearnPage() {
  const modules = videoData["Quantitative Aptitude"] ?? {};
  return (
    <LearnVideoPage
      section="Quantitative Aptitude"
      subtitle="215 concept & practice videos covering Arithmetic, Algebra, Number System and Geometry — sequenced for CAT prep."
      modules={modules}
    />
  );
}
