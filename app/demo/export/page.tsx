import Link from "next/link";
import { FileText, PenLine, IdCard, Trash2 } from "lucide-react";
import { TrackCard } from "@/app/(main)/export/_components/TrackCard";
import { demoResumeListItems, DEMO_RESUME_VERSION_ID } from "../_data/resume";

const languageFlag: Record<string, string> = {
  ko: "🇰🇷",
  en: "🇺🇸",
};

function formatGeneratedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

export default function DemoExportPage() {
  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-heading-2 text-text-primary">익스포트</h1>
          <p className="text-body text-text-secondary mt-1">
            기록한 경험으로 레쥬메와 자기소개서 같은 결과물을 만들어요.
          </p>
        </header>

        <section>
          <h2 className="text-title text-text-primary mb-3">무엇을 만들까요?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TrackCard
              title="레쥬메"
              description="경험을 바탕으로 이력서 초안을 만들어요."
              icon={<FileText size={20} />}
              href={`/demo/export/resume/${DEMO_RESUME_VERSION_ID}`}
              actionLabel="이력서 보기"
            />
            <TrackCard
              title="자기소개서"
              description="성장 스토리를 글로 다듬어요."
              icon={<PenLine size={20} />}
              disabled
              badgeText="Phase 1.5 예정"
            />
            <TrackCard
              title="명함"
              description="나를 한눈에 보여주는 명함을 만들어요."
              icon={<IdCard size={20} />}
              disabled
              badgeText="Phase 1.5 예정"
            />
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-title text-text-primary">최근 만든 레쥬메</h2>
          </div>
          <ul className="flex flex-col gap-2">
            {demoResumeListItems.map((item) => (
              <li key={item.version_id}>
                <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-brand text-brand">
                    <FileText size={16} />
                  </div>
                  <Link
                    href={`/demo/export/resume/${item.version_id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm text-text-primary font-medium truncate">
                          레쥬메 #{item.version_id.slice(0, 8)}
                        </span>
                        <span className="text-caption text-text-tertiary shrink-0">
                          {languageFlag[item.language] ?? ""}
                        </span>
                      </div>
                      <p className="text-caption text-text-secondary truncate">
                        {item.summary_preview ?? "요약 미리보기가 없어요"}
                      </p>
                    </div>
                    <span className="text-caption text-text-tertiary shrink-0 hidden sm:inline">
                      {formatGeneratedAt(item.generated_at)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="text-text-tertiary hover:text-error transition-colors p-1.5 rounded-md"
                    aria-label="레쥬메 삭제"
                    disabled
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
