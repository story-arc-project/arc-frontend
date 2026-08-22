import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

import type { Block, BlockValue, ExperienceV2 } from "@/types/archive"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks } from "@/lib/utils/block-utils"
import ExperienceDetailV2 from "./ExperienceDetailV2"

/**
 * FRT-71 — 상세뷰 섹션 순서 정리 + 헤더 중복 경험명/요약 제거.
 *
 * - 본문 섹션은 #69 안정키/저장순서를 그대로 사용(라벨매칭 재조립 없음)해
 *   입력 폼(#70)과 동일한 4카드 순서로 렌더한다.
 * - 경험명/한 줄 요약은 헤더가 단독 소유 → 본문 섹션에 중복 표시되지 않는다.
 */

// globals:false 이므로 testing-library 자동 cleanup 이 등록되지 않는다 — 수동 등록.
afterEach(cleanup)

function text(t: string): BlockValue {
  return { type: "text", text: t }
}
function textarea(t: string): BlockValue {
  return { type: "textarea", text: t }
}
function setVal(blocks: Block[], key: string, value: BlockValue): Block[] {
  return blocks.map(b => (b.key === key ? { ...b, value } : b))
}

function careerV2(): ExperienceV2 {
  const tmpl = getTemplateForType("career")
  let core = cloneBlocks(tmpl.commonCore.blocks)
  core = setVal(core, "core.경험명", text("ARC 인턴"))
  core = setVal(core, "core.한 줄 요약", text("백엔드 인턴 경험"))
  core = setVal(core, "core.내 역할/기여도", textarea("API 개발"))
  core = setVal(core, "core.핵심 성과", textarea("응답속도 30% 개선"))

  let ext = cloneBlocks(tmpl.extensions.flatMap(s => s.blocks))
  ext = setVal(ext, "career-info.회사명", text("ARC Inc"))
  ext = setVal(ext, "extended.배경/목표", textarea("성장하고 싶었다"))

  return {
    id: "exp-1",
    userId: "user-1",
    typeId: "career",
    title: "ARC 인턴",
    summary: "백엔드 인턴 경험",
    status: "complete",
    tags: [],
    coreBlocks: core,
    extensionBlocks: ext,
    customBlocks: [],
    hiddenKeys: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  }
}

function renderDetail(experience: ExperienceV2) {
  render(
    <ExperienceDetailV2
      experience={experience}
      onEdit={() => {}}
      onDelete={() => {}}
      onDuplicate={() => {}}
    />,
  )
}

describe("ExperienceDetailV2", () => {
  it("본문 섹션을 저장 순서(폼 4카드 순서)대로 렌더한다", () => {
    renderDetail(careerV2())
    const headings = screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)
    expect(headings).toEqual(["기본 정보", "경험 상세"])
  })

  it("경험명/한 줄 요약은 헤더에만 있고 본문 섹션에 중복되지 않는다", () => {
    renderDetail(careerV2())
    // 제목은 헤더 h2 에 단 한 번만 등장
    expect(screen.getAllByText("ARC 인턴")).toHaveLength(1)
    // 본문 블록 라벨로서의 "경험명"/"한 줄 요약" 은 렌더되지 않는다
    expect(screen.queryByText("경험명")).toBeNull()
    expect(screen.queryByText("한 줄 요약")).toBeNull()
  })

  // 배지는 알약이다 — 좁아지면 통째로 다음 줄로 넘어가야지, 라벨이 음절 중간에서
  // 갈리면 안 된다("인턴 및 업무 경·력"). 대시보드 최근 경험에서 실제로 깨졌던 모양이다.
  it("유형·상태 배지 라벨이 음절 중간에서 갈리지 않는다", () => {
    renderDetail(careerV2())
    expect(screen.getByText("인턴 및 업무 경력")).toHaveClass("whitespace-nowrap")
    expect(screen.getByText("완료")).toHaveClass("whitespace-nowrap")
  })
})
