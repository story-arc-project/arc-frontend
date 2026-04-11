import AnalysisSNB from "@/components/features/analysis/AnalysisSNB";

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-var(--gnb-h))] overflow-hidden">
      <AnalysisSNB />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
