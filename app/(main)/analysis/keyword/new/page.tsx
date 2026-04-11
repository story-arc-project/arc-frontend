"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { KeywordSuggestion, KeywordCategory } from "@/types/analysis";
import {
  getKeywordSuggestions,
  getSelectableExperiences,
  createKeywordAnalysis,
  getAnalysisStatus,
} from "@/lib/analysis-api";
import KeywordSelector from "@/components/features/analysis/KeywordSelector";
import ExperienceSelector from "@/components/features/analysis/ExperienceSelector";

type Phase = "select" | "loading" | "error";

export default function KeywordNewPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [experiences, setExperiences] = useState<
    { id: string; title: string; type: string; importance: number; isComplete: boolean }[]
  >([]);
  const [selectedKeywords, setSelectedKeywords] = useState<
    { label: string; category: KeywordCategory }[]
  >([]);
  const [scopeAll, setScopeAll] = useState(true);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [scenario, setScenario] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getKeywordSuggestions().then(setSuggestions);
    getSelectableExperiences().then(setExperiences);
  }, []);

  const startAnalysis = useCallback(async () => {
    setPhase("loading");
    try {
      const { analysisId } = await createKeywordAnalysis({
        keywords: selectedKeywords,
        experienceIds: scopeAll ? undefined : selectedExpIds,
        scenario: scenario || undefined,
      });

      const poll = async (retries: number): Promise<void> => {
        if (retries <= 0) {
          setPhase("error");
          setErrorMsg("분석 시간이 초과되었습니다.");
          return;
        }
        const { status } = await getAnalysisStatus(analysisId);
        if (status === "completed") {
          router.push(`/analysis/keyword/${analysisId}`);
          return;
        }
        if (status === "failed") {
          setPhase("error");
          setErrorMsg("분석에 실패했습니다. 다시 시도해주세요.");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
        return poll(retries - 1);
      };

      await poll(20);
    } catch {
      setPhase("error");
      setErrorMsg("분석 요청에 실패했습니다.");
    }
  }, [selectedKeywords, scopeAll, selectedExpIds, scenario, router]);

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <Loader2 size={32} className="text-brand animate-spin mb-4" />
        <h2 className="text-title text-text-primary mb-1">분석 중입니다...</h2>
        <p className="text-body-sm text-text-secondary">
          선택한 키워드를 기준으로 경험을 분석하고 있어요.
        </p>
        <div className="mt-6 w-full max-w-md space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-surface-secondary rounded-lg animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <h2 className="text-title text-text-primary mb-2">오류 발생</h2>
        <p className="text-body-sm text-text-secondary mb-4">{errorMsg}</p>
        <Button size="sm" onClick={() => setPhase("select")}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/analysis/keyword"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>

        <div>
          <h1 className="text-heading-2 text-text-primary">새 키워드 분석</h1>
          <p className="text-body text-text-secondary mt-1">
            분석할 키워드를 선택하고 범위를 설정하세요.
          </p>
        </div>

        {/* 1. Keyword Selection */}
        <section className="space-y-3">
          <h3 className="text-title text-text-primary">키워드 선택</h3>
          <KeywordSelector
            suggestions={suggestions}
            selected={selectedKeywords}
            onChange={setSelectedKeywords}
            maxCount={3}
          />
        </section>

        {/* 2. Scope */}
        <section className="space-y-3">
          <h3 className="text-title text-text-primary">분석 범위</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scopeAll}
                onChange={() => setScopeAll(true)}
                className="accent-brand"
              />
              <span className="text-body-sm text-text-primary">전체 경험</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={!scopeAll}
                onChange={() => setScopeAll(false)}
                className="accent-brand"
              />
              <span className="text-body-sm text-text-primary">
                특정 경험만
              </span>
            </label>
          </div>
          {!scopeAll && (
            <ExperienceSelector
              experiences={experiences}
              selected={selectedExpIds}
              onChange={setSelectedExpIds}
              minCount={1}
            />
          )}
        </section>

        {/* 3. Scenario */}
        <section className="space-y-3">
          <h3 className="text-title text-text-primary">
            목표 시나리오{" "}
            <span className="text-caption text-text-tertiary font-normal">
              (선택)
            </span>
          </h3>
          <Input
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="예: 컨설팅펌 취업, 데이터 분석가 전환"
          />
        </section>

        {/* Submit */}
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
    </div>
  );
}
