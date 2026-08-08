"use client";

import { AlertTriangle } from "lucide-react";
import { Button, FullPageMessage } from "@/components/ui";

// `error` 는 Next 가 넘겨주지만 화면에 쓰지 않는다 — 사용자에게 스택을 노출하지 않기 위해서다.
// 원인은 브라우저 콘솔(클라이언트)과 Vercel 런타임 로그(서버)에 남는다.
export default function AnalysisError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FullPageMessage
      role="alert"
      fill="parent"
      icon={<AlertTriangle size={22} aria-hidden="true" />}
      title="분석을 불러오지 못했어요"
      description="잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요."
    >
      <Button variant="secondary" size="sm" onClick={reset}>
        다시 시도
      </Button>
    </FullPageMessage>
  );
}
