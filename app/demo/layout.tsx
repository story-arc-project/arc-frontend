import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DemoTourModal } from "@/components/demo/DemoTourModal";

// 데모 페이지는 클라이언트 상태(useSearchParams 등) 의존성이 있어
// 정적 prerender 를 건너뛰고 요청 시 렌더한다.
export const dynamic = "force-dynamic";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeProvider>
      <DemoBanner />
      <div className="min-h-[calc(100dvh-2.5rem)]">{children}</div>
      <DemoTourModal />
    </DemoModeProvider>
  );
}
