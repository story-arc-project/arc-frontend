"use client";

import { Star } from "lucide-react";

interface BookmarkToggleProps {
  isBookmarked: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}

const sizeMap = { sm: 16, md: 20 };

export default function BookmarkToggle({
  isBookmarked,
  onToggle,
  size = "md",
}: BookmarkToggleProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="p-1 rounded-md transition-colors hover:bg-surface-tertiary"
      aria-label={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기"}
    >
      <Star
        size={sizeMap[size]}
        className={
          isBookmarked
            ? "fill-warning text-warning"
            : "text-text-tertiary"
        }
      />
    </button>
  );
}
