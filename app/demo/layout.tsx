import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { DemoGNB } from "@/components/demo/DemoGNB";
import { DemoTourModal } from "@/components/demo/DemoTourModal";

// 데모 페이지는 클라이언트 상태(useSearchParams 등) 의존성이 있어
// 정적 prerender 를 건너뛰고 요청 시 렌더한다.
export const dynamic = "force-dynamic";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeProvider>
      <DemoGNB />
      <div className="pt-[var(--gnb-h)]">{children}</div>
      <DemoTourModal />
    </DemoModeProvider>
  );
}
