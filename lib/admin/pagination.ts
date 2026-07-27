// FRT-16: 페이지네이션 계산(리포 최초). 표현형 컴포넌트가 얇게 유지되도록 페이지 창·범위
// 산출은 여기 순수 함수로 두고 TDD 한다.

export interface PageRange {
  /** 전체 페이지 수(최소 1). */
  totalPages: number;
  /** 현재 페이지의 첫 항목 1-based 인덱스(전체 0건이면 0). */
  from: number;
  /** 현재 페이지의 마지막 항목 1-based 인덱스(전체 0건이면 0). */
  to: number;
}

/** 전체 건수·페이지 크기·현재 페이지로 표시 범위("N명 중 A–B")를 산출한다. */
export function getPageRange(
  totalCount: number,
  pageSize: number,
  page: number,
): PageRange {
  const safeSize = pageSize > 0 ? pageSize : 1;
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalCount) / safeSize));
  if (totalCount <= 0) return { totalPages, from: 0, to: 0 };
  const clamped = Math.min(Math.max(1, page), totalPages);
  const from = (clamped - 1) * safeSize + 1;
  const to = Math.min(clamped * safeSize, totalCount);
  return { totalPages, from, to };
}

// 페이지 번호 버튼 창. 현재 페이지 좌우로 span 개씩, 항상 1..totalPages 범위 안. span=2 면
// 최대 5개(현재±2)를 보여준다. 경계에서 개수가 줄지 않게 반대편으로 확장한다.
export function getPageWindow(
  page: number,
  totalPages: number,
  span = 2,
): number[] {
  if (totalPages <= 0) return [];
  const width = span * 2 + 1;
  if (totalPages <= width) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const clamped = Math.min(Math.max(1, page), totalPages);
  let start = clamped - span;
  let end = clamped + span;
  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > totalPages) {
    start -= end - totalPages;
    end = totalPages;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
