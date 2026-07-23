import { Search, X } from "lucide-react";

interface CustomerSearchBarProps {
  /** 현재 입력값(제어 컴포넌트). */
  value: string;
  onChange: (value: string) => void;
}

// FRT-16: 고객 검색 입력(이메일/이름). flag-agnostic 표현형 — 디바운스·URL 반영은 호출부(페이지)
// 몫이고, 여기선 값과 변경 콜백만 다룬다.
export function CustomerSearchBar({ value, onChange }: CustomerSearchBarProps) {
  return (
    <div className="relative w-full max-w-sm">
      <Search
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="이메일 또는 이름으로 고객 검색"
        placeholder="이메일 또는 이름으로 검색"
        className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-10 text-body text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
