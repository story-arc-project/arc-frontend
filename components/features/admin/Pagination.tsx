import { ChevronLeft, ChevronRight } from "lucide-react";

import { getPageRange, getPageWindow } from "@/lib/admin/pagination";

interface PaginationProps {
  /** 1-based 현재 페이지. */
  page: number;
  pageSize: number;
  /**
   * 검색 조건 전체 건수. **null 이면 미상**(서버가 count 를 안 준 경우) — 총계를 지어내지 않고
   * 현재 범위만 보여주며, 다음 페이지 존재는 pageItemCount 로 판단한다.
   */
  totalCount: number | null;
  /** 현재 페이지에 실제로 실린 항목 수. 총계 미상일 때 "다음 페이지가 있는가"의 유일한 단서다. */
  pageItemCount?: number;
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
  pageItemCount = 0,
  onPageChange,
  unit = "명",
}: PaginationProps) {
  // 총계를 아는 경우와 모르는 경우로 갈린다. 모를 땐 페이지 수를 계산할 수 없으므로 번호 창을
  // 접고 이전/다음만 남긴다 — 꽉 찬 페이지면 다음이 더 있을 수 있으니 열어 둬야 결과가 묻히지
  // 않는다(추측 총계로 마지막 페이지인 척하면 그 뒤가 통째로 도달 불가능해진다, Codex P2).
  const range =
    totalCount === null ? null : getPageRange(totalCount, pageSize, page);

  const totalPages = range?.totalPages ?? 0;
  const current = range
    ? Math.min(Math.max(1, page), totalPages)
    : Math.max(1, page);

  const unknownFrom = pageItemCount > 0 ? (current - 1) * pageSize + 1 : 0;
  const from = range ? range.from : unknownFrom;
  const to = range
    ? range.to
    : unknownFrom > 0
      ? unknownFrom + pageItemCount - 1
      : 0;

  const pages = range ? getPageWindow(current, totalPages) : [];
  const hasPrev = current > 1;
  const hasNext = range ? current < totalPages : pageItemCount >= pageSize;
  const showNav = range ? totalPages > 1 : hasPrev || hasNext;

  return (
    <nav
      aria-label="페이지네이션"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body-sm text-text-tertiary" aria-live="polite">
        {totalCount === null ? (
          // 총계를 모를 땐 아는 것만 말한다 — 지어낸 숫자를 총계로 보여주지 않는다.
          to > 0 ? (
            <>
              {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")}
              번째 표시 중
            </>
          ) : (
            <>표시할 항목 없음</>
          )
        ) : totalCount > 0 ? (
          <>
            총 {totalCount.toLocaleString("ko-KR")}
            {unit} 중 {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")}
          </>
        ) : (
          <>총 0{unit}</>
        )}
      </p>

      {showNav && (
        <ul className="flex items-center gap-1">
          <li>
            <button
              type="button"
              onClick={() => onPageChange(current - 1)}
              disabled={!hasPrev}
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
              disabled={!hasNext}
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
