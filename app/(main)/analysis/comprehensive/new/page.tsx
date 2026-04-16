"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { SelectableExperience } from "@/types/analysis";
import {
  getSelectableExperiences,
  createComprehensiveAnalysis,
} from "@/lib/api/analysis-api";
import useAnalysisPolling from "@/hooks/useAnalysisPolling";
import ExperienceSelector from "@/components/features/analysis/ExperienceSelector";

type Phase = "select" | "loading" | "error";

export default function ComprehensiveNewPage() {
  const [experiences, setExperiences] = useState<SelectableExperience[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const { start: startPolling } = useAnalysisPolling({
    analysisId,
    type: "comprehensive",
    redirectPath: "/analysis/comprehensive",
    onFailed: (msg) => {
      setPhase("error");
      setErrorMsg(msg);
    },
    onTimeout: (msg) => {
      setPhase("error");
      setErrorMsg(msg);
    },
  });

  useEffect(() => {
    getSelectableExperiences()
      .then(setExperiences)
      .catch(() => {
        setPhase("error");
        setErrorMsg("경험 목록을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    if (analysisId && phase === "loading") {
      startPolling();
    }
  }, [analysisId, phase, startPolling]);

  const startAnalysis = useCallback(async () => {
    setPhase("loading");
    try {
      const { analysisId: id } = await createComprehensiveAnalysis(selected);
      setAnalysisId(id);
    } catch {
      setPhase("error");
      setErrorMsg("분석 요청에 실패했습니다.");
    }
  }, [selected]);

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4" role="status" aria-live="polite">
        <Loader2 size={32} className="text-brand animate-spin mb-4" aria-hidden="true" />
        <h2 className="text-title text-text-primary mb-1">분석 중입니다...</h2>
        <p className="text-body-sm text-text-secondary">
          선택한 {selected.length}개 경험을 종합 분석하고 있어요.
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
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4" role="alert">
        <h2 className="text-title text-text-primary mb-2">오류 발생</h2>
        <p className="text-body-sm text-text-secondary mb-4">{errorMsg}</p>
        <Button size="sm" onClick={() => setPhase("select")}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/analysis/comprehensive"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:rounded-sm"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          목록으로
        </Link>

        <div>
          <h1 className="text-heading-2 text-text-primary">새 종합 분석</h1>
          <p className="text-body text-text-secondary mt-1">
            분석할 경험을 선택해주세요.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-title text-text-primary">경험 선택</h2>
          <ExperienceSelector
            experiences={experiences}
            selected={selected}
            onChange={setSelected}
            minCount={2}
          />
        </section>

        <div className="pt-4">
          <Button
            fullWidth
            disabled={selected.length < 2}
            onClick={startAnalysis}
          >
            분석 시작
          </Button>
        </div>
      </div>
    </main>
  );
}
