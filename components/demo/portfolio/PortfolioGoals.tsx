import type { DemoGoal } from "@/lib/demo/content";

interface PortfolioGoalsProps {
  goals: DemoGoal[];
  growthJourney: string;
}

export function PortfolioGoals({ goals, growthJourney }: PortfolioGoalsProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="mb-4 text-title text-text-primary">목표 & 성장 여정</h2>
      <div className="flex flex-col gap-4">
        {goals.map((goal) => (
          <div key={goal.timeframe} className="border-l-2 border-brand pl-4">
            <p className="text-caption text-brand">{goal.timeframe}</p>
            <p className="mt-1 text-body text-text-primary">{goal.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-border pt-6">
        <p className="text-body text-text-secondary whitespace-pre-line">{growthJourney}</p>
      </div>
    </div>
  );
}
