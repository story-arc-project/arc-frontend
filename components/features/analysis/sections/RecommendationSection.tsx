import type { ActivityRecommendation } from "@/types/analysis";
import ActivityRecommendCard from "../common/ActivityRecommendCard";

interface RecommendationSectionProps {
  title?: string;
  recommendations: ActivityRecommendation[];
}

export default function RecommendationSection({
  title = "다음 활동 추천",
  recommendations,
}: RecommendationSectionProps) {
  if (recommendations.length === 0) return null;

  return (
    <section className="space-y-4">
      <h3 className="text-title text-text-primary">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec) => (
          <ActivityRecommendCard key={rec.id} recommendation={rec} />
        ))}
      </div>
    </section>
  );
}
