"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import type { SelectableExperience } from "@/types/analysis";
import {
  getSelectableExperiences,
  createComprehensiveAnalysis,
} from "@/lib/api/analysis-api";
import { ApiError } from "@/lib/api/client";
import { capture } from "@/lib/analytics";
import ExperienceSelector from "@/components/features/analysis/ExperienceSelector";

type Phase = "select" | "error";

export default function ComprehensiveNewPage() {
  const router = useRouter();
  const [experiences, setExperiences] = useState<SelectableExperience[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expLoaded, setExpLoaded] = useState(false);

  const fetchExperiences = useCallback(() => {
    getSelectableExperiences()
      .then((exps) => {
        setExperiences(exps);
        setExpLoaded(true);
      })
      .catch(() => {
        setPhase("error");
        setErrorMsg("경험 목록을 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    fetchExperiences();
  }, [fetchExperiences]);

  // 생성 요청이 도는 동안 사용자는 '목록으로'나 전역 내비게이션으로 떠날 수 있다. 그때 뒤늦게
  // 도착한 응답이 router.push 를 부르면 보고 있던 화면을 빼앗아 목록으로 끌고 온다.
  // 시작했다는 사실은 토스트로 알리되, **화면을 옮기는 건 이 화면에 남아 있을 때만** 한다.
  // (초기값이 아니라 effect 본문에서 true 로 세운다 — StrictMode 이중 마운트에서 첫 정리가
  //  false 로 내려놓은 뒤 다시 켜주는 곳이 없으면 영영 false 로 남는다.)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // FRT-176: 분석을 걸면 기다리게 하지 않고 목록으로 보낸다.
  //
  // 예전에는 여기서 대기 화면을 띄우고 60초 예산으로 폴링하다가, 예산이 끝나면 "시간 초과"
  // 오류를 보여줬다. 분석은 실패한 적이 없었고(백엔드는 계속 돌아 결국 완료된다) 화면만
  // 거짓말을 했다. 소요시간은 예측할 수 없으므로 예산을 키워봐야 같은 버그가 재발한다.
  const startAnalysis = useCallback(async () => {
    setSubmitting(true);
    // 실행 직전 최종 선택 = "어떤 조합으로 분석을 시도했나"(FRT-19). 완료 못 가도 drop-off 관측.
    capture("analysis_target_selected", { analysis_type: "comprehensive", count: selected.length });
    try {
      const { analysisId: id } = await createComprehensiveAnalysis(selected);
      // 서버가 요청을 받았다(FRT-107). 위 analysis_target_selected(누름)와의 건수 차이가
      // "눌렀는데 요청이 안 나간" 기술적 실패다 — analysis_completed 로는 못 가른다.
      // 그건 분석이 끝났다는 뜻이라 "접수됐지만 도는 중"과 한 덩어리가 되기 때문이다.
      capture("analysis_requested", { analysis_type: "comprehensive", accepted: true });
      toast("분석을 시작했어요. 목록에서 진행 상황을 확인하세요.", "success");
      if (!mountedRef.current) return;
      // 방금 만든 분석 id 를 목록에 알려준다 — 빨리 끝나는 분석은 목록의 첫 조회 시점에 이미
      // 완료라 '진행 중 → 완료' 전이가 없고, 그러면 완료 계측·피드백 트리거를 놓친다.
      // id 를 못 받는 레거시 응답(FRT-38)이면 추적 대상을 특정할 수 없어 그냥 목록으로 간다.
      router.push(
        id
          ? `/analysis/comprehensive?started=${encodeURIComponent(id)}`
          : "/analysis/comprehensive",
      );
    } catch (err) {
      // 서버가 **응답을 돌려준** 실패만 여기 실린다(FRT-107). ApiError 는 HTTP 응답이
      // 왔다는 증거다 — 오프라인·DNS·연결 끊김은 응답 자체가 없어 raw 예외로 오고, 그건
      // 접수가 아니라 "요청이 브라우저를 못 떠났다"라 세 갈래가 이렇게 갈린다:
      //   누름 − requested(전체)      = 요청이 브라우저를 못 떠났다
      //   requested{accepted:false}   = 나갔는데 서버가 거절했다
      //   requested{accepted:true}    = 접수됐다
      // 조건 없이 쏘면 첫 갈래가 영영 비어, 정작 재려던 기술적 실패를 못 짚는다.
      if (err instanceof ApiError) {
        capture("analysis_requested", { analysis_type: "comprehensive", accepted: false });
      }
      if (!mountedRef.current) return;
      setSubmitting(false);
      setPhase("error");
      setErrorMsg("분석 요청에 실패했습니다.");
    }
  }, [selected, router]);

  if (phase === "error") {
    return (
      <main>
        <div className="flex flex-col items-center justify-center py-24 px-4" role="alert">
          <h2 className="text-title text-text-primary mb-2">오류 발생</h2>
          <p className="text-body-sm text-text-secondary mb-4">{errorMsg}</p>
          <Button size="sm" onClick={() => { setPhase("select"); fetchExperiences(); }}>
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
            isLoading={!expLoaded}
          />
        </section>

        <div className="pt-4">
          <Button
            fullWidth
            disabled={selected.length < 2 || submitting}
            onClick={startAnalysis}
          >
            {submitting ? "분석을 시작하는 중..." : "분석 시작"}
          </Button>
        </div>
      </div>
    </main>
  );
}
