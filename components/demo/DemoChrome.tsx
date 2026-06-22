"use client";

import { usePathname } from "next/navigation";

import { DemoGNB } from "./DemoGNB";
import { DemoTourModal } from "./DemoTourModal";

/**
 * 데모 공통 크롬(GNB·투어)을 렌더한다.
 * 단, /demo/portfolio 하위는 독립 발행물(e-포트폴리오) 룩이므로 크롬을 숨긴다.
 */
export function DemoChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isPortfolio = pathname.startsWith("/demo/portfolio");

  if (isPortfolio) {
    return <>{children}</>;
  }

  return (
    <>
      <DemoGNB />
      <div className="pt-[var(--gnb-h)]">{children}</div>
      <DemoTourModal />
    </>
  );
}
