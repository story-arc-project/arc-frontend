export default function ArchiveLoading() {
  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-60 flex-shrink-0 border-r border-border bg-surface-secondary flex flex-col gap-2 p-3">
        <div className="h-8 rounded-md bg-border" />
        <div className="h-px bg-border my-1" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-6 rounded bg-border" />
            {[0, 1].map((j) => (
              <div key={j} className="ml-3 h-14 rounded-md bg-border" />
            ))}
          </div>
        ))}
      </div>

      {/* Right panel skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-border" />
      </div>
    </div>
  );
}
