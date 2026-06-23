export default function AnalysisLoading() {
  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-6" aria-busy="true">
        {/* Header */}
        <div className="h-8 w-2/5 bg-surface-secondary rounded animate-pulse" />
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </main>
  );
}
