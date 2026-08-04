"use client"

import { createContext, useContext } from "react"

/**
 * 역할 이력 → 역할 태그 파생·동기화 (FRT-178)를 위한 교차-블록 배선.
 *
 * 동아리 확정본에서 ② 개조식 각 행과 ③ 반복 블록 첫 컬럼의 태그 **선택지가 상수가 아니라**
 * ① '역할 이력' 블록의 값에서 나온다. 블록은 자기 값만 알고 형제를 모르므로, 폼 최상위
 * (ExperienceFormV2)가 provider 로 아래 3개만 공급하고 RoleChips 가 소비한다 —
 * FRT-76 ProjectLinkContext 와 같은 규약이다.
 *
 * - 각 행의 `roleTags` 세팅/해제는 소비 블록이 자기 onChange 로 직접 한다.
 * - 여기서는 "등록된 역할 목록 공급 / 이름 변경·삭제를 전 블록에 전파"만 담당한다.
 */
export interface RoleHistoryContextValue {
  /** ① '역할 이력'에 등록된 역할명(입력 순서, 공백·중복 제거). */
  roles: string[]
  /**
   * 역할명이 바뀌었을 때 폼 안 모든 태그에서 `from` → `to` 로 치환한다.
   * `to` 가 빈 문자열이면(이름을 지워 빈 칸이 된 경우) `removeRole` 과 같게 동작한다.
   */
  renameRole: (from: string, to: string) => void
  /** 역할 행이 삭제됐을 때 폼 안 모든 태그에서 그 이름을 제거한다. */
  removeRole: (name: string) => void
}

/** provider 밖(readOnly 상세뷰·스토리북·단위테스트)에서는 null → 칩은 읽기 전용 뱃지로만 렌더된다. */
const RoleHistoryContext = createContext<RoleHistoryContextValue | null>(null)

export const RoleHistoryProvider = RoleHistoryContext.Provider

export function useRoleHistory(): RoleHistoryContextValue | null {
  return useContext(RoleHistoryContext)
}
