export default function ArchiveLoading() {
  return (
    <>
      {/* Desktop skeleton (lg+) */}
      <div className="hidden lg:flex h-[calc(100dvh-var(--gnb-h))] overflow-hidden animate-pulse">
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
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-border" />
        </div>
      </div>

      {/* Mobile skeleton (<lg) */}
      <div className="lg:hidden h-[calc(100dvh-var(--gnb-h))] overflow-hidden animate-pulse bg-surface-secondary">
        <div className="px-2.5 pt-3 pb-2.5 border-b border-border">
          <div className="h-8 rounded-md bg-border" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-6 rounded bg-border" />
              {[0, 1].map((j) => (
                <div key={j} className="ml-3 h-14 rounded-md bg-border" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
