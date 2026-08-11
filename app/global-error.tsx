"use client";

import { AlertTriangle } from "lucide-react";
import { Button, FullPageMessage } from "@/components/ui";
import "./globals.css";

/**
 * 루트 레이아웃(app/layout.tsx) 자체와 그 안의 PostHogProvider·AuthProvider 가 던진 예외를
 * 잡는 마지막 경계. 세그먼트 error.tsx 는 layout 이 넘기는 {children} 하위만 감싸는데
 * Provider 들은 그 {children} 을 감싸는 *조상* 이라 어떤 error.tsx 도 잡지 못한다.
 * 그래서 이 파일이 루트 레이아웃을 통째로 대체하며 <html>/<body> 를 처음부터 다시 그린다 —
 * layout.tsx 의 폰트 <link> 와 globals.css 가 따라오지 않으므로 여기서 다시 선언한다.
 *
 * reset() 이 아니라 전체 리로드를 쓴다: 루트 레이아웃 초기화 실패는 대개 결정론적이라
 * reset() 은 같은 렌더를 재시도해 즉시 재발한다(Next 기본 global-error 도 같은 이유로
 * reset 을 쓰지 않는다). 앱 안의 다른 경로로 보내는 버튼도 두지 않는다 — 어느 화면이든
 * 같은 루트 레이아웃 아래라 같은 크래시가 재발한다.
 *
 * `error` 는 다른 error.tsx 들과 같이 화면에 노출하지 않는다.
 * 원인은 브라우저 콘솔(클라이언트)과 Vercel 런타임 로그(서버)에 남는다.
 */
// Next 가 넘기는 error·reset 은 둘 다 쓰지 않지만(위 주석 참고) 계약은 명시해 둔다.
export default function GlobalError({}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <title>ARC</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <FullPageMessage
          role="alert"
          fill="viewport"
          icon={<AlertTriangle size={22} aria-hidden="true" />}
          title="문제가 발생했어요"
          description="새로고침해도 계속 문제가 발생하면 잠시 후 다시 시도해 주세요."
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
          >
            새로고침
          </Button>
        </FullPageMessage>
      </body>
    </html>
  );
}
