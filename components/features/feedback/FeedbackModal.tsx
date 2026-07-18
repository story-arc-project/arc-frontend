"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  feedbackCampaign,
  placeholderFor,
  questionCopyFor,
} from "@/lib/feedback/campaigns";
import type {
  FeedbackCampaign,
  FeedbackCampaignId,
  FeedbackContext,
  FeedbackPayload,
  FeedbackRating,
  FeedbackTriggerSource,
} from "@/lib/feedback/types";

interface FeedbackModalProps {
  open: boolean;
  /** 어떤 캠페인의 문구·placeholder·점수경계를 쓸지. config(campaigns.ts)에서 조회한다. */
  campaignId: FeedbackCampaignId;
  /** 모달을 띄운 게이트 — 질문 문구를 고르고 payload 에 그대로 실린다. */
  triggerSource: FeedbackTriggerSource;
  /** 응답에 함께 실을 최소 메타(analysisId 등). PII 금지 화이트리스트는 타입이 강제한다. */
  context?: FeedbackContext;
  /**
   * 제출 결과를 방출한다. 이 모달은 순수 표현형이라 전송(submitFeedback)을 직접 호출하지 않는다 —
   * 노출 판정·전송 배선은 트리거 배선(FRT-95)이 이 콜백을 잇는다.
   */
  onSubmit: (payload: FeedbackPayload) => void;
  onClose: () => void;
}

const RATINGS: readonly FeedbackRating[] = [1, 2, 3, 4, 5];

/**
 * 자유텍스트를 상한으로 자른다. **코드 포인트 기준**(`[...v].length`)으로 세야 서버(Python `len`)와
 * 경계가 일치한다 — `.length`(UTF-16 code unit)로 세면 이모지에서 양쪽이 다른 지점을 자른다.
 */
function clampComment(v: string): string {
  const points = [...v];
  return points.length > FEEDBACK_COMMENT_MAX_LENGTH
    ? points.slice(0, FEEDBACK_COMMENT_MAX_LENGTH).join("")
    : v;
}

export function FeedbackModal({ open, ...rest }: FeedbackModalProps) {
  const campaign = feedbackCampaign(rest.campaignId);
  const question = questionCopyFor(campaign, rest.triggerSource);

  return (
    <Dialog open={open} onClose={rest.onClose} ariaLabel={question}>
      {/* 폼 상태(별점·코멘트)는 여기 내부에 둔다. Dialog 는 닫힐 때 children 을 언마운트하므로
          재오픈 시 자동으로 초기화된다 — 리셋 effect 가 필요 없다. */}
      <FeedbackForm campaign={campaign} question={question} {...rest} />
    </Dialog>
  );
}

type FeedbackFormProps = Omit<FeedbackModalProps, "open"> & {
  campaign: FeedbackCampaign;
  question: string;
};

function FeedbackForm({
  campaign,
  question,
  campaignId,
  triggerSource,
  context,
  onSubmit,
  onClose,
}: FeedbackFormProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [hoveredRating, setHoveredRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const revealed = rating !== null;
  // hover 는 선택을 덮어써 미리보기를 준다. 채움 기준은 hover > 선택 순.
  const activeRating = hoveredRating ?? rating ?? 0;
  const placeholder = revealed ? placeholderFor(campaign, rating) : "";
  // roving tabindex: 선택된 별 하나만 탭 정지(미선택이면 첫 별). 나머지는 화살표키로 이동한다.
  const tabbableValue: FeedbackRating = rating ?? 1;

  function moveRating(e: KeyboardEvent, current: FeedbackRating) {
    let next: FeedbackRating | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      next = Math.min(current + 1, 5) as FeedbackRating;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      next = Math.max(current - 1, 1) as FeedbackRating;
    } else if (e.key === "Home") {
      next = 1;
    } else if (e.key === "End") {
      next = 5;
    }
    if (next === null) return;
    // radiogroup 규약: 화살표 이동 시 선택도 함께 옮기고 포커스를 넘긴다.
    e.preventDefault();
    setRating(next);
    starRefs.current[next - 1]?.focus();
  }

  function handleSubmit() {
    if (rating === null) return;
    const trimmed = comment.trim();
    onSubmit({
      campaignId,
      triggerSource,
      rating,
      ...(trimmed ? { comment: trimmed } : {}),
      ...(context ? { context } : {}),
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 헤더 — 질문 + 닫기(불이익 없음) */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-heading-3 text-text-primary">{question}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-secondary"
        >
          <X size={18} />
        </button>
      </div>

      {/* 별점 */}
      <div
        role="radiogroup"
        aria-label={question}
        className="flex items-center justify-center gap-1.5"
        onMouseLeave={() => setHoveredRating(null)}
      >
        {RATINGS.map((value) => {
          const filled = value <= activeRating;
          return (
            <button
              key={value}
              ref={(el) => {
                starRefs.current[value - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`별 ${value}점`}
              tabIndex={value === tabbableValue ? 0 : -1}
              onClick={() => setRating(value)}
              onKeyDown={(e) => moveRating(e, value)}
              onMouseEnter={() => setHoveredRating(value)}
              onFocus={() => setHoveredRating(value)}
              onBlur={() => setHoveredRating(null)}
              className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Star
                size={32}
                className={
                  filled ? "fill-warning text-warning" : "text-text-tertiary"
                }
              />
            </button>
          );
        })}
      </div>

      {/* 적응형 자유텍스트 — 별점 선택 시 점수 무관하게 항상 부드럽게 열림 */}
      <div
        className={[
          "grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          revealed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <textarea
            value={comment}
            onChange={(e) => setComment(clampComment(e.target.value))}
            placeholder={placeholder}
            rows={2}
            disabled={!revealed}
            aria-hidden={!revealed}
            aria-label="한마디 의견 (선택)"
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-body-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* 제출 — 별점 선택 전엔 비활성. 코멘트는 선택. */}
      <Button
        variant="primary"
        fullWidth
        disabled={rating === null}
        onClick={handleSubmit}
      >
        보내기
      </Button>
    </div>
  );
}
