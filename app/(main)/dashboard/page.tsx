"use client";

import { useState } from "react";
import { TrendingUp, Zap, Clock, Award, ChevronRight, Plus } from "lucide-react";
import { Button, Badge, Textarea } from "@/components/ui";

const CAPABILITY_DATA = [
  { label: "기획·분석", value: 82, color: "bg-brand" },
  { label: "커뮤니케이션", value: 74, color: "bg-brand" },
  { label: "리더십", value: 60, color: "bg-brand" },
  { label: "기술·개발", value: 55, color: "bg-brand" },
  { label: "창의·디자인", value: 48, color: "bg-brand" },
];

const RECENT_EXPERIENCES = [
  { id: "1", title: "UX 리서치 인턴십", type: "인턴", date: "2024.07 – 2024.08", tags: ["UX", "리서치", "협업"] },
  { id: "2", title: "캡스톤 디자인 프로젝트", type: "프로젝트", date: "2024.03 – 2024.06", tags: ["기획", "팀리더"] },
  { id: "3", title: "교내 창업 경진대회 금상", type: "수상", date: "2023.11", tags: ["수상", "아이디어"] },
];

const QUICK_TAGS = ["오늘 배운 것", "프로젝트", "대외활동", "수업", "생각 메모"];

export default function DashboardPage() {
  const [memo, setMemo] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleQuickRecord = () => {
    if (!memo.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setMemo("");
      setSubmitted(false);
    }, 1800);
  };

  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <p className="text-body-sm text-text-tertiary mb-1">2024년 4월 2일 수요일</p>
          <h1 className="text-heading-2 text-text-primary">안녕하세요, 상추 님</h1>
          <p className="text-body text-text-secondary mt-1">총 12개의 경험이 기록되어 있어요.</p>
        </div>

        {/* AI Identity Summary */}
        <div className="bg-surface-brand border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-brand" />
            <span className="text-label text-brand font-semibold">AI 아이덴티티 요약</span>
          </div>
          <p className="text-body text-text-primary leading-relaxed">
            "사람과 문제 사이에서 인사이트를 찾는{" "}
            <span className="text-brand font-semibold">기획·리서치 지향 인재</span>. 팀 내 커뮤니케이션과 사용자
            중심 분석 경험이 풍부하며, 창업과 디자인 영역까지 확장 중입니다."
          </p>
          <p className="text-caption text-text-tertiary mt-3">12개 경험 기반 · 최근 업데이트 2일 전</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Award, label: "총 경험", value: "12개" },
            { icon: TrendingUp, label: "이번 달 추가", value: "3개" },
            { icon: Clock, label: "기록 기간", value: "14개월" },
            { icon: Zap, label: "역량 키워드", value: "28개" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-surface border border-border rounded-lg p-4">
              <Icon size={16} className="text-text-tertiary mb-2" />
              <p className="text-display text-text-primary">{value}</p>
              <p className="text-caption text-text-secondary mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Capability Chart + Recent Experiences */}
        <div className="grid sm:grid-cols-2 gap-6">

          {/* Capability bars */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-title text-text-primary mb-4">역량 분포</h2>
            <div className="space-y-3">
              {CAPABILITY_DATA.map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-body-sm text-text-secondary">{label}</span>
                    <span className="text-label text-text-tertiary">{value}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <a
              href="/analysis"
              className="mt-4 flex items-center gap-1 text-label text-brand hover:text-brand-dark transition-colors"
            >
              상세 분석 보기 <ChevronRight size={14} />
            </a>
          </div>

          {/* Recent experiences */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-title text-text-primary mb-4">최근 경험</h2>
            <div className="space-y-3">
              {RECENT_EXPERIENCES.map((exp) => (
                <div key={exp.id} className="flex flex-col gap-1 py-2 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-body-sm text-text-primary font-medium">{exp.title}</span>
                    <Badge variant="default">{exp.type}</Badge>
                  </div>
                  <p className="text-caption text-text-tertiary">{exp.date}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {exp.tags.map((tag) => (
                      <span key={tag} className="text-caption text-text-secondary bg-surface-secondary px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <a
              href="/archive"
              className="mt-4 flex items-center gap-1 text-label text-brand hover:text-brand-dark transition-colors"
            >
              전체 아카이브 <ChevronRight size={14} />
            </a>
          </div>
        </div>

        {/* Quick Recording */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={15} className="text-text-secondary" />
            <h2 className="text-title text-text-primary">퀵 레코딩</h2>
          </div>
          <p className="text-body-sm text-text-secondary mb-3">지금 느낀 것, 배운 것을 짧게 남겨요.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setMemo((prev) => (prev ? `${prev} #${tag}` : `#${tag} `))}
                className="text-label text-text-secondary bg-surface-secondary hover:bg-surface-tertiary border border-border px-2.5 py-1 rounded-md transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="오늘 어떤 경험을 했나요? 짧아도 괜찮아요."
            rows={3}
          />
          <div className="flex justify-end mt-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleQuickRecord}
              disabled={!memo.trim() || submitted}
            >
              {submitted ? "저장됐어요!" : "저장하기"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
