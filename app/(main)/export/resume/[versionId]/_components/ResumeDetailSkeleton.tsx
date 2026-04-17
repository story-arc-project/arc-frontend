"use client";

export function ResumeDetailSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="sticky top-[var(--gnb-h)] z-40 h-14 border-b border-border bg-surface/90 backdrop-blur-sm" />
      <div className="flex min-h-[calc(100dvh-var(--gnb-h)-3.5rem)] flex-col md:flex-row">
        <aside className="w-full border-b border-border p-6 md:w-2/5 md:border-b-0 md:border-r">
          <div className="space-y-4">
            <div className="h-7 w-40 rounded bg-surface-tertiary animate-pulse" />
            <div className="h-20 rounded-lg bg-surface-tertiary animate-pulse" />
            <div className="h-14 rounded-lg bg-surface-tertiary animate-pulse" />
            <div className="h-14 rounded-lg bg-surface-tertiary animate-pulse" />
            <div className="h-14 rounded-lg bg-surface-tertiary animate-pulse" />
          </div>
        </aside>
        <main className="flex-1 bg-surface-secondary p-6">
          <div className="mx-auto max-w-[210mm] bg-surface rounded shadow-sm p-10">
            <div className="h-10 w-48 rounded bg-surface-tertiary animate-pulse" />
            <div className="mt-3 h-5 w-64 rounded bg-surface-tertiary animate-pulse" />
            <div className="mt-8 space-y-3">
              <div className="h-5 w-32 rounded bg-surface-tertiary animate-pulse" />
              <div className="h-4 w-full rounded bg-surface-tertiary animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-surface-tertiary animate-pulse" />
            </div>
            <div className="mt-8 space-y-3">
              <div className="h-5 w-32 rounded bg-surface-tertiary animate-pulse" />
              <div className="h-4 w-full rounded bg-surface-tertiary animate-pulse" />
              <div className="h-4 w-3/5 rounded bg-surface-tertiary animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
