"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import type { KeywordSuggestion, KeywordCategory } from "@/types/analysis";
import {
  getKeywordSuggestions,
  createKeywordAnalysis,
} from "@/lib/api/analysis-api";
import { capture } from "@/lib/analytics";
import useAnalysisPolling from "@/hooks/useAnalysisPolling";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";
import KeywordSelector from "@/components/features/analysis/KeywordSelector";

type Phase = "select" | "loading" | "error";

export default function KeywordNewPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<
    { label: string; category: KeywordCategory }[]
  >([]);
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const feedbackTriggers = useFeedbackTriggers();

  const { start: startPolling } = useAnalysisPolling({
    analysisId,
    type: "keyword",
    redirectPath: "/analysis/keyword",
    // 완료 사실만 레이아웃의 FeedbackHost 로 넘긴다 — 모달은 이동한 결과 화면 위에서 뜬다.
    onCompleted: (context) => feedbackTriggers?.reportAnalysisCompleted(context),
    onFailed: (msg) => {
      setPhase("error");
      setErrorMsg(msg);
    },
    onTimeout: (msg) => {
      setPhase("error");
      setErrorMsg(msg);
    },
  });

  const fetchSuggestions = useCallback(() => {
    getKeywordSuggestions()
      .then(setSuggestions)
      .catch(() => {
        setPhase("error");
        setErrorMsg("키워드 추천을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  useEffect(() => {
    if (analysisId && phase === "loading") {
      startPolling();
    }
  }, [analysisId, phase, startPolling]);

  const startAnalysis = useCallback(async () => {
    setPhase("loading");
    // 실행 직전 최종 선택 = "어떤 키워드로 적합도를 확인하려 하나"(FRT-19). category 는 4분류.
    const keywordCategories = Array.from(new Set(selectedKeywords.map((k) => k.category)));
    capture("analysis_target_selected", {
      analysis_type: "keyword",
      count: selectedKeywords.length,
      keyword_categories: keywordCategories,
    });
    try {
      const labels = selectedKeywords.map((k) => k.label);
      const { analysisId: id } = await createKeywordAnalysis(labels, target.trim());
      if (id) {
        setAnalysisId(id);
        return;
      }
      // 백엔드가 아직 분석 id 를 반환하지 않는다(FRT-38). 폴링 대상을 특정할 수 없으므로
      // 가짜 오류 화면 대신 목록으로 보내 진행 상황을 보게 한다.
      toast("분석을 시작했어요. 목록에서 진행 상황을 확인하세요.", "success");
      router.push("/analysis/keyword");
    } catch {
      setPhase("error");
      setErrorMsg("분석 요청에 실패했습니다.");
    }
  }, [selectedKeywords, target, router]);

  if (phase === "loading") {
    return (
      <main>
        <div className="flex flex-col items-center justify-center py-24 px-4" role="status" aria-live="polite">
          <Loader2 size={32} className="text-brand animate-spin mb-4" aria-hidden="true" />
          <h2 className="text-title text-text-primary mb-1">분석 중입니다...</h2>
          <p className="text-body-sm text-text-secondary">
            선택한 키워드를 기준으로 경험을 분석하고 있어요.
          </p>
          <div className="mt-6 w-full max-w-md space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`h-12 bg-surface-secondary rounded-lg animate-pulse [animation-delay:${i * 150}ms]`}
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main>
        <div className="flex flex-col items-center justify-center py-24 px-4" role="alert">
          <h2 className="text-title text-text-primary mb-2">오류 발생</h2>
          <p className="text-body-sm text-text-secondary mb-4">{errorMsg}</p>
          <Button size="sm" onClick={() => { setPhase("select"); fetchSuggestions(); }}>
            다시 시도
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/analysis/keyword"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div>
          <h1 className="text-heading-2 text-text-primary">새 키워드 분석</h1>
          <p className="text-body text-text-secondary mt-1">
            분석할 키워드를 선택해주세요.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-title text-text-primary">키워드 선택</h2>
          <KeywordSelector
            suggestions={suggestions}
            selected={selectedKeywords}
            onChange={setSelectedKeywords}
            maxCount={3}
          />
        </section>

        <section className="space-y-2">
          <label htmlFor="keyword-target" className="text-title text-text-primary block">
            목표 (선택)
          </label>
          <p className="text-body-sm text-text-secondary">
            지원하려는 직무·상황을 적으면 그 맥락에 맞춰 분석해요.
          </p>
          <input
            id="keyword-target"
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value.slice(0, 100))}
            placeholder="예: 스타트업 PM 지원"
            maxLength={100}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-body-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand"
          />
        </section>

        <div className="pt-4">
          <Button
            fullWidth
            disabled={selectedKeywords.length === 0}
            onClick={startAnalysis}
          >
            분석 시작
          </Button>
        </div>
      </div>
    </main>
  );
}
