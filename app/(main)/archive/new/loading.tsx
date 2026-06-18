export default function ArchiveNewLoading() {
  return (
    <div className="flex flex-col animate-pulse">
      {/* sticky 액션 바 자리 */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <div className="h-5 w-20 rounded bg-border" />
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-md bg-border" />
          <div className="h-8 w-16 rounded-md bg-border" />
        </div>
      </div>
      {/* 폼 영역 자리 */}
      <div className="max-w-[640px] mx-auto w-full px-5 py-10 flex flex-col gap-4">
        <div className="h-8 w-2/3 rounded bg-border" />
        <div className="h-5 w-1/2 rounded bg-border" />
        <div className="h-24 rounded-md bg-border mt-4" />
        <div className="h-24 rounded-md bg-border" />
      </div>
    </div>
  )
}
