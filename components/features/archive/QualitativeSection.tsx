"use client";

import { Textarea } from "@/components/ui";

interface QualitativeSectionProps {
  motivation: string;
  takeaway: string;
  onMotivationChange: (value: string) => void;
  onTakeawayChange: (value: string) => void;
}

export function QualitativeSection({
  motivation,
  takeaway,
  onMotivationChange,
  onTakeawayChange,
}: QualitativeSectionProps) {
  return (
    <>
      {/* Divider */}
      <div className="flex items-center gap-3 my-7">
        <div className="flex-1 h-px bg-border" />
        <span className="text-caption text-text-tertiary uppercase tracking-widest font-semibold whitespace-nowrap">
          ✦ ARC가 가장 소중하게 생각하는 부분
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Section box */}
      <div className="rounded-xl bg-surface-brand border border-brand/15 p-5 flex flex-col gap-5">
        {/* Motivation */}
        <div>
          <p className="text-label font-bold text-brand-dark mb-1">✦ 왜 이 활동을 했나요?</p>
          <p className="text-caption text-brand-dark/60 mb-2 leading-relaxed">
            동기, 당시 고민, 계기 — 무엇이든 괜찮아요
          </p>
          <Textarea
            value={motivation}
            onChange={(e) => onMotivationChange(e.target.value)}
            placeholder="처음엔 그냥 스펙 쌓으려고 지원했는데..."
            className="min-h-[88px] bg-white/70 border-brand/20 focus:border-brand placeholder:text-brand-dark/30 placeholder:italic"
          />
        </div>

        {/* Takeaway */}
        <div>
          <p className="text-label font-bold text-brand-dark mb-1">✦ 무엇을 배웠나요?</p>
          <p className="text-caption text-brand-dark/60 mb-2 leading-relaxed">
            결과보다 과정과 변화가 더 중요해요
          </p>
          <Textarea
            value={takeaway}
            onChange={(e) => onTakeawayChange(e.target.value)}
            placeholder="팀으로 일한다는 게 어떤 건지 처음 느꼈어요."
            className="min-h-[88px] bg-white/70 border-brand/20 focus:border-brand placeholder:text-brand-dark/30 placeholder:italic"
          />
        </div>
      </div>
    </>
  );
}
