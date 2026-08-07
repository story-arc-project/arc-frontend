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
  /**
   * 역방향 조회 — 이 행을 가리키는 OutcomeList 소스 행이 있는지(FRT-210).
   * 있으면 그 소스 **블록의 라벨**을 돌려준다("주요 경험에서 연결됨" 배지 문구가 된다).
   *
   * ⚠️ 링크의 진실은 `linkedProjectRowId` 로 **소스 행 한쪽에만** 있다(types/archive.ts).
   * 대상 행에 역방향 필드를 저장하면 연결 해제·행 삭제 때 양쪽 갱신이 어긋나므로, 대상 쪽은
   * 저장하지 않고 조회만 한다. 폼 전체를 훑는 비용은 provider 가 한 번만 치르고(역인덱스),
   * 각 행은 Map 조회만 한다 — 행마다 훑으면 O(행 수 × 블록 수)가 된다.
   *
   * 문구를 `ProjectLinkConfig` 에 따로 두지 않는 이유: 원하는 문구가 이미 소스 블록의 label
   * 과 같다(동아리 '주요 활동 / 이벤트', 어학 '주요 경험'). 설정 필드를 만들면 라벨만 바뀌고
   * 배지 문구는 옛날 그대로인 동기화 버그가 하나 더 생긴다.
   */
  getIncomingLink: (rowId: string) => { sourceLabel: string } | null
  /** 프로젝트 행으로 스크롤(전역 유일 data-row-id 기준). */
  scrollToProjectRow: (projectRowId: string) => void
}

/** provider 밖(readOnly 상세뷰·스토리북·단위테스트)에서는 null → 링크 UI 미노출. */
const ProjectLinkContext = createContext<ProjectLinkContextValue | null>(null)

export const ProjectLinkProvider = ProjectLinkContext.Provider

export function useProjectLink(): ProjectLinkContextValue | null {
  return useContext(ProjectLinkContext)
}
