"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Trophy,
  Users,
  BookOpen,
  Sparkles,
  Plus,
  X,
  FileText,
  ArrowRight,
} from "lucide-react";

/* ── Demo types ─────────────────────────────────────────── */
type DemoTypeId = "internship" | "contest" | "club" | "course";

interface DemoExperience {
  id: string;
  typeId: DemoTypeId;
  title: string;
  period: string;
  summary: string;
}

type KeywordKey =
  | "리더십"
  | "협업"
  | "기획"
  | "개발"
  | "디자인"
  | "분석"
  | "커뮤니케이션";

type StepKey = "record" | "analyze" | "export";

/* ── Demo data ──────────────────────────────────────────── */
const TYPE_META: Record<
  DemoTypeId,
  { label: string; icon: typeof Briefcase; tone: string }
> = {
  internship: { label: "인턴십", icon: Briefcase, tone: "bg-surface-brand text-brand-dark" },
  contest: { label: "공모전", icon: Trophy, tone: "bg-surface-success text-success" },
  club: { label: "동아리", icon: Users, tone: "bg-surface-warning text-warning" },
  course: { label: "수업", icon: BookOpen, tone: "bg-surface-tertiary text-text-secondary" },
};

const SEED_EXPERIENCES: DemoExperience[] = [
  {
    id: "seed-1",
    typeId: "internship",
    title: "카카오 UX 인턴십",
    period: "2024.07 — 2024.09",
    summary:
      "사용자 인터뷰 6건을 진행하고 결과를 분석해 온보딩 플로우를 재설계했습니다. 디자이너·PM과 협업하며 프로토타입을 빠르게 개선했어요.",
  },
  {
    id: "seed-2",
    typeId: "contest",
    title: "앱잼 최우수상",
    period: "2024.01 — 2024.03",
    summary:
      "팀장으로 5명을 이끌며 아이디어 기획부터 발표까지 주도했습니다. 프론트엔드 개발을 담당하고, 사용자 피드백을 바탕으로 UI를 반복 개선했습니다.",
  },
];

const KEYWORD_RULES: Record<KeywordKey, string[]> = {
  리더십: ["리더", "팀장", "주도", "이끌", "운영", "총괄", "관리"],
  협업: ["협업", "팀", "함께", "회의", "조율", "커뮤니", "동료"],
  기획: ["기획", "전략", "설계", "로드맵", "아이디어", "브레인", "방향"],
  개발: ["개발", "구현", "코드", "프론트", "백엔드", "앱", "api", "배포"],
  디자인: ["디자인", "ui", "ux", "프로토타입", "와이어프레임", "비주얼"],
  분석: ["분석", "데이터", "리서치", "조사", "인터뷰", "지표", "가설"],
  커뮤니케이션: ["발표", "피드백", "설득", "공유", "문서", "소통"],
};

const KEYWORD_CATEGORY: Record<KeywordKey, "skill" | "work_style"> = {
  리더십: "work_style",
  협업: "work_style",
  기획: "skill",
  개발: "skill",
  디자인: "skill",
  분석: "skill",
  커뮤니케이션: "work_style",
};

const CATEGORY_LABEL: Record<"skill" | "work_style", string> = {
  skill: "직무/스킬",
  work_style: "업무 성향",
};

/* ── Heuristic: derive fake-analysis from text ──────────── */
function analyzeExperiences(exps: DemoExperience[]) {
  const corpus = exps
    .map((e) => `${e.title} ${e.summary}`)
    .join(" ")
    .toLowerCase();

  const scored = (Object.keys(KEYWORD_RULES) as KeywordKey[]).map((key) => {
    const count = KEYWORD_RULES[key].reduce((acc, w) => {
      const regex = new RegExp(w.toLowerCase(), "g");
      const matches = corpus.match(regex);
      return acc + (matches ? matches.length : 0);
    }, 0);
    return { key, count };
  });

  const max = Math.max(1, ...scored.map((s) => s.count));
  const keywords = scored
    .map((s) => ({
      key: s.key,
      percent: Math.min(98, Math.round((s.count / max) * 92) + (s.count ? 6 : 0)),
      category: KEYWORD_CATEGORY[s.key],
      hits: s.count,
    }))
    .sort((a, b) => b.percent - a.percent);

  const top = keywords.filter((k) => k.hits > 0).slice(0, 3);
  const topLabels = top.map((k) => k.key);

  const storyline =
    exps.length === 0
      ? "경험을 2~3개 기록해보면 AI가 이 자리에서 스토리라인을 찾아드려요."
      : top.length === 0
        ? "조금 더 구체적인 활동·역할을 적어주시면 패턴이 또렷해져요."
        : `${exps.length}개의 경험에서 '${topLabels.join(
            " · "
          )}'(이)라는 흐름이 반복되고 있어요. 서로 다른 활동이 하나의 서사로 연결됩니다.`;

  return { keywords, top, storyline };
}

/* ── Step tabs ──────────────────────────────────────────── */
const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: "record", label: "1. 기록", hint: "경험을 남겨요" },
  { key: "analyze", label: "2. 분석", hint: "패턴을 찾아요" },
  { key: "export", label: "3. 익스포트", hint: "서사로 꺼내요" },
];

/* ── Component ──────────────────────────────────────────── */
export default function LandingDemo() {
  const [step, setStep] = useState<StepKey>("record");
  const [experiences, setExperiences] = useState<DemoExperience[]>(SEED_EXPERIENCES);
  const tabRefs = useRef<Record<StepKey, HTMLButtonElement | null>>({
    record: null,
    analyze: null,
    export: null,
  });

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, currentKey: StepKey) {
    const currentIndex = STEPS.findIndex((s) => s.key === currentKey);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % STEPS.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + STEPS.length) % STEPS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = STEPS.length - 1;

    if (nextIndex === null) return;
    e.preventDefault();
    const nextKey = STEPS[nextIndex].key;
    setStep(nextKey);
    tabRefs.current[nextKey]?.focus();
  }

  const [typeId, setTypeId] = useState<DemoTypeId>("internship");
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [summary, setSummary] = useState("");

  const canAdd = title.trim().length > 0 && summary.trim().length > 0;

  const analysis = useMemo(() => analyzeExperiences(experiences), [experiences]);

  function addExperience() {
    if (!canAdd) return;
    setExperiences((prev) => [
      ...prev,
      {
        id: `demo-${crypto.randomUUID()}`,
        typeId,
        title: title.trim(),
        period: period.trim() || "기간 미입력",
        summary: summary.trim(),
      },
    ]);
    setTitle("");
    setPeriod("");
    setSummary("");
  }

  function removeExperience(id: string) {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <section id="demo" className="py-24 px-6 border-t border-border bg-surface-secondary">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <p className="text-[12px] font-bold text-brand uppercase tracking-widest mb-4">
            Live demo
          </p>
          <h2 className="text-[26px] sm:text-[38px] font-bold tracking-[-0.02em] text-text-primary leading-[1.2] mb-4">
            로그인 없이 지금 바로 써보기
          </h2>
          <p className="text-[16px] leading-[1.7] text-text-secondary max-w-xl mx-auto">
            경험을 직접 입력해보고, 분석과 이력서 초안이 어떻게 만들어지는지 미리 확인해보세요.
          </p>
        </div>

        {/* Step tabs */}
        <div
          className="grid grid-cols-3 gap-2 sm:gap-3 mb-6"
          role="tablist"
          aria-label="데모 단계"
        >
          {STEPS.map((s) => {
            const active = step === s.key;
            return (
              <button
                key={s.key}
                id={`landing-demo-tab-${s.key}`}
                ref={(el) => {
                  tabRefs.current[s.key] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`landing-demo-panel-${s.key}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setStep(s.key)}
                onKeyDown={(e) => handleTabKeyDown(e, s.key)}
                className={[
                  "text-left rounded-xl border px-4 py-3 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                  active
                    ? "bg-surface border-brand shadow-sm"
                    : "bg-surface/60 border-border hover:border-border-strong",
                ].join(" ")}
              >
                <span
                  className={`block text-[13px] font-semibold ${
                    active ? "text-brand" : "text-text-secondary"
                  }`}
                >
                  {s.label}
                </span>
                <span className="block text-[12px] text-text-tertiary mt-0.5">
                  {s.hint}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panels */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <div
            role="tabpanel"
            id="landing-demo-panel-record"
            aria-labelledby="landing-demo-tab-record"
            hidden={step !== "record"}
          >
            <AnimatePresence mode="wait">
              {step === "record" && (
              <motion.div
                key="record"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0"
              >
                {/* Input */}
                <div className="p-6 border-b md:border-b-0 md:border-r border-border">
                  <p className="text-[13px] font-semibold text-text-primary mb-3">
                    경험 추가하기
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {(Object.keys(TYPE_META) as DemoTypeId[]).map((id) => {
                      const meta = TYPE_META[id];
                      const Icon = meta.icon;
                      const active = typeId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTypeId(id)}
                          className={[
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
                            active
                              ? "bg-brand text-text-on-brand border-brand"
                              : "bg-surface border-border text-text-secondary hover:border-border-strong",
                          ].join(" ")}
                        >
                          <Icon size={12} aria-hidden="true" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>

                  <label className="block mb-3">
                    <span className="block text-[12px] text-text-secondary mb-1">제목</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="예) 네이버 프론트엔드 인턴십"
                      className="w-full h-10 px-3 rounded-lg border border-border text-[14px] text-text-primary bg-surface placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                    />
                  </label>

                  <label className="block mb-3">
                    <span className="block text-[12px] text-text-secondary mb-1">
                      기간 <span className="text-text-tertiary">(선택)</span>
                    </span>
                    <input
                      type="text"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="예) 2024.07 — 2024.09"
                      className="w-full h-10 px-3 rounded-lg border border-border text-[14px] text-text-primary bg-surface placeholder:text-text-tertiary focus:outline-none focus:border-brand"
                    />
                  </label>

                  <label className="block mb-4">
                    <span className="block text-[12px] text-text-secondary mb-1">
                      역할·성과 요약
                    </span>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={4}
                      placeholder="어떤 역할을 맡았고, 무엇을 얻었나요? 자유롭게 적어주세요."
                      className="w-full px-3 py-2 rounded-lg border border-border text-[14px] text-text-primary bg-surface placeholder:text-text-tertiary focus:outline-none focus:border-brand resize-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={addExperience}
                    disabled={!canAdd}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-text-on-brand text-[13px] font-semibold hover:bg-brand-dark transition-colors disabled:bg-surface-tertiary disabled:text-text-disabled disabled:cursor-not-allowed"
                  >
                    <Plus size={14} aria-hidden="true" />
                    경험 추가
                  </button>
                  <p className="text-[11px] text-text-tertiary mt-2">
                    입력한 내용은 데모용으로 이 브라우저에만 남아요.
                  </p>
                </div>

                {/* List */}
                <div className="p-6 bg-surface-secondary">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-text-primary">
                      기록된 경험
                    </p>
                    <span className="text-[12px] text-text-tertiary">
                      {experiences.length}개
                    </span>
                  </div>

                  {experiences.length === 0 ? (
                    <div className="h-40 rounded-lg border border-dashed border-border flex items-center justify-center">
                      <span className="text-[12px] text-text-tertiary">
                        아직 기록된 경험이 없어요
                      </span>
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-[320px] overflow-auto pr-1">
                      <AnimatePresence initial={false}>
                        {experiences.map((exp) => {
                          const meta = TYPE_META[exp.typeId];
                          const Icon = meta.icon;
                          return (
                            <motion.li
                              key={exp.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.2 }}
                              className="bg-surface border border-border rounded-lg p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.tone}`}
                                    >
                                      <Icon size={10} aria-hidden="true" />
                                      {meta.label}
                                    </span>
                                    <span className="text-[11px] text-text-tertiary truncate">
                                      {exp.period}
                                    </span>
                                  </div>
                                  <p className="text-[13px] font-semibold text-text-primary truncate">
                                    {exp.title}
                                  </p>
                                  <p className="text-[12px] text-text-secondary mt-1 line-clamp-2">
                                    {exp.summary}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeExperience(exp.id)}
                                  aria-label={`${exp.title} 삭제`}
                                  className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => setStep("analyze")}
                    disabled={experiences.length === 0}
                    className="w-full mt-4 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand text-brand text-[13px] font-semibold hover:bg-surface-brand transition-colors disabled:border-border disabled:text-text-disabled disabled:cursor-not-allowed"
                  >
                    분석해보기
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            role="tabpanel"
            id="landing-demo-panel-analyze"
            aria-labelledby="landing-demo-tab-analyze"
            hidden={step !== "analyze"}
          >
            <AnimatePresence mode="wait">
              {step === "analyze" && (
              <motion.div
                key="analyze"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="p-6 space-y-6"
              >
                {/* Summary */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-brand border border-brand/20">
                  <Sparkles size={16} className="text-brand mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[12px] font-semibold text-brand-dark mb-1">
                      스토리라인 제안
                    </p>
                    <p className="text-[14px] text-text-primary leading-relaxed">
                      {analysis.storyline}
                    </p>
                  </div>
                </div>

                {/* Keyword bars */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] font-semibold text-text-primary">
                      역량 키워드 분포
                    </p>
                    <span className="text-[11px] text-text-tertiary">
                      입력한 {experiences.length}개 경험 기반
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {analysis.keywords.map((k, i) => (
                      <div key={k.key} className="flex items-center gap-3">
                        <span className="text-[12px] text-text-secondary w-28 text-right shrink-0">
                          {k.key}
                        </span>
                        <div className="flex-1 h-2.5 bg-surface-tertiary rounded-full overflow-hidden">
                          <motion.div
                            key={`${k.key}-${k.percent}`}
                            className="h-full rounded-full bg-brand"
                            initial={{ width: 0 }}
                            animate={{ width: `${k.percent}%` }}
                            transition={{
                              duration: 0.6,
                              delay: i * 0.05,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-text-tertiary w-8 shrink-0">
                          {k.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top keywords chips */}
                {analysis.top.length > 0 && (
                  <div>
                    <p className="text-[13px] font-semibold text-text-primary mb-2">
                      핵심 키워드
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.top.map((k) => (
                        <span
                          key={k.key}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-[12px] text-text-primary"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                          {k.key}
                          <span className="text-[10px] text-text-tertiary">
                            · {CATEGORY_LABEL[k.category]}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep("record")}
                    className="text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← 경험 수정하기
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("export")}
                    className="h-10 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand text-text-on-brand text-[13px] font-semibold hover:bg-brand-dark transition-colors"
                  >
                    이력서로 꺼내기
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            role="tabpanel"
            id="landing-demo-panel-export"
            aria-labelledby="landing-demo-tab-export"
            hidden={step !== "export"}
          >
            <AnimatePresence mode="wait">
              {step === "export" && (
              <motion.div
                key="export"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="p-6"
              >
                <div className="bg-surface rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-surface-secondary flex items-center gap-2">
                    <FileText size={14} className="text-brand" aria-hidden="true" />
                    <span className="text-[12px] font-semibold text-text-primary">
                      이력서 초안 (미리보기)
                    </span>
                    <span className="ml-auto text-[10px] font-medium text-brand bg-surface-brand px-2 py-0.5 rounded-full">
                      AI 작성됨
                    </span>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Intro */}
                    <section>
                      <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                        자기소개
                      </p>
                      <p className="text-[13px] text-text-primary leading-relaxed">
                        {experiences.length === 0 ? (
                          <span className="text-text-tertiary">
                            경험을 기록하면 자기소개 초안이 이 자리에 생성돼요.
                          </span>
                        ) : analysis.top.length === 0 ? (
                          `${experiences.length}개의 경험을 쌓아온 지원자입니다. 각 경험에서 배운 점을 꾸준히 기록하고 있어요.`
                        ) : (
                          `'${analysis.top
                            .map((t) => t.key)
                            .join(", ")}' 역량을 중심으로 ${experiences.length}개의 경험을 축적해온 지원자입니다. 기록된 활동 간의 연결고리를 바탕으로 자신만의 서사를 만들어갑니다.`
                        )}
                      </p>
                    </section>

                    {/* Activities */}
                    <section>
                      <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                        경력 · 활동
                      </p>
                      {experiences.length === 0 ? (
                        <div className="h-16 rounded-lg border border-dashed border-border flex items-center justify-center">
                          <span className="text-[12px] text-text-tertiary">
                            아직 추가된 활동이 없어요
                          </span>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          {experiences.map((exp) => {
                            const meta = TYPE_META[exp.typeId];
                            return (
                              <li
                                key={exp.id}
                                className="pl-3 border-l-2 border-brand"
                              >
                                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                  <p className="text-[13px] font-semibold text-text-primary">
                                    {exp.title}
                                    <span className="ml-2 text-[11px] font-medium text-text-tertiary">
                                      {meta.label}
                                    </span>
                                  </p>
                                  <span className="text-[11px] text-text-tertiary">
                                    {exp.period}
                                  </span>
                                </div>
                                <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">
                                  {exp.summary}
                                </p>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    {/* Skills */}
                    <section>
                      <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                        역량 키워드
                      </p>
                      {analysis.top.length === 0 ? (
                        <p className="text-[12px] text-text-tertiary">
                          기록이 쌓이면 역량 키워드가 자동으로 추출돼요.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.top.map((k) => (
                            <span
                              key={k.key}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-brand text-brand-dark"
                            >
                              {k.key}
                            </span>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-6 p-5 rounded-xl border border-border bg-surface-secondary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-text-primary mb-0.5">
                      실제 분석과 PDF 내보내기는 계정에서 이어집니다.
                    </p>
                    <p className="text-[12px] text-text-secondary">
                      지금까지의 입력은 저장되지 않아요. 무료로 가입하면 바로 이어갈 수 있어요.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep("record")}
                      className="h-10 px-4 rounded-lg border border-border text-[13px] font-medium text-text-primary hover:bg-surface-tertiary transition-colors"
                    >
                      다시 해보기
                    </button>
                    <Link
                      href="/signup"
                      className="h-10 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand text-text-on-brand text-[13px] font-semibold hover:bg-brand-dark transition-colors"
                    >
                      무료로 이어가기
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
