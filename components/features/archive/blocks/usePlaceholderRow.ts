"use client"

import { useMemo } from "react"
import type { BlockColumnDef, BlockRow } from "@/types/archive"
import { cellFilled, createEmptyRow } from "@/lib/utils/block-utils"

/**
 * 빈 반복 입력(rows.length===0)에 표시만 하는 행 하나를 파생한다(FRT-103).
 *
 * 이 행은 **value(rows)에 커밋되지 않는다** — 손대지 않은 블록이 상세뷰·포트폴리오에
 * 유령 섹션으로 남지 않게 한다(FRT-97 교훈). FRT-122 이후엔 `isBlockEmpty` 가 빈 셀 행도
 * empty 로 보므로 실체화된 빈 행이 커밋돼도 유령 섹션은 판정 층위에서 걸러진다.
 * 사용자가 실제로 값을 채우는 순간 `materialize` 가 **같은 id 의** 행을 돌려주고, 그 행을 커밋하면
 * 렌더 key 가 그대로라 React 가 리마운트하지 않는다 → 포커스와 한글 IME 조합이 보존된다.
 *
 * 파생은 `useMemo` 로 한다(ref 를 렌더 중에 읽고 쓰면 `react-hooks/refs` 위반):
 * 비어 있는 동안은 같은 id 를 유지하고, 채워졌다가 다시 비면 새 id 를 만든다.
 *
 * ⚠️ useMemo 는 캐시 유지가 보장되는 API 가 아니다(React 가 캐시를 버리면 새 id 가 나온다).
 * 지금의 React 에는 이 컴포넌트가 밟는 폐기 경로가 없어 안전하지만, 리마운트 회귀가 보이면
 * 여기부터 의심할 것 — 보장이 필요해지면 useState + 렌더 중 리셋 패턴으로 바꾼다.
 */
export function usePlaceholderRow(rows: BlockRow[], columns: BlockColumnDef[]) {
  // 컬럼이 없으면 그릴 셀도 없다 — 표시용 행을 만들지 않는다.
  const isEmpty = rows.length === 0 && columns.length > 0
  // columns 가 바뀌면(열 추가·삭제) 새 컬럼에 맞는 빈 셀로 다시 만든다.
  const placeholder = useMemo(
    () => (isEmpty ? createEmptyRow(columns) : null),
    [isEmpty, columns],
  )

  function isPlaceholderRow(id: string): boolean {
    return placeholder !== null && placeholder.id === id
  }

  /** 값이 실제로 채워졌을 때만 커밋할 행을 준다. 빈 값(예: select 의 '선택')으로는 실체화하지 않는다. */
  function materialize(rowId: string, colKey: string, value: string | string[]): BlockRow | null {
    if (!placeholder || !isPlaceholderRow(rowId) || !cellFilled(value)) return null
    return { ...placeholder, cells: { ...placeholder.cells, [colKey]: value } }
  }

  return {
    displayRows: placeholder ? [placeholder] : rows,
    /**
     * 표시용 행을 그리는 중인가. '추가' 버튼은 **이때만** 숨긴다 — 이미 빈 줄이 있어서다.
     * `rows.length === 0` 으로 대신 판정하면 안 된다: 컬럼이 없어 placeholder 를 못 만드는
     * 블록에서 빈 줄도 버튼도 없는 막다른 길이 된다.
     */
    hasPlaceholder: placeholder !== null,
    isPlaceholderRow,
    materialize,
    placeholder,
  }
}
