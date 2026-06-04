import { GNB } from "@/components/layout/GNB";
import { AuthGate } from "@/components/features/auth/AuthGate";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // Route protection is handled via httpOnly cookie check in proxy.ts.
  // AuthGate는 /auth/me 조회 실패(네트워크·5xx) 시 깨진 UI 대신 재시도 화면을 노출한다. (FRT-12)
  return (
    <>
      <GNB />
      <div className="pt-[var(--gnb-h)]" data-print-root>
        <AuthGate>{children}</AuthGate>
      </div>
    </>
  );
}
