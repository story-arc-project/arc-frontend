"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Plus,
  X,
  FileText,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

import { analyzeExperiences, CATEGORY_LABEL } from "./landing-demo-analysis";
import {
  DEMO_TYPES,
  DEMO_TYPE_MAP,
  canAddExperience,
  collectValues,
  createEmptyDraft,
  hasFilledAdvanced,
  summarizeExperience,
  type DemoDraft,
  type DemoExperience,
  type DemoFieldValue,
  type DemoTypeId,
} from "./landing-demo-fields";
import LandingDemoField from "./LandingDemoField";

type StepKey = "record" | "analyze" | "export";

/* ── Demo data ──────────────────────────────────────────── */
/**
 * 시드 경험 2건. 유형별 필드 정의(`landing-demo-fields.ts`)의 키를 그대로 쓴다 —
 * 첫 화면부터 "유형마다 다른 것을 묻는다"가 카드에도 보여야 한다.
 */
const SEED_EXPERIENCES: DemoExperience[] = [
  {
    id: "seed-1",
    typeId: "internship",
    values: {
      title: "카카오 UX 인턴십",
      period: { start: "2024-07", end: "2024-09" },
      careerWorkType: "풀타임",
      careerOutcome:
        "사용자 인터뷰 6건을 진행하고 결과를 분석해 온보딩 플로우를 재설계했습니다. 디자이너·PM과 협업하며 프로토타입을 빠르게 개선했어요.",
      careerStack: ["Figma", "사용자 인터뷰"],
    },
  },
  {
    id: "seed-2",
    typeId: "award",
    values: {
      title: "앱잼 최우수상",
      awardGrade: "최우수상",
      awardedAt: "2024-03-15",
      awardBackground:
        "팀장으로 5명을 이끌며 아이디어 기획부터 발표까지 주도했습니다. 프론트엔드 개발을 담당하고, 사용자 피드백을 바탕으로 UI를 반복 개선했습니다.",
    },
  },
];

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

  function goToStep(nextKey: StepKey) {
    setStep(nextKey);
  }

  function focusTab(nextKey: StepKey) {
    setStep(nextKey);
    tabRefs.current[nextKey]?.focus();
  }

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
    focusTab(nextKey);
  }

  const [typeId, setTypeId] = useState<DemoTypeId>("internship");
  /**
   * 입력 중인 값. **유형을 바꿔도 비우지 않는다** — 칩을 잘못 눌렀다 되돌리면 적던 값이
   * 살아있는 쪽이 안 놀랍다. 대신 저장 시점에 `collectValues` 가 현재 유형의 키만 골라 담아,
   * 다른 유형에서 적다 만 값이 카드로 따라가지 않게 한다.
   */
  const [draft, setDraft] = useState<DemoDraft>(createEmptyDraft);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeType = DEMO_TYPE_MAP[typeId];
  const canAdd = canAddExperience(typeId, draft);
  const advancedFields = activeType.fields.filter((f) => f.advanced);

  const analysis = useMemo(() => analyzeExperiences(experiences), [experiences]);

  function setField(key: string, next: DemoFieldValue) {
    setDraft((prev) => ({ ...prev, [key]: next }));
  }

  function addExperience() {
    if (!canAdd) return;
    setExperiences((prev) => [
      ...prev,
      {
        id: `demo-${crypto.randomUUID()}`,
        typeId,
        values: collectValues(typeId, draft),
      },
    ]);
    setDraft(createEmptyDraft());
    setShowAdvanced(false);
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
                onClick={() => goToStep(s.key)}
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

        {/* Panels — single AnimatePresence wrapping active panel only */}
        <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
          <AnimatePresence mode="wait">
            {step === "record" && (
              <motion.div
                key="record"
                role="tabpanel"
                id="landing-demo-panel-record"
                aria-labelledby="landing-demo-tab-record"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0"
              >
                {/* Input form */}
                <div className="p-6 border-b md:border-b-0 md:border-r border-border">
                  <p className="text-title text-text-primary mb-3">경험 추가하기</p>

                  {/* Type filter chips — matches FilterBar chip pattern */}
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    {DEMO_TYPES.map((type) => {
                      const Icon = type.icon;
                      const active = typeId === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => {
                            setTypeId(type.id);
                            // 유형이 바뀌면 접힘도 처음 상태로 돌린다 — 볼륨을 묶는 게 접힘의 목적이다.
                            // 단, 그 유형의 접힘 필드를 이미 채워뒀다면 펼친 채로 둔다.
                            // 접으면 렌더에서 빠지는데 값은 카드에 실려, 안 보이는 값이 저장된다.
                            setShowAdvanced(hasFilledAdvanced(type.id, draft));
                          }}
                          aria-pressed={active}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
                            active
                              ? "bg-brand text-text-on-brand"
                              : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary",
                          ].join(" ")}
                        >
                          <Icon size={11} aria-hidden="true" />
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-caption text-text-tertiary mb-4">
                    유형을 고르면 묻는 항목이 달라져요.
                  </p>

                  {/*
                    유형이 바뀌면 필드 구성이 통째로 바뀐다. key 에 typeId 를 섞어 입력칸이
                    유형 사이에서 재사용되지 않게 한다 — 라벨만 갈리고 값이 남으면 엉뚱한
                    칸에 남의 값이 붙어 보인다.
                  */}
                  {activeType.fields
                    .filter((field) => !field.advanced)
                    .map((field) => (
                      <LandingDemoField
                        key={`${typeId}-${field.key}`}
                        field={field}
                        value={draft[field.key]}
                        onChange={(next) => setField(field.key, next)}
                      />
                    ))}

                  {advancedFields.length > 0 && (
                    <div className="mb-4">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((prev) => !prev)}
                        aria-expanded={showAdvanced}
                        className="inline-flex items-center gap-1 text-body-sm font-medium text-brand hover:text-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 rounded"
                      >
                        <ChevronDown
                          size={13}
                          aria-hidden="true"
                          className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                        />
                        {showAdvanced ? "접기" : `＋ 더 자세히 묻기 (${advancedFields.length})`}
                      </button>

                      {showAdvanced && (
                        <div className="mt-3">
                          {advancedFields.map((field) => (
                            <LandingDemoField
                              key={`${typeId}-${field.key}`}
                              field={field}
                              value={draft[field.key]}
                              onChange={(next) => setField(field.key, next)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={addExperience}
                    disabled={!canAdd}
                    className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-text-on-brand text-body-sm font-semibold hover:bg-brand-dark transition-colors disabled:bg-surface-tertiary disabled:text-text-disabled disabled:cursor-not-allowed"
                  >
                    <Plus size={14} aria-hidden="true" />
                    경험 추가
                  </button>
                  <p className="text-caption text-text-tertiary mt-2">
                    입력한 내용은 데모용으로 이 브라우저에만 남아요.
                  </p>
                </div>

                {/* Experience list — matches archive card list pattern */}
                <div className="flex flex-col bg-surface-secondary">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <p className="text-title text-text-primary">기록된 경험</p>
                    <span className="text-caption text-text-tertiary">{experiences.length}개</span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 max-h-[340px]">
                    {experiences.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                        <p className="text-body">경험이 없습니다</p>
                      </div>
                    ) : (
                      <AnimatePresence initial={false}>
                        {experiences.map((exp) => {
                          const meta = DEMO_TYPE_MAP[exp.typeId];
                          const Icon = meta.icon;
                          const card = summarizeExperience(exp);
                          return (
                            <motion.div
                              key={exp.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.2 }}
                              className="group relative bg-surface border border-border rounded-lg p-4 transition-colors hover:border-border-strong"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-none ${meta.tone}`}
                                >
                                  <Icon size={10} aria-hidden="true" />
                                  {meta.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeExperience(exp.id)}
                                  aria-label={`${card.title} 삭제`}
                                  className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                                >
                                  <X size={13} aria-hidden="true" />
                                </button>
                              </div>
                              <p className="text-title text-text-primary line-clamp-1 mb-1">
                                {card.title}
                              </p>
                              <p className="text-body-sm text-text-secondary line-clamp-2 mb-2">
                                {card.summary}
                              </p>
                              {card.chips.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {card.chips.map((chip) => (
                                    <span
                                      key={chip}
                                      className="rounded-full bg-surface-tertiary px-2 py-0.5 text-[12px] leading-none text-text-secondary"
                                    >
                                      {chip}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {card.timeframe && (
                                <p className="text-caption text-text-disabled">{card.timeframe}</p>
                              )}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => goToStep("analyze")}
                      disabled={experiences.length === 0}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand text-brand text-body-sm font-semibold hover:bg-surface-brand transition-colors disabled:border-border disabled:text-text-disabled disabled:cursor-not-allowed"
                    >
                      분석해보기
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "analyze" && (
              <motion.div
                key="analyze"
                role="tabpanel"
                id="landing-demo-panel-analyze"
                aria-labelledby="landing-demo-tab-analyze"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="p-6 space-y-6"
              >
                {/* Stats row — mirrors analysis/page.tsx stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                  <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-surface-secondary text-brand">
                      <FileText size={16} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-heading-3 text-text-primary leading-none">
                        {experiences.length}
                      </p>
                      <p className="text-caption text-text-tertiary mt-1">전체 경험</p>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
                    <div className="p-2 rounded-md bg-surface-secondary text-success">
                      <CheckCircle2 size={16} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-heading-3 text-text-primary leading-none">
                        {experiences.length}
                      </p>
                      <p className="text-caption text-text-tertiary mt-1">분석 완료</p>
                    </div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3 col-span-2 sm:col-span-1">
                    <div className="p-2 rounded-md bg-surface-secondary text-text-secondary">
                      <BarChart2 size={16} aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-heading-3 text-text-primary leading-none">
                        {analysis.top.length}
                      </p>
                      <p className="text-caption text-text-tertiary mt-1">핵심 키워드</p>
                    </div>
                  </div>
                </div>

                {/* Storyline card */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-brand border border-brand/20">
                  <Sparkles size={16} className="text-brand mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-label text-brand-dark mb-1">스토리라인 제안</p>
                    <p className="text-body text-text-primary leading-relaxed">
                      {analysis.storyline}
                    </p>
                  </div>
                </div>

                {/* Keyword bars */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-title text-text-primary">역량 키워드 분포</p>
                    <span className="text-caption text-text-tertiary">
                      입력한 {experiences.length}개 경험 기반
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {analysis.keywords.map((k, i) => (
                      <div key={k.key} className="flex items-center gap-3">
                        <span className="text-caption text-text-secondary w-28 text-right shrink-0">
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
                        <span className="text-caption text-text-tertiary w-8 shrink-0">
                          {k.percent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top keyword chips */}
                {analysis.top.length > 0 && (
                  <div>
                    <p className="text-title text-text-primary mb-2">핵심 키워드</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.top.map((k) => (
                        <span
                          key={k.key}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-body-sm text-text-primary"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                          {k.key}
                          <span className="text-caption text-text-tertiary">
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
                    onClick={() => goToStep("record")}
                    className="text-body-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← 경험 수정하기
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep("export")}
                    className="h-10 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand text-text-on-brand text-body-sm font-semibold hover:bg-brand-dark transition-colors"
                  >
                    이력서로 꺼내기
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === "export" && (
              <motion.div
                key="export"
                role="tabpanel"
                id="landing-demo-panel-export"
                aria-labelledby="landing-demo-tab-export"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="p-6"
              >
                {/* Resume preview — mirrors TrackCard + export page structure */}
                <div className="bg-surface rounded-xl border border-border overflow-hidden">
                  {/* TrackCard-style header chrome */}
                  <div className="px-5 py-3 border-b border-border bg-surface-secondary flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-brand text-brand shrink-0">
                      <FileText size={14} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-text-primary font-medium truncate">
                        이력서 초안
                      </p>
                      <p className="text-caption text-text-secondary truncate">AI 작성 미리보기</p>
                    </div>
                    <span className="text-caption font-medium text-brand bg-surface-brand px-2 py-0.5 rounded-full shrink-0">
                      AI 작성됨
                    </span>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* 자기소개 */}
                    <section>
                      <p className="text-label text-text-tertiary uppercase tracking-wider mb-2">
                        자기소개
                      </p>
                      <p className="text-body-sm text-text-primary leading-relaxed">
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

                    {/* 경력·활동 */}
                    <section>
                      <p className="text-label text-text-tertiary uppercase tracking-wider mb-2">
                        경력 · 활동
                      </p>
                      {experiences.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-surface-secondary p-6 text-center">
                          <p className="text-body-sm text-text-secondary">아직 추가된 활동이 없어요</p>
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {experiences.map((exp) => {
                            const meta = DEMO_TYPE_MAP[exp.typeId];
                            const card = summarizeExperience(exp);
                            return (
                              <li
                                key={exp.id}
                                className="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-brand text-brand">
                                    <meta.icon size={14} aria-hidden="true" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-body-sm text-text-primary font-medium truncate">
                                      {card.title}
                                      <span className="ml-2 text-caption text-text-tertiary font-normal">
                                        {meta.label}
                                      </span>
                                    </p>
                                    <p className="text-caption text-text-secondary line-clamp-2">
                                      {card.summary}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-caption text-text-tertiary shrink-0 sm:ml-auto pl-11 sm:pl-0">
                                  {card.timeframe}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    {/* 역량 키워드 */}
                    <section>
                      <p className="text-label text-text-tertiary uppercase tracking-wider mb-2">
                        역량 키워드
                      </p>
                      {analysis.top.length === 0 ? (
                        <p className="text-body-sm text-text-tertiary">
                          기록이 쌓이면 역량 키워드가 자동으로 추출돼요.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.top.map((k) => (
                            <span
                              key={k.key}
                              className="text-caption font-medium px-2.5 py-1 rounded-full bg-surface-brand text-brand-dark"
                            >
                              {k.key}
                            </span>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                {/* CTA section */}
                <div className="mt-6 p-5 rounded-xl border border-border bg-surface-secondary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-title text-text-primary mb-0.5">
                      실제 분석과 PDF 내보내기는 계정에서 이어집니다.
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      지금까지의 입력은 저장되지 않아요. 무료로 가입하면 바로 이어갈 수 있어요.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => goToStep("record")}
                      className="h-10 px-4 rounded-lg border border-border text-body-sm font-medium text-text-primary hover:bg-surface-tertiary transition-colors"
                    >
                      다시 해보기
                    </button>
                    <Link
                      href="/signup"
                      className="h-10 px-4 inline-flex items-center gap-1.5 rounded-lg bg-brand text-text-on-brand text-body-sm font-semibold hover:bg-brand-dark transition-colors"
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
    </section>
  );
}
