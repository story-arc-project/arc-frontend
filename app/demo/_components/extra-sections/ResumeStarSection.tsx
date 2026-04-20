import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

interface ResumeStar {
  title: string;
  S: string;
  T: string;
  A: string;
  R: string;
}

interface ResumeStarSectionProps {
  items: ResumeStar[];
  exportHref?: string;
}

const rows = [
  { key: "S" as const, label: "Situation", caption: "상황" },
  { key: "T" as const, label: "Task", caption: "과제" },
  { key: "A" as const, label: "Action", caption: "행동" },
  { key: "R" as const, label: "Result", caption: "결과" },
];

export default function ResumeStarSection({ items, exportHref }: ResumeStarSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title text-text-primary">이력서용 STAR 요약</h2>
        {exportHref && (
          <Link
            href={exportHref}
            className="inline-flex items-center gap-1 text-body-sm text-brand font-medium hover:underline"
          >
            이력서로 보내기 <ArrowRight size={12} aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-brand" aria-hidden="true" />
              <h3 className="text-body text-text-primary font-medium">{item.title}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rows.map(({ key, label, caption }) => (
                <div key={key} className="bg-surface-secondary rounded-md p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-caption font-semibold text-brand-dark">{label}</span>
                    <span className="text-caption text-text-tertiary">· {caption}</span>
                  </div>
                  <p className="text-body-sm text-text-primary leading-relaxed">{item[key]}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
