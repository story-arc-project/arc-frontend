import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { DemoChrome } from "@/components/demo/DemoChrome";

// 데모 페이지는 클라이언트 상태(useSearchParams 등) 의존성이 있어
// 정적 prerender 를 건너뛰고 요청 시 렌더한다.
export const dynamic = "force-dynamic";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoModeProvider>
      <DemoChrome>{children}</DemoChrome>
    </DemoModeProvider>
  );
}
