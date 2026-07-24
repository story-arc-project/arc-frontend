"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { CoverLetterCollapsible } from "@/components/features/export/CoverLetterCollapsible";
import { CoverLetterQuestionsField } from "@/components/features/export/CoverLetterQuestionsField";
import { createCoverLetter } from "@/lib/api/cover-letter-api";
import { capture } from "@/lib/analytics";
import { useBasePath } from "@/lib/utils/use-base-path";
import { useSuppressFeedback } from "@/contexts/FeedbackTriggerContext";
import type { CoverLetterQuestion } from "@/types/cover-letter";
import { CoverLetterGenerationOverlay } from "../../_components/CoverLetterGenerationOverlay";

const GENERATION_TIMEOUT_MS = 120_000;

export default function NewCoverLetterPage() {
  const router = useRouter();
  const basePath = useBasePath();

  const [targetCompany, setTargetCompany] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [motivation, setMotivation] = useState("");
  const [careerGoal, setCareerGoal] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [questions, setQuestions] = useState<CoverLetterQuestion[]>([{ question: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 만드는 중에 피드백 모달이 위를 덮지 않게 한다(FRT-95).
  useSuppressFeedback(submitting);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      await createCoverLetter(
        {
          targetCompany,
          targetJob,
          motivation,
          careerGoal,
          extraNotes,
          // 빈 문항은 보내지 않는다 — 명세상 빈 목록이면 백엔드가 자유 형식 1건을 만든다.
          // 여기서 "(자유 형식)" 문자열을 지어 보내면 그 문구가 문항 제목으로 굳어 버린다.
          questions: questions.filter((q) => q.question.trim() !== ""),
        },
        { signal: controller.signal },
      );

      capture("export_completed", {
        export_type: "cover_letter",
        question_count: questions.filter((q) => q.question.trim() !== "").length,
      });

      // 생성은 비동기다 — id 를 즉시 받아도 본문은 나중에 채워진다. 상세로 바로 보내면
      // 아직 없는 본문을 로드해 "불러오지 못했어요"가 뜬다(레쥬메와 같은 판단).
      toast("자기소개서를 만들고 있어요. 완료되면 목록에 표시돼요", "info");
      router.push(`${basePath}/export`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("생성이 오래 걸렸어요. 다시 시도해 주세요.");
      } else {
        setError("자기소개서 생성에 실패했어요. 다시 시도해 주세요.");
      }
      setSubmitting(false);
    } finally {
      window.clearTimeout(timeoutId);
      abortRef.current = null;
    }
  };

  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`${basePath}/export`)}
          className="-ml-2 mb-2"
        >
          <ChevronLeft size={16} className="mr-1" />
          익스포트
        </Button>

        <header>
          <h1 className="text-heading-2 text-text-primary">새 자기소개서</h1>
          <p className="mt-1 text-body text-text-secondary">
            기록한 경험을 바탕으로 문항별 초안을 만들어요. 근거가 없는 문장은 표시해 드려요.
          </p>
        </header>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-body-sm font-medium text-text-primary">지원 회사</span>
              <input
                type="text"
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                placeholder="예: 토스"
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              />
              <span className="mt-1 block text-caption text-text-tertiary">
                입력하면 회사의 가치·인재상을 찾아 방향에 반영해요.
              </span>
            </label>

            <label className="block">
              <span className="text-body-sm font-medium text-text-primary">지원 직무</span>
              <input
                type="text"
                value={targetJob}
                onChange={(e) => setTargetJob(e.target.value)}
                placeholder="예: 데이터 분석"
                className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              />
            </label>
          </div>

          <CoverLetterQuestionsField questions={questions} onChange={setQuestions} />

          {/* 있으면 좋지만 없어도 만들 수 있는 것들은 접어 둔다 — 칸이 늘수록 시작을 미룬다. */}
          <CoverLetterCollapsible title="더 정교하게 만들기" hint="선택">
            <div className="space-y-3">
              <label className="block">
                <span className="text-body-sm font-medium text-text-primary">지원 동기</span>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={2}
                  placeholder="이 회사에 지원하는 개인적인 계기"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-body-sm font-medium text-text-primary">입사 후 포부</span>
                <textarea
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                  rows={2}
                  placeholder="이 직무에서 이루고 싶은 것"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-body-sm font-medium text-text-primary">그 밖의 메모</span>
                <textarea
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  rows={2}
                  placeholder="기록에 없지만 넣고 싶은 사실"
                  className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                />
              </label>
            </div>
          </CoverLetterCollapsible>

          {error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/10 px-4 py-3"
            >
              <p className="text-body-sm text-error">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  handleSubmit();
                }}
                className="shrink-0 text-body-sm font-medium text-error underline-offset-2 hover:underline"
              >
                다시 시도
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`${basePath}/export`)}
            >
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              초안 만들기
            </Button>
          </div>
        </div>
      </div>

      <CoverLetterGenerationOverlay open={submitting} />
    </div>
  );
}
