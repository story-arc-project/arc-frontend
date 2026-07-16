export default function DashboardLoading() {
  return (
    <main className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-6" aria-busy="true">
        {/* Header */}
        <div className="h-8 w-2/5 bg-surface-secondary rounded animate-pulse" />
        <div className="h-5 w-1/4 bg-surface-secondary rounded animate-pulse" />
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Type distribution + recent experiences */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="h-56 bg-surface-secondary rounded-xl animate-pulse" />
          <div className="h-56 bg-surface-secondary rounded-xl animate-pulse" />
        </div>
        {/* Recent analysis */}
        <div className="h-6 w-1/5 bg-surface-secondary rounded animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
