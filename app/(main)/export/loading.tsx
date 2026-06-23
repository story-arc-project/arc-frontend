export default function ExportLoading() {
  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8" aria-busy="true">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-8 w-1/4 bg-surface-secondary rounded animate-pulse" />
          <div className="h-5 w-2/5 bg-surface-secondary rounded animate-pulse" />
        </div>
        {/* "무엇을 만들까요?" — track cards */}
        <div className="space-y-3">
          <div className="h-6 w-1/3 bg-surface-secondary rounded animate-pulse" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-surface-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
        {/* "최근 만든 레쥬메" — list */}
        <div className="space-y-3">
          <div className="h-6 w-1/4 bg-surface-secondary rounded animate-pulse" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
