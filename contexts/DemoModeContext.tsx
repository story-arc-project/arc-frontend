"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { setDemoMode } from "@/lib/demo/state";

export interface DemoTourStep {
  id: string;
  /** 우측 가이드 카드의 짧은 타이틀 */
  title: string;
  /** 본문 한 단락 */
  body: string;
  /** 이 step 으로 들어가는 라우트. 다음 버튼 클릭 시 router.push */
  route: string;
  /** 다음 단계 라벨 (마지막 step 은 별도) */
  nextLabel?: string;
}

export const DEMO_TOUR_STEPS: DemoTourStep[] = [
  {
    id: "welcome",
    title: "ARC 데모에 오신 걸 환영해요",
    body:
      "심사위원께 가볍게 보여드리는 체험판입니다. 입력은 저장되지 않고 새로고침 시 초기화돼요. 핵심 기능 3가지를 차례로 살펴볼게요.",
    route: "/demo/archive",
    nextLabel: "경험 기록 보기 →",
  },
  {
    id: "archive",
    title: "1. 경험을 기록한다",
    body:
      "왼쪽에서 라이브러리, 가운데에서 경험 카드를 살펴보세요. 우측 + 새 경험 버튼으로 직접 한 건을 추가해볼 수도 있어요. (메모리에만 저장됩니다)",
    route: "/demo/archive",
    nextLabel: "분석 결과 보기 →",
  },
  {
    id: "analysis",
    title: "2. 패턴과 강점을 본다",
    body:
      "기록된 경험을 바탕으로 AI가 개별·종합·키워드 단위로 분석한 결과 예시예요. 카드를 클릭하면 상세를 볼 수 있어요.",
    route: "/demo/analysis",
    nextLabel: "이력서 보기 →",
  },
  {
    id: "export",
    title: "3. 이력서로 자동 정리된다",
    body:
      "기록한 경험이 이력서 초안으로 자동 구성돼요. 한국어/영문, 인적사항·경력·프로젝트 등 모든 섹션이 채워집니다.",
    route: "/demo/export",
    nextLabel: "마무리 →",
  },
  {
    id: "done",
    title: "여기까지가 ARC 데모예요",
    body:
      "실제로는 본인의 경험 데이터로 모든 단계가 자동화돼요. 회원가입하면 직접 사용해볼 수 있어요.",
    route: "/demo/export",
  },
];

interface DemoModeContextValue {
  stepIndex: number;
  step: DemoTourStep;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  open: boolean;
  next: () => void;
  prev: () => void;
  skip: () => void;
  reopen: () => void;
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error("useDemoMode must be used inside DemoModeProvider");
  return ctx;
}

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const [stepIndex, setStepIndex] = useState(0);
  const [open, setOpen] = useState(true);

  // 마운트(hydration 직후) 시 데모 모드 ON, 언마운트 시 OFF.
  // useEffect 는 클라이언트에서만 실행되므로 서버 렌더 단계에는 영향이 없다.
  // 서버 렌더 단계의 isDemoMode() 호출은 별도로 pathname 기반 판별에 의존한다
  // (lib/demo/state.ts 참고).
  useEffect(() => {
    setDemoMode(true);
    return () => setDemoMode(false);
  }, []);

  const next = useCallback(() => {
    const nextIdx = Math.min(stepIndex + 1, DEMO_TOUR_STEPS.length - 1);
    const nextStep = DEMO_TOUR_STEPS[nextIdx];
    setStepIndex(nextIdx);
    setOpen(true);
    if (nextStep.route !== pathname) {
      router.push(nextStep.route);
    }
  }, [stepIndex, pathname, router]);

  const prev = useCallback(() => {
    const prevIdx = Math.max(stepIndex - 1, 0);
    const prevStep = DEMO_TOUR_STEPS[prevIdx];
    setStepIndex(prevIdx);
    setOpen(true);
    if (prevStep.route !== pathname) {
      router.push(prevStep.route);
    }
  }, [stepIndex, pathname, router]);

  const skip = useCallback(() => setOpen(false), []);
  const reopen = useCallback(() => setOpen(true), []);

  const value = useMemo<DemoModeContextValue>(
    () => ({
      stepIndex,
      step: DEMO_TOUR_STEPS[stepIndex] ?? DEMO_TOUR_STEPS[0],
      totalSteps: DEMO_TOUR_STEPS.length,
      isFirst: stepIndex === 0,
      isLast: stepIndex === DEMO_TOUR_STEPS.length - 1,
      open,
      next,
      prev,
      skip,
      reopen,
    }),
    [stepIndex, open, next, prev, skip, reopen],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}
