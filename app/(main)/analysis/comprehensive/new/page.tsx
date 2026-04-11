"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  getSelectableExperiences,
  createComprehensiveAnalysis,
  getAnalysisStatus,
} from "@/lib/analysis-api";
import ExperienceSelector from "@/components/features/analysis/ExperienceSelector";

type Phase = "select" | "loading" | "error";

export default function ComprehensiveNewPage() {
  const router = useRouter();
  const [experiences, setExperiences] = useState<
    { id: string; title: string; type: string; importance: number; isComplete: boolean }[]
  >([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scenario, setScenario] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    getSelectableExperiences().then(setExperiences);
  }, []);

  const startAnalysis = useCallback(async () => {
    setPhase("loading");
    try {
      const { analysisId } = await createComprehensiveAnalysis({
        experienceIds: selected,
        scenario: scenario || undefined,
      });

      // Poll for status
      const poll = async (retries: number): Promise<void> => {
        if (retries <= 0) {
          setPhase("error");
          setErrorMsg("분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        const { status } = await getAnalysisStatus(analysisId);
        if (status === "completed") {
          router.push(`/analysis/comprehensive/${analysisId}`);
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
  }, [selected, scenario, router]);

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <Loader2 size={32} className="text-brand animate-spin mb-4" />
        <h2 className="text-title text-text-primary mb-1">분석 중입니다...</h2>
        <p className="text-body-sm text-text-secondary">
          선택한 {selected.length}개 경험을 종합 분석하고 있어요.
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
          href="/analysis/comprehensive"
          className="inline-flex items-center gap-1 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          목록으로
        </Link>

        <div>
          <h1 className="text-heading-2 text-text-primary">새 종합 분석</h1>
          <p className="text-body text-text-secondary mt-1">
            분석할 경험을 선택하고 시나리오를 설정하세요.
          </p>
        </div>

        {/* Experience Selection */}
        <section className="space-y-3">
          <h3 className="text-title text-text-primary">경험 선택</h3>
          <ExperienceSelector
            experiences={experiences}
            selected={selected}
            onChange={setSelected}
            minCount={2}
          />
        </section>

        {/* Scenario Input */}
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
            placeholder="예: 컨설팅펌 취업, 로스쿨 진학"
          />
        </section>

        {/* Submit */}
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
    </div>
  );
}
