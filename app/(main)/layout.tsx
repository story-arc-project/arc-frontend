import { GNB } from "@/components/layout/GNB";
import { AuthGate } from "@/components/features/auth/AuthGate";
import { FeedbackHost } from "@/components/features/feedback/FeedbackHost";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // 라우트 보호는 AuthGate(클라이언트)가 담당한다: 비인증→/login, 미온보딩→/signup. (FRT-11)
  // AuthGate는 /auth/me 조회 실패(네트워크·5xx) 시 깨진 UI 대신 재시도 화면도 노출한다. (FRT-12)
  //
  // FeedbackHost(FRT-95)는 AuthGate **안쪽**이어야 한다 — 인증이 끝난 사용자에게만 노출 기록
  // POST가 나가야 하고, 트리거가 걸리는 화면들(대시보드·아카이브·분석)을 한 번에 덮으면서
  // 라우트 이동에도 살아남는 지점이 여기 하나뿐이다.
  return (
    <>
      <GNB />
      <div className="pt-[var(--gnb-h)]" data-print-root>
        <AuthGate>
          <FeedbackHost>{children}</FeedbackHost>
        </AuthGate>
      </div>
    </>
  );
}
