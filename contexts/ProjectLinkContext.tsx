"use client"

import { createContext, useContext } from "react"

/**
 * intra-experience '프로젝트로 연결' 링크 (FRT-76)를 위한 교차-섹션 배선.
 *
 * OutcomeList(경험 상세)의 활동 행은 자기 블록만 알고 형제 섹션(프로젝트 기록)을 모른다.
 * BlockRenderer/BlockList 는 자기완결형이라 콜백을 내릴 prop 경로가 없으므로, 폼 최상위
 * (ExperienceFormV2)가 provider 로 아래 3개 능력만 공급하고 OutcomeList 가 소비한다.
 *
 * - 활동 행 자체의 `linkedProjectRowId` 세팅/해제는 OutcomeList 가 자기 onChange 로 직접 한다.
 * - 여기서는 "다른 섹션에 프로젝트 행 생성 / 존재·제목 조회 / 그 행으로 스크롤"만 담당한다.
 */
export interface ProjectLinkContextValue {
  /**
   * `targetSectionId` 의 (첫) repeatable-cell 블록에 행을 append 하고 `titleColumnKey`
   * 컬럼에 활동 텍스트를 채운다. 새 프로젝트 행 id 를 동기 반환(대상 섹션 없으면 null).
   */
  createProjectRow: (targetSectionId: string, titleColumnKey: string, text: string) => string | null
  /**
   * 대상 프로젝트 행의 존재·제목 조회. 없으면 null(soft link stale 판정).
   *
   * ⚠️ `titleColumnKey` 를 반드시 함께 받는다 — 제목을 `columns[0]` 에서 읽으면 안 된다.
   * 쓰기(`createProjectRow`)는 `titleColumnKey` 컬럼에 넣으므로, 읽기가 첫 컬럼을 보면
   * "제목 컬럼이 곧 첫 컬럼"이라는 우연에 기대게 된다. 동아리 ③ 은 첫 컬럼이 역할 칩이라
   * 그 전제가 깨지고, 제목 자리에 역할 태그가 나온다(FRT-178).
   */
  getProjectRow: (
    targetSectionId: string,
    titleColumnKey: string,
    projectRowId: string,
  ) => { title: string } | null
  /** 프로젝트 행으로 스크롤(전역 유일 data-row-id 기준). */
  scrollToProjectRow: (projectRowId: string) => void
}

/** provider 밖(readOnly 상세뷰·스토리북·단위테스트)에서는 null → 링크 UI 미노출. */
const ProjectLinkContext = createContext<ProjectLinkContextValue | null>(null)

export const ProjectLinkProvider = ProjectLinkContext.Provider

export function useProjectLink(): ProjectLinkContextValue | null {
  return useContext(ProjectLinkContext)
}
