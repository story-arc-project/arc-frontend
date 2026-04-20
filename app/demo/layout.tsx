import { GNB } from "@/components/layout/GNB";
import DemoBanner from "./_components/DemoBanner";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GNB />
      <div className="pt-[var(--gnb-h)]" data-print-root>
        <DemoBanner />
        {children}
      </div>
    </>
  );
}
