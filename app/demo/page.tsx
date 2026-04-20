import Link from "next/link";
import {
  PenSquare,
  FolderOpen,
  LayoutDashboard,
  FileSearch,
  Tags,
  Layers,
  FileText,
  ArrowRight,
  GraduationCap,
  Target,
} from "lucide-react";
import { demoPersona } from "./_data/persona";
import { DEMO_RESUME_VERSION_ID } from "./_data/resume";

const screens = [
  {
    href: "/demo/archive/new",
    title: "경험 입력",
    desc: "새 경험을 블록 기반으로 입력하는 화면",
    icon: PenSquare,
  },
  {
    href: "/demo/archive",
    title: "입력된 경험 확인",
    desc: "9개 경험이 담긴 아카이브와 상세 보기",
    icon: FolderOpen,
  },
  {
    href: "/demo/analysis",
    title: "분석 홈",
    desc: "통계 · 최근 분석 · 다음 분석 추천",
    icon: LayoutDashboard,
  },
  {
    href: "/demo/analysis/individual/ind-1",
    title: "개별 분석 결과",
    desc: "오늘의 집 마케팅 인턴 한 건에 대한 심층 분석",
    icon: FileSearch,
  },
  {
    href: "/demo/analysis/keyword/kw-1",
    title: "키워드 분석 결과",
    desc: "'데이터 분석 · 브랜드 기획' 부합도",
    icon: Tags,
  },
  {
    href: "/demo/analysis/comprehensive/comp-1",
    title: "종합 분석 결과",
    desc: "4개 경험을 묶은 커리어 내러티브",
    icon: Layers,
  },
  {
    href: `/demo/export/resume/${DEMO_RESUME_VERSION_ID}`,
    title: "이력서 Export",
    desc: "경험을 기반으로 생성된 이력서 편집기",
    icon: FileText,
  },
];

export default function DemoIndexPage() {
  return (
    <main className="px-4 py-10 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-2">
          <p className="text-label text-brand">ARC Presentation Demo</p>
          <h1 className="text-heading-1 text-text-primary">
            경험을 기록 → 분석 → 이력서로 이어지는 흐름
          </h1>
          <p className="text-body text-text-secondary leading-relaxed">
            실제 ARC 프로덕션 UI 그대로, 한 명의 페르소나 데이터로 각 화면을 연결해 보여줍니다.
          </p>
        </header>

        {/* Persona card */}
        <section className="bg-surface border border-border rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-center">
          <div className="w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center text-heading-3 font-semibold shrink-0">
            {demoPersona.name.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-title text-text-primary">{demoPersona.name}</h2>
              <span className="text-body-sm text-text-tertiary">· {demoPersona.englishName}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-body-sm text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <GraduationCap size={14} className="text-text-tertiary" />
                {demoPersona.school} {demoPersona.department} {demoPersona.year}학년
              </span>
              <span className="inline-flex items-center gap-1">
                <Target size={14} className="text-text-tertiary" />
                지망: {demoPersona.targetRole}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {demoPersona.targetKeywords.map((kw) => (
                <span
                  key={kw}
                  className="bg-surface-brand text-brand-dark rounded-full px-2.5 py-0.5 text-caption font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Screen list */}
        <section className="space-y-3">
          <h2 className="text-title text-text-primary">화면 둘러보기</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {screens.map((s, i) => (
              <Link
                key={s.href}
                href={s.href}
                className="group bg-surface border border-border rounded-lg p-5 hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-surface-brand text-brand-dark text-caption font-semibold">
                    {i + 1}
                  </span>
                  <s.icon size={16} className="text-brand" aria-hidden="true" />
                  <h3 className="text-body text-text-primary font-medium">{s.title}</h3>
                </div>
                <p className="text-body-sm text-text-secondary leading-relaxed">{s.desc}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-caption text-brand font-medium group-hover:gap-2 transition-all">
                  바로 보기 <ArrowRight size={12} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
