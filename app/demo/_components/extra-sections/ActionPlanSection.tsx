import { Clock, Hourglass, CalendarRange } from "lucide-react";

interface ActionPlanSectionProps {
  plan: {
    단기: string;
    중기: string;
    장기: string;
  };
}

const items = [
  { key: "단기" as const, label: "단기", caption: "3개월 이내", Icon: Clock, accent: "text-brand" },
  { key: "중기" as const, label: "중기", caption: "6개월 ~ 1년", Icon: Hourglass, accent: "text-success" },
  { key: "장기" as const, label: "장기", caption: "1년 이상", Icon: CalendarRange, accent: "text-text-secondary" },
];

export default function ActionPlanSection({ plan }: ActionPlanSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-title text-text-primary">액션 플랜</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map(({ key, label, caption, Icon, accent }) => (
          <div key={key} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={accent} aria-hidden="true" />
              <h3 className="text-body text-text-primary font-medium">{label}</h3>
              <span className="text-caption text-text-tertiary ml-auto">{caption}</span>
            </div>
            <p className="text-body-sm text-text-secondary leading-relaxed">{plan[key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
