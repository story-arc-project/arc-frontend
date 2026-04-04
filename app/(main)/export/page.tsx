"use client";

import { useState } from "react";
import { FileText, PenLine, Lock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button, Badge } from "@/components/ui";

type Tab = "resume" | "cover";

const EXPERIENCES = [
  { id: "1", title: "UX 리서치 인턴십", type: "인턴", date: "2024.07 – 2024.08" },
  { id: "2", title: "캡스톤 디자인 프로젝트", type: "프로젝트", date: "2024.03 – 2024.06" },
  { id: "3", title: "교내 창업 경진대회 금상", type: "수상", date: "2023.11" },
  { id: "4", title: "데이터 분석 대외활동", type: "대외활동", date: "2023.09" },
  { id: "5", title: "SQLD 자격증 취득", type: "자격증", date: "2023.06" },
];

const COVER_PROMPTS = [
  "성장 과정 및 지원 동기",
  "팀 프로젝트 경험과 역할",
  "직무 관련 역량과 경험",
  "입사 후 포부",
];

const RESUME_PREVIEW = `이름: 홍길동
이메일: hong@example.com
학력: ◦◦대학교 경영학과 (2021 – 현재)

경력 및 경험
• UX 리서치 인턴십 | 2024.07 – 2024.08
  스타트업에서 앱 사용자 인터뷰 설계 및 분석 주도

• 캡스톤 디자인 프로젝트 | 2024.03 – 2024.06
  6인 팀 리더로 서비스 기획부터 프로토타입 총괄

• 교내 창업 경진대회 금상 | 2023.11
  사회문제 해결형 비즈니스 모델 기획

수상 및 자격
• SQLD (2023.06)
• 교내 창업 경진대회 금상 (2023.11)`;

export default function ExportPage() {
  const [tab, setTab] = useState<Tab>("resume");
  const [selectedExp, setSelectedExp] = useState<string[]>(["1", "2", "3"]);
  const [selectedPrompt, setSelectedPrompt] = useState<string>(COVER_PROMPTS[0]);
  const [coverExpanded, setCoverExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const isPro = false; // dummy plan state

  const toggleExp = (id: string) => {
    setSelectedExp((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
    }, 1500);
  };

  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-heading-2 text-text-primary">익스포트</h1>
          <p className="text-body text-text-secondary mt-1">기록된 경험으로 이력서와 자소서를 만들어요.</p>
        </div>

        {/* Plan badge */}
        {!isPro && (
          <div className="flex items-center gap-2 bg-surface-secondary border border-border rounded-lg px-4 py-3">
            <Lock size={14} className="text-text-tertiary" />
            <span className="text-body-sm text-text-secondary">
              현재 <strong className="text-text-primary">Free 플랜</strong>이에요. 출력물에 워터마크가 포함됩니다.
            </span>
            <a href="/settings" className="ml-auto text-label text-brand hover:text-brand-dark transition-colors shrink-0">
              Pro 업그레이드
            </a>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-border gap-0">
          {(["resume", "cover"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-body-sm border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-brand text-brand font-medium"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              ].join(" ")}
            >
              {t === "resume" ? <FileText size={14} /> : <PenLine size={14} />}
              {t === "resume" ? "이력서" : "자기소개서"}
            </button>
          ))}
        </div>

        {/* ── Resume tab ── */}
        {tab === "resume" && (
          <div className="grid sm:grid-cols-[1fr_1.4fr] gap-6">
            {/* Left: experience selector */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-title text-text-primary mb-1">포함할 경험 선택</h2>
              <p className="text-body-sm text-text-secondary mb-4">이력서에 넣을 경험을 골라요.</p>
              <div className="space-y-2">
                {EXPERIENCES.map((exp) => {
                  const checked = selectedExp.includes(exp.id);
                  return (
                    <button
                      key={exp.id}
                      onClick={() => toggleExp(exp.id)}
                      className={[
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                        checked
                          ? "border-brand bg-surface-brand"
                          : "border-border hover:border-border-strong hover:bg-surface-secondary",
                      ].join(" ")}
                    >
                      <div className={[
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        checked ? "bg-brand border-brand" : "border-border",
                      ].join(" ")}>
                        {checked && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm text-text-primary truncate">{exp.title}</p>
                        <p className="text-caption text-text-tertiary">{exp.date}</p>
                      </div>
                      <Badge variant="default">{exp.type}</Badge>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={selectedExp.length === 0 || generating}
                >
                  {generating ? "생성 중..." : "이력서 생성"}
                </Button>
              </div>
            </div>

            {/* Right: preview */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <h2 className="text-title text-text-primary mb-4">미리보기</h2>
              <div className="relative flex-1 bg-surface-secondary rounded-lg overflow-hidden">
                <pre className="text-body-sm text-text-secondary font-sans whitespace-pre-wrap p-4 leading-relaxed">
                  {RESUME_PREVIEW}
                </pre>
                {/* Free watermark overlay */}
                {!isPro && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-heading-1 font-bold text-text-tertiary/20 rotate-[-25deg] tracking-widest">
                      ARC FREE
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="ghost" size="sm" disabled={!isPro}>
                  <Lock size={13} className="mr-1" />
                  PDF 저장
                </Button>
                <Button variant="secondary" size="sm">
                  웹으로 보기
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Cover letter tab ── */}
        {tab === "cover" && (
          <div className="space-y-5">
            {/* Prompt + experience selector */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-title text-text-primary mb-4">자소서 초안 설정</h2>
              <div className="space-y-5">
                {/* Prompt selector */}
                <div>
                  <p className="text-body-sm text-text-secondary mb-2">항목 선택</p>
                  <div className="flex flex-wrap gap-2">
                    {COVER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedPrompt(p)}
                        className={[
                          "text-label px-3 py-1.5 rounded-lg border transition-colors",
                          selectedPrompt === p
                            ? "border-brand bg-surface-brand text-brand"
                            : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary",
                        ].join(" ")}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience selector (collapsible) */}
                <div>
                  <button
                    onClick={() => setCoverExpanded(!coverExpanded)}
                    className="flex items-center gap-1.5 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {coverExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    경험 선택 ({selectedExp.length}개 선택됨)
                  </button>
                  {coverExpanded && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EXPERIENCES.map((exp) => {
                        const checked = selectedExp.includes(exp.id);
                        return (
                          <button
                            key={exp.id}
                            onClick={() => toggleExp(exp.id)}
                            className={[
                              "flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-left",
                              checked
                                ? "border-brand bg-surface-brand"
                                : "border-border hover:border-border-strong hover:bg-surface-secondary",
                            ].join(" ")}
                          >
                            <div className={[
                              "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                              checked ? "bg-brand border-brand" : "border-border",
                            ].join(" ")}>
                              {checked && <CheckCircle2 size={10} className="text-white" />}
                            </div>
                            <span className="text-body-sm text-text-primary truncate">{exp.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={selectedExp.length === 0 || generating}
                  >
                    {generating ? "생성 중..." : "초안 생성"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Generated output */}
            {generated && (
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-title text-text-primary">생성된 초안</h2>
                  <Badge variant="default">AI 생성</Badge>
                </div>
                <div className="relative bg-surface-secondary rounded-lg p-4">
                  <p className="text-body text-text-primary leading-loose">
                    저는 다양한 현장 경험을 통해 사람 중심의 문제 해결 역량을 키워왔습니다. UX 리서치 인턴십에서는
                    실제 사용자를 직접 인터뷰하고 데이터를 분석하며, 서비스 개선에 직접 기여하는 경험을 했습니다.
                    캡스톤 프로젝트에서는 팀 리더로서 아이디어 발산부터 프로토타입 완성까지 전 과정을 총괄했으며,
                    이 과정에서 협업과 커뮤니케이션의 중요성을 몸소 배웠습니다.
                  </p>
                  {!isPro && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none rounded-lg">
                      <span className="text-heading-2 font-bold text-text-tertiary/20 rotate-[-25deg] tracking-widest">
                        ARC FREE
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end mt-4">
                  <Button variant="ghost" size="sm">재생성</Button>
                  <Button variant="secondary" size="sm">복사</Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
