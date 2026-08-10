"use client";

import { AlertTriangle } from "lucide-react";
import { Button, FullPageMessage } from "@/components/ui";

// (main) 바깥 세그먼트 — 랜딩·인증·데모·관리자·약관처럼 자체 error.tsx 가 없는 라우트의 경계.
// 자체 경계가 있는 (main)·(main)/analysis 는 더 가까운 쪽이 먼저 잡으므로 여기까지 오지 않는다.
// GNB 가 없는 자리라 뷰포트 전체를 정렬 기준으로 잡는다 (not-found.tsx 와 같은 이유).
// `error` 는 (main)/error.tsx 와 같은 이유로 화면에 쓰지 않는다 — 사용자에게 스택을 노출하지 않는다.
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FullPageMessage
      role="alert"
      fill="viewport"
      icon={<AlertTriangle size={22} aria-hidden="true" />}
      title="문제가 발생했어요"
      description="잠시 후 다시 시도해 주세요. 계속되면 새로고침해 주세요."
    >
      <Button variant="secondary" size="sm" onClick={reset}>
        다시 시도
      </Button>
    </FullPageMessage>
  );
}
