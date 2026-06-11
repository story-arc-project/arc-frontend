import { GNB } from "@/components/layout/GNB";
import { AuthGate } from "@/components/features/auth/AuthGate";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // 라우트 보호는 AuthGate(클라이언트)가 담당한다: 비인증→/login, 미온보딩→/signup. (FRT-11)
  // AuthGate는 /auth/me 조회 실패(네트워크·5xx) 시 깨진 UI 대신 재시도 화면도 노출한다. (FRT-12)
  return (
    <>
      <GNB />
      <div className="pt-[var(--gnb-h)]" data-print-root>
        <AuthGate>{children}</AuthGate>
      </div>
    </>
  );
}
