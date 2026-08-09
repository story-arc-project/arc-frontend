"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { addBookmark, removeBookmark } from "@/lib/api/analysis-api";
import { useBasePath } from "@/lib/utils/use-base-path";

interface BookmarkToggleProps {
  analysisId: string;
  isBookmarked: boolean;
  onToggled?: (next: boolean) => void;
  size?: "sm" | "md";
}

const sizeMap = { sm: 16, md: 20 };

export default function BookmarkToggle({
  analysisId,
  isBookmarked: initialBookmarked,
  onToggled,
  size = "md",
}: BookmarkToggleProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [busy, setBusy] = useState(false);
  const basePath = useBasePath();

  // 부모 items 가 loadData 재호출로 갱신되면 서버 상태와 동기화한다.
  // (없으면 동일 key 인스턴스가 stale 상태를 유지 — FRT-55)
  useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [initialBookmarked]);

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    const next = !bookmarked;
    try {
      if (next) {
        await addBookmark(analysisId);
      } else {
        await removeBookmark(analysisId);
      }
      setBookmarked(next);
      onToggled?.(next);
    } catch {
      // silently revert — API error
    } finally {
      setBusy(false);
    }
  }

  // 데모(basePath 있음)에는 즐겨찾기를 담아 둘 곳이 없다 — 분석 영역은 아카이브와 달리
  // 인메모리 store 없이 고정 mock(lib/api/mocks/analysis.ts)을 돌려주므로, 눌러도 화면에서만
  // 바뀌고 재조회하면 되살아난다. 되돌아올 성공을 보여주느니 버튼 자체를 내보내지 않는다(FRT-232).
  // 호출부가 10곳이라 판정을 여기 한 곳에 둔다 — 노출 여부는 분석 유형과 무관하게 늘 같다.
  if (basePath) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleToggle();
      }}
      disabled={busy}
      className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-colors hover:bg-surface-tertiary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      aria-label={bookmarked ? "즐겨찾기 해제" : "즐겨찾기"}
    >
      <Star
        size={sizeMap[size]}
        className={
          bookmarked
            ? "fill-warning text-warning"
            : "text-text-tertiary"
        }
      />
    </button>
  );
}
