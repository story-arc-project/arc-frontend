import { ChevronLeft, ChevronRight } from "lucide-react";

import { getPageRange, getPageWindow } from "@/lib/admin/pagination";

interface PaginationProps {
  /** 1-based 현재 페이지. */
  page: number;
  pageSize: number;
  /** 검색 조건 전체 건수. */
  totalCount: number;
  onPageChange: (page: number) => void;
  /** 항목 단위 명칭(예: "명"). 범위 요약에 쓴다. */
  unit?: string;
}

// FRT-16: 페이지 번호 네비(리포 최초). "N{unit} 중 A–B" 요약 + 이전/다음 + 번호 창.
// 페이지가 1개뿐이면 네비는 감추고 요약만 남긴다. 계산은 lib/admin/pagination(순수·TDD).
export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  unit = "명",
}: PaginationProps) {
  const { totalPages, from, to } = getPageRange(totalCount, pageSize, page);
  const current = Math.min(Math.max(1, page), totalPages);
  const pages = getPageWindow(current, totalPages);

  return (
    <nav
      aria-label="페이지네이션"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body-sm text-text-tertiary" aria-live="polite">
        {totalCount > 0 ? (
          <>
            총 {totalCount.toLocaleString("ko-KR")}
            {unit} 중 {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")}
          </>
        ) : (
          <>총 0{unit}</>
        )}
      </p>

      {totalPages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <button
              type="button"
              onClick={() => onPageChange(current - 1)}
              disabled={current <= 1}
              aria-label="이전 페이지"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          </li>
          {pages.map((p) => {
            const active = p === current;
            return (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    active
                      ? "border-brand bg-surface-brand font-semibold text-brand"
                      : "border-border text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
                  ].join(" ")}
                >
                  {p}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => onPageChange(current + 1)}
              disabled={current >= totalPages}
              aria-label="다음 페이지"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
