"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { addBookmark, removeBookmark } from "@/lib/analysis-api";

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
