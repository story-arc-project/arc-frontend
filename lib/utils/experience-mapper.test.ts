import { describe, expect, it } from "vitest"
import type {
  Block,
  BlockValue,
  CustomEntry,
  ExperienceV2,
  RepeatableCellBlockValue,
  SingleSelectBlockValue,
} from "@/types/archive"
import type { Experience } from "@/types/experience"
import { getTemplateForType, TEMPLATE_VERSION } from "@/lib/constants/templates-v2"
import {
  toExperienceV2,
  toSavePayload,
} from "@/lib/utils/experience-mapper"
import { cloneBlocks, createGroupBlock, createTextField, isBlockEmpty } from "@/lib/utils/block-utils"
import { computeFormCards } from "@/lib/utils/form-cards"
import { SECTION_LABEL_OVERRIDES } from "@/types/archive"

function makeExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: "exp-1",
    user_id: "user-1",
    type: "career",
    importance: null,
    content: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    ...overrides,
  }
}

function text(t: string): BlockValue {
  return { type: "text", text: t }
}
function textarea(t: string): BlockValue {
  return { type: "textarea", text: t }
}

/** career 템플릿에서 키를 가진 core/extension 블록 배열을 만든다(폼 로드 결과 모사). */
function careerBlocks(): { coreBlocks: Block[]; extensionBlocks: Block[] } {
  const tmpl = getTemplateForType("career")
  return {
    coreBlocks: tmpl.commonCore.blocks,
    extensionBlocks: tmpl.extensions.flatMap(s => s.blocks),
  }
}

function makeExperienceV2(overrides: Partial<ExperienceV2> = {}): ExperienceV2 {
  return {
    id: "exp-1",
    userId: "user-1",
    typeId: "career",
    title: "타이틀",
    summary: "요약",
    status: "draft",
    tags: ["a"],
    importance: 4,
    coreBlocks: [],
    extensionBlocks: [],
    customBlocks: [],
    hiddenKeys: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    ...overrides,
  }
}

describe("toExperienceV2", () => {
  it("content 가 비어 있으면(v1 빈 레코드) 모든 필드를 안전 기본값으로 채운다", () => {
    const v2 = toExperienceV2(makeExperience({ content: {} }))
    expect(v2).toMatchObject({
      id: "exp-1",
      userId: "user-1",
      typeId: "career",
      title: "",
      summary: "",
      status: "draft",
      tags: [],
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
    })
    expect(v2.importance).toBeUndefined()
  })

  it("content 가 null/undefined 여도 throw 없이 기본값을 반환한다", () => {
    const v2 = toExperienceV2(
      makeExperience({ content: undefined as unknown as Experience["content"] }),
    )
    expect(v2.title).toBe("")
    expect(v2.coreBlocks).toEqual([])
  })

  it("v1 레거시: snake_case 매핑 + content 스칼라 보존", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          title: "프로젝트 X",
          summary: "한 줄 요약",
          status: "complete",
          tags: ["리더십", "협업"],
        },
        importance: 3,
      }),
    )
    expect(v2.userId).toBe("user-1")
    expect(v2.title).toBe("프로젝트 X")
    expect(v2.summary).toBe("한 줄 요약")
    expect(v2.status).toBe("complete")
    expect(v2.tags).toEqual(["리더십", "협업"])
    expect(v2.importance).toBe(3)
  })

  it("importance 경계: 유효 정수 1~5 만 통과시키고 그 외는 undefined", () => {
    expect(toExperienceV2(makeExperience({ importance: 1 })).importance).toBe(1)
    expect(toExperienceV2(makeExperience({ importance: 5 })).importance).toBe(5)
    expect(toExperienceV2(makeExperience({ importance: 0 })).importance).toBeUndefined()
    expect(toExperienceV2(makeExperience({ importance: 6 })).importance).toBeUndefined()
    expect(toExperienceV2(makeExperience({ importance: 2.5 })).importance).toBeUndefined()
    expect(toExperienceV2(makeExperience({ importance: null })).importance).toBeUndefined()
  })

  it("v1 레거시: 모호한 라벨(여러 섹션 중복)은 안정키를 주입하지 않는다 (Codex P1 회귀)", () => {
    // extracurricular: extended.결과/성과(textarea) vs extra-detail.결과/성과(repeatable-cell)
    const v2 = toExperienceV2(
      makeExperience({
        type: "extracurricular",
        content: {
          title: "T",
          summary: "",
          status: "draft",
          tags: [],
          coreBlocks: [],
          extensionBlocks: [
            {
              id: "x1",
              type: "repeatable-cell",
              label: "결과/성과",
              value: { type: "repeatable-cell", columns: [], rows: [{ id: "r1", cells: {} }] },
            },
          ],
          customBlocks: [],
        },
      }),
    )
    // 모호 라벨 → unkeyed (custom 으로 보존 유도, 타입 충돌 손상 방지)
    expect(v2.extensionBlocks.find(b => b.label === "결과/성과")?.key).toBeUndefined()
  })

  it("v2: fields 값 타입이 블록 타입과 다르면 주입을 생략한다 (손상 방지)", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "T",
          summary: "",
          status: "draft",
          tags: [],
          // core.핵심 성과 는 textarea 인데 text 값이 들어온 손상 케이스
          fields: { "core.핵심 성과": { type: "text", text: "wrong" } },
          custom: [],
        },
      }),
    )
    // 템플릿 기본 타입(textarea) 유지 — text 값 주입 생략
    expect(v2.coreBlocks.find(b => b.key === "core.핵심 성과")?.value.type).toBe("textarea")
  })

  it("v1 레거시: 저장된 블록 배열에 레지스트리 라벨매칭으로 안정키를 주입한다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          title: "T",
          summary: "S",
          status: "draft",
          tags: [],
          coreBlocks: [
            { id: "b1", type: "text", label: "경험명", value: text("T") },
            { id: "b2", type: "textarea", label: "핵심 성과", value: textarea("성과!") },
          ],
          extensionBlocks: [
            { id: "b3", type: "text", label: "회사명", value: text("ARC") },
          ],
          customBlocks: [],
        },
      }),
    )
    expect(v2.coreBlocks.find(b => b.label === "핵심 성과")?.key).toBe("core.핵심 성과")
    expect(v2.extensionBlocks.find(b => b.label === "회사명")?.key).toBe("career-info.회사명")
  })

  it("v2: fields 맵을 레지스트리 순서대로 블록으로 재구성하고 title/summary 를 헤더 블록에 주입한다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "v2 타이틀",
          summary: "v2 요약",
          status: "complete",
          tags: ["t"],
          fields: {
            "core.핵심 성과": textarea("성과 v2"),
            "career-info.회사명": text("ARC Inc"),
          },
          custom: [],
        },
        importance: 5,
      }),
    )
    expect(v2.title).toBe("v2 타이틀")
    expect(v2.summary).toBe("v2 요약")
    expect(v2.status).toBe("complete")
    expect(v2.importance).toBe(5)
    // 헤더 값이 core 경험명/요약 블록에 주입됨
    expect(v2.coreBlocks.find(b => b.key === "core.경험명")?.value).toEqual(text("v2 타이틀"))
    expect(v2.coreBlocks.find(b => b.key === "core.한 줄 요약")?.value).toEqual(text("v2 요약"))
    // fields 값 주입
    expect(v2.coreBlocks.find(b => b.key === "core.핵심 성과")?.value).toEqual(textarea("성과 v2"))
    expect(v2.extensionBlocks.find(b => b.key === "career-info.회사명")?.value).toEqual(text("ARC Inc"))
    // 모든 템플릿 블록에 key 가 존재
    expect(v2.coreBlocks.every(b => !!b.key)).toBe(true)
    expect(v2.extensionBlocks.every(b => !!b.key)).toBe(true)
  })

  it("v2: custom[] field 항목을 customBlocks 로 복원한다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "T",
          summary: "",
          status: "draft",
          tags: [],
          fields: {},
          custom: [
            { key: "custom-1", entryType: "field", type: "text", label: "나만의 메모", value: text("hi") },
          ],
        },
      }),
    )
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0]).toMatchObject({ key: "custom-1", label: "나만의 메모", type: "text" })
    expect(v2.customBlocks[0].value).toEqual(text("hi"))
  })

  it("v2: text 로 저장된 값을 textarea 로 바뀐 블록에 그대로 싣는다(FRT-135 협업/팀원)", () => {
    // 문서 확정본에 맞춰 career-detail.협업 / 팀원 이 text → textarea 가 됐다. 두 값 모양이
    // {type,text} 로 같은데도 타입 불일치로 주입을 건너뛰면, 그 키는 이미 consumedKeys 라
    // orphan 보존도 안 되고 재저장 때 빈 값으로 덮여 무음 손실이 난다.
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "인턴",
          summary: "",
          status: "complete",
          tags: [],
          fields: { "career-detail.협업 / 팀원": text("팀장 1명, 인턴 2명") },
          custom: [],
        },
      }),
    )
    const block = v2.extensionBlocks.find(b => b.key === "career-detail.협업 / 팀원")
    // 블록 타입은 템플릿(textarea)을 따르고, 텍스트는 보존된다.
    expect(block?.type).toBe("textarea")
    expect(block?.value).toEqual(textarea("팀장 1명, 인턴 2명"))
    // consumedKeys 에 잡힌 키이므로 custom 으로 중복 보존되지 않는다.
    expect(v2.customBlocks.find(b => b.key === "career-detail.협업 / 팀원")).toBeUndefined()
  })

  it("v2: 현재 템플릿에 없는 orphan fields 값을 custom 블록으로 보존한다(구 템플릿 개편)", () => {
    // 학회 개편(FRT-90 3차)으로 society-info.지원 동기 → society-detail.참여 동기 이동,
    // 범용 extended.배경/목표 제거. 기존 레코드의 그 값들이 소실되지 않아야 한다.
    const v2 = toExperienceV2(
      makeExperience({
        type: "academic-society",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "AI 학회",
          summary: "",
          status: "complete",
          tags: [],
          fields: {
            "society-info.지원 동기": textarea("옛 지원 동기 텍스트"),
            "extended.배경/목표": textarea("옛 배경/목표"),
          },
          custom: [],
        },
      }),
    )
    // 두 orphan 값이 customBlocks 로 보존되고 키·값이 유지된다.
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)
    expect(byKey("society-info.지원 동기")?.value).toEqual(textarea("옛 지원 동기 텍스트"))
    expect(byKey("extended.배경/목표")?.value).toEqual(textarea("옛 배경/목표"))
    // 라벨은 키의 label 부분으로 복원된다.
    expect(byKey("society-info.지원 동기")?.label).toBe("지원 동기")
  })

  it("v2: 인턴·수업·대외활동 개편(2026-07)으로 이동·제거된 구 필드 값도 유형 무관하게 보존한다", () => {
    // orphanFieldsToBlocks 는 유형 무관 안전망 — 구 career/education/extracurricular 레코드의
    // 사라진 키(재직기간·업무내용·수업 기록·담당 업무 등) 값이 소실되지 않아야 한다.
    const cases: {
      type: "career" | "education" | "extracurricular" | "academic-society"
      key: string
    }[] = [
      { type: "career", key: "career-info.재직기간" },
      { type: "career", key: "career-tasks.업무내용" },
      { type: "education", key: "edu-courses.수업 기록" },
      { type: "extracurricular", key: "extra-detail.담당 업무/미션" },
      // FRT-135 로 문서 확정본에서 사라진 필드들 — 학년(→이수 연도)·상태·활동 인증서(→활동 증빙).
      { type: "education", key: "edu-info.학년" },
      { type: "career", key: "career-info.상태" },
      { type: "academic-society", key: "society-info.활동 인증서" },
    ]
    for (const { type, key } of cases) {
      const v2 = toExperienceV2(
        makeExperience({
          type,
          content: {
            schema_version: 2,
            template_version: TEMPLATE_VERSION,
            title: "구 레코드",
            summary: "",
            status: "complete",
            tags: [],
            fields: { [key]: textarea("옛 값") },
            custom: [],
          },
        }),
      )
      expect(v2.customBlocks.find(b => b.key === key)?.value, `${type}/${key}`).toEqual(
        textarea("옛 값"),
      )
    }
  })

  it("v2: FRT-177 로 폐기된 대외활동 '가장 중요했던 경험'(표 값)도 custom 으로 보존된다", () => {
    // 확정본 정렬로 ② 가 개조식 2종 + 태그로 바뀌며 이 반복 블록이 사라졌다. 값이 있는
    // 구 레코드는 표 값 통째로 '기타' 카드에 남아야 한다(무음 손실 금지).
    const oldCell = {
      type: "repeatable-cell" as const,
      columns: [
        { key: "title", label: "소제목", blockType: "text" as const },
        { key: "detail", label: "설명", blockType: "textarea" as const },
      ],
      rows: [{ id: "row-1", cells: { title: "8월 캠페인", detail: "릴스 3편 제작" } }],
    }
    const v2 = toExperienceV2(
      makeExperience({
        type: "extracurricular",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "OO 서포터즈",
          summary: "",
          status: "complete",
          tags: [],
          fields: { "extra-detail.가장 중요했던 경험": oldCell },
          custom: [],
        },
      }),
    )
    const preserved = v2.customBlocks.find(b => b.key === "extra-detail.가장 중요했던 경험")
    expect(preserved?.label).toBe("가장 중요했던 경험")
    expect(preserved?.value).toEqual(oldCell)
  })

  it("v2: 구 레코드도 새로 추가된 템플릿 필드를 받는다 (템플릿 전량 재구성)", () => {
    // FRT-177 로 ② 에 '주요 미션 / 프로젝트'·'주요 성과'·'활동 성격'이 추가됐다. v2 는 저장된
    // 블록 배열이 아니라 레지스트리에서 블록을 다시 만들고 fields 값만 주입하므로, 그 필드가
    // 없던 레코드에도 빈 칸으로 나타나야 한다(구 레코드가 새 질문을 영영 못 보는 일 방지).
    const v2 = toExperienceV2(
      makeExperience({
        type: "extracurricular",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "OO 서포터즈",
          summary: "",
          status: "complete",
          tags: [],
          fields: { "extra-detail.지원 동기": textarea("옛 지원 동기") },
          custom: [],
        },
      }),
    )
    const labels = v2.extensionBlocks.map(b => b.label)
    expect(labels).toContain("주요 미션 / 프로젝트")
    expect(labels).toContain("주요 성과")
    expect(labels).toContain("활동 성격")
    // 기존 값은 그대로 살아있다.
    expect(v2.extensionBlocks.find(b => b.label === "지원 동기")?.value).toEqual(
      textarea("옛 지원 동기"),
    )
  })

  it("v2: FRT-178 로 라벨이 바뀐 구 동아리 필드도 custom 으로 보존된다", () => {
    // 확정본 정렬로 '단체 소개'→'동아리 소개'(②로 이동)·'기간'→'활동 기간'이 되며 안정키가
    // 바뀐다. 구 레코드의 값은 '기타' 카드에 그대로 남아야 한다(무음 손실 금지).
    const v2 = toExperienceV2(
      makeExperience({
        type: "club",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "OO 밴드",
          summary: "",
          status: "complete",
          tags: [],
          fields: {
            "club-info.단체 소개": textarea("30년 역사의 중앙 밴드 동아리"),
            "club-info.직책/역할": text("공연팀장"),
          },
          custom: [],
        },
      }),
    )
    expect(v2.customBlocks.find(b => b.key === "club-info.단체 소개")?.value).toEqual(
      textarea("30년 역사의 중앙 밴드 동아리"),
    )
    expect(v2.customBlocks.find(b => b.key === "club-info.직책/역할")?.value).toEqual(
      text("공연팀장"),
    )
  })

  it("v2: 구 동아리 표(5컬럼)는 저장된 컬럼을 그대로 유지하고 잠금이 풀린다", () => {
    // ③ 컬럼이 5→8 로 바뀌었지만 injectValue 는 저장값을 통째로 채택한다 — 구 레코드의
    // '세부 기간' 같은 폐기 컬럼 값이 화면에서 사라지면 안 된다. 대신 컬럼이 템플릿과
    // 달라졌으므로 열 관리 UI 를 돌려준다(FRT-104).
    const oldTable = {
      type: "repeatable-cell" as const,
      columns: [
        { key: "name", label: "활동명", blockType: "text" as const },
        { key: "period", label: "세부 기간", blockType: "text" as const },
        { key: "role", label: "직책/역할", blockType: "text" as const },
        { key: "detail", label: "활동내용 상세", blockType: "textarea" as const },
        { key: "result", label: "행사/운영 성과", blockType: "textarea" as const },
      ],
      rows: [
        {
          id: "row-1",
          cells: {
            name: "봄 정기 공연",
            period: "2024-03",
            role: "공연팀장",
            detail: "6개 팀 무대",
            result: "관객 500명",
          },
        },
      ],
    }
    const v2 = toExperienceV2(
      makeExperience({
        type: "club",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "OO 밴드",
          summary: "",
          status: "complete",
          tags: [],
          fields: { "club-activities.활동 기록": oldTable },
          custom: [],
        },
      }),
    )
    // 블록 라벨이 '활동 / 이벤트'로 바뀌어 안정키가 달라졌으므로 '기타' 카드로 보존된다.
    const preserved = v2.customBlocks.find(b => b.key === "club-activities.활동 기록")
    expect(preserved?.value).toEqual(oldTable)
    // 새 템플릿의 8컬럼 표는 빈 채로 함께 나타난다(구 레코드도 새 질문을 볼 수 있게).
    const fresh = v2.extensionBlocks.find(b => b.label === "활동 / 이벤트")
    if (fresh?.value.type === "repeatable-cell") {
      expect(fresh.value.columns.map(c => c.key)).toEqual([
        "role", "name", "type", "detail", "work", "result", "difficulty", "output",
      ])
    }
  })

  it("v2: 라운드트립에서 orphan 값이 custom[] 으로 재저장돼 소실되지 않는다", () => {
    const original = makeExperience({
      type: "academic-society",
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: "AI 학회",
        summary: "",
        status: "complete",
        tags: [],
        fields: { "extended.배경/목표": textarea("보존될 값") },
        custom: [],
      },
    })
    const payload = toSavePayload(toExperienceV2(original))
    const content = payload.content as { fields: Record<string, unknown>; custom: Array<{ key: string; value: unknown }> }
    // 재저장 시 fields 에서는 사라지지만 custom[] 에 키·값이 보존된다.
    expect(content.fields["extended.배경/목표"]).toBeUndefined()
    expect(content.custom.find(c => c.key === "extended.배경/목표")?.value).toEqual(textarea("보존될 값"))
  })

  it("v2: 빈 orphan fields 는 custom 으로 보존하지 않는다(구 레코드 빈 레거시 필드 누적 방지)", () => {
    // toSavePayload 는 키 있는 블록을 값이 비어도 fields 에 쓰므로, 구 학회 레코드엔
    // 빈 extended.* 항목이 흔하다. 이걸 승격하면 '기타' 카드에 빈 필드가 쌓인다.
    const v2 = toExperienceV2(
      makeExperience({
        type: "academic-society",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "AI 학회",
          summary: "",
          status: "complete",
          tags: [],
          fields: {
            "extended.배경/목표": textarea(""), // 빈 값 → 보존 안 함
            "extended.배운 점": textarea("실제 값"), // 채워짐 → 보존
          },
          custom: [],
        },
      }),
    )
    expect(v2.customBlocks.find(b => b.key === "extended.배경/목표")).toBeUndefined()
    expect(v2.customBlocks.find(b => b.key === "extended.배운 점")?.value).toEqual(textarea("실제 값"))
  })

  it("v1: 현재 템플릿에 없는 저장 extension 블록을 custom 으로 보존한다(구 학회 레거시)", () => {
    // schema_version 미기재(v1) 레코드는 값이 content.extensionBlocks 에 배열로 남는다.
    // 학회가 buildSettingsSection 으로 바뀌면서 옛 배경/목표·결과/성과 라벨이 템플릿에서 사라졌다.
    // 이 미매칭 블록을 extensionBlocks 로 두면 ExperienceFormV2 로드 필터에서 탈락→저장 왕복에
    // 유실되므로 custom 으로 옮겨 보존해야 한다. 현 템플릿에 있는 라벨(참여 동기)은 extension 유지.
    const v1 = toExperienceV2(
      makeExperience({
        type: "academic-society",
        content: {
          extensionBlocks: [
            { id: "b1", type: "textarea", label: "배경/목표", value: textarea("옛 배경/목표") },
            { id: "b2", type: "textarea", label: "결과/성과", value: textarea("옛 결과/성과") },
            { id: "b3", type: "textarea", label: "참여 동기", value: textarea("현 템플릿 매칭") },
          ],
        } as unknown as Experience["content"],
      }),
    )
    // 미매칭 두 블록은 extensionBlocks 에서 빠지고 customBlocks 로 보존(값 유지).
    expect(v1.extensionBlocks.find(b => b.label === "배경/목표")).toBeUndefined()
    expect(v1.extensionBlocks.find(b => b.label === "결과/성과")).toBeUndefined()
    expect(v1.customBlocks.find(b => b.label === "배경/목표")?.value).toEqual(textarea("옛 배경/목표"))
    expect(v1.customBlocks.find(b => b.label === "결과/성과")?.value).toEqual(textarea("옛 결과/성과"))
    // 현 템플릿에 있는 라벨은 extension 에 남는다.
    expect(v1.extensionBlocks.find(b => b.label === "참여 동기")?.value).toEqual(textarea("현 템플릿 매칭"))
  })

  it("v1: 빈 미매칭 extension 블록은 custom 으로 보존하지 않는다(v2 orphan 필터와 동일 기준)", () => {
    // 구 학회 레코드엔 빈 배경/목표·결과/성과 블록이 흔하다. 이를 승격하면 '기타' 카드에
    // 빈 레거시 필드가 쌓이고 완료 저장이 이를 영구화한다(빈 group 만 정리). 실제 값만 보존한다.
    const v1 = toExperienceV2(
      makeExperience({
        type: "academic-society",
        content: {
          extensionBlocks: [
            { id: "b1", type: "textarea", label: "배경/목표", value: textarea("") }, // 빈 값 → 보존 안 함
            { id: "b2", type: "textarea", label: "결과/성과", value: textarea("옛 결과/성과") }, // 채워짐 → 보존
          ],
        } as unknown as Experience["content"],
      }),
    )
    expect(v1.customBlocks.find(b => b.label === "배경/목표")).toBeUndefined()
    expect(v1.customBlocks.find(b => b.label === "결과/성과")?.value).toEqual(textarea("옛 결과/성과"))
  })

  it("v1: 라운드트립에서 미매칭 extension 값이 custom[] 으로 재저장돼 소실되지 않는다", () => {
    const v1 = toExperienceV2(
      makeExperience({
        type: "academic-society",
        content: {
          extensionBlocks: [
            { id: "b1", type: "textarea", label: "결과/성과", value: textarea("보존될 성과") },
          ],
        } as unknown as Experience["content"],
      }),
    )
    const payload = toSavePayload(v1)
    const content = payload.content as {
      fields: Record<string, unknown>
      custom: Array<{ label: string; value: unknown }>
    }
    expect(content.custom.find(c => c.label === "결과/성과")?.value).toEqual(textarea("보존될 성과"))
  })
})

describe("toSavePayload", () => {
  it("빈 ExperienceV2 를 v2 content 로 직렬화한다", () => {
    const payload = toSavePayload(makeExperienceV2())
    expect(payload.type).toBe("career")
    expect(payload.importance).toBe(4)
    expect(payload.content).toMatchObject({
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "타이틀",
      summary: "요약",
      status: "draft",
      tags: ["a"],
      fields: {},
      custom: [],
    })
  })

  it("importance 가 undefined 면 null 로 강제한다", () => {
    expect(toSavePayload(makeExperienceV2({ importance: undefined })).importance).toBeNull()
  })

  it("키 있는 블록은 fields 맵으로, title/summary 블록은 제외한다", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    // 값 채우기
    const filledCore = coreBlocks.map(b =>
      b.key === "core.핵심 성과" ? { ...b, value: textarea("성과!") } : b,
    )
    const filledExt = extensionBlocks.map(b =>
      b.key === "career-info.회사명" ? { ...b, value: text("ARC") } : b,
    )
    const payload = toSavePayload(
      makeExperienceV2({ coreBlocks: filledCore, extensionBlocks: filledExt }),
    )
    const content = payload.content as Record<string, unknown>
    const fields = content.fields as Record<string, BlockValue>
    expect(fields["core.핵심 성과"]).toEqual(textarea("성과!"))
    expect(fields["career-info.회사명"]).toEqual(text("ARC"))
    // 헤더 소유 필드는 fields 에 중복 저장하지 않음
    expect(fields["core.경험명"]).toBeUndefined()
    expect(fields["core.한 줄 요약"]).toBeUndefined()
  })
})

describe("round-trip (toExperienceV2 → toSavePayload)", () => {
  it("v2 스칼라·importance 가 왕복 후 보존된다", () => {
    const original = makeExperience({
      content: {
        schema_version: 2,
        template_version: TEMPLATE_VERSION,
        title: "T",
        summary: "S",
        status: "complete",
        tags: ["x"],
        fields: {},
        custom: [],
      },
      importance: 2,
    })
    const payload = toSavePayload(toExperienceV2(original))
    expect(payload.content).toMatchObject({
      schema_version: 2,
      title: "T",
      summary: "S",
      status: "complete",
      tags: ["x"],
    })
    expect(payload.importance).toBe(2)
    expect(payload.type).toBe("career")
  })

  it("저장순서=화면순서: extensionBlocks 가 왕복 후에도 레지스트리 순서를 유지한다", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    const expectedKeys = extensionBlocks.map(b => b.key)
    const v2In = makeExperienceV2({ coreBlocks, extensionBlocks })
    const payload = toSavePayload(v2In)
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.extensionBlocks.map(b => b.key)).toEqual(expectedKeys)
  })

  it("필드 값이 키 기준으로 왕복 보존된다(라벨 충돌 무관)", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    const filledExt = extensionBlocks.map(b =>
      b.key === "career-tasks.프로젝트/담당 업무"
        ? b
        : b.key === "career-info.회사명"
          ? { ...b, value: text("ARC") }
          : b,
    )
    const v2In = makeExperienceV2({ coreBlocks, extensionBlocks: filledExt, title: "헤더T" })
    const payload = toSavePayload(v2In)
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.extensionBlocks.find(b => b.key === "career-info.회사명")?.value).toEqual(text("ARC"))
    expect(reloaded.title).toBe("헤더T")
    expect(reloaded.coreBlocks.find(b => b.key === "core.경험명")?.value).toEqual(text("헤더T"))
  })

  it("lockColumns 는 직렬화되지 않고 로드 시 레지스트리에서 재공급된다 (FRT-104)", () => {
    const { coreBlocks, extensionBlocks } = careerBlocks()
    const tableKey = "career-tasks.프로젝트/담당 업무"
    expect(extensionBlocks.find(b => b.key === tableKey)?.lockColumns).toBe(true)

    const payload = toSavePayload(makeExperienceV2({ coreBlocks, extensionBlocks }))
    expect(JSON.stringify(payload.content)).not.toContain("lockColumns")

    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.extensionBlocks.find(b => b.key === tableKey)?.lockColumns).toBe(true)
  })

  it("저장된 컬럼이 템플릿과 다르면 잠그지 않는다 — 커스터마이즈한 열을 되돌릴 수 있어야 (FRT-104)", () => {
    const tableKey = "career-tasks.프로젝트/담당 업무"
    const tmplTable = careerBlocks().extensionBlocks.find(b => b.key === tableKey)!
    const tmplValue = tmplTable.value as RepeatableCellBlockValue

    // 잠금 도입 이전에 사용자가 열을 하나 추가해 둔 레코드
    const customized: RepeatableCellBlockValue = {
      ...tmplValue,
      columns: [...tmplValue.columns, { key: "메모", label: "메모", blockType: "text" }],
    }
    const reloaded = toExperienceV2(
      makeExperience({ content: { schema_version: 2, fields: { [tableKey]: customized } } }),
    )
    const loadedTable = reloaded.extensionBlocks.find(b => b.key === tableKey)
    expect(loadedTable?.lockColumns).toBe(false)
    expect((loadedTable?.value as RepeatableCellBlockValue).columns).toHaveLength(
      tmplValue.columns.length + 1,
    )
  })

  it("템플릿 열을 지운 레코드도 잠그지 않는다 — 지운 열을 복구할 수 있어야 (FRT-104)", () => {
    const tableKey = "career-tasks.프로젝트/담당 업무"
    const tmplTable = careerBlocks().extensionBlocks.find(b => b.key === tableKey)!
    const tmplValue = tmplTable.value as RepeatableCellBlockValue
    const cleared: RepeatableCellBlockValue = { ...tmplValue, columns: [] }

    const reloaded = toExperienceV2(
      makeExperience({ content: { schema_version: 2, fields: { [tableKey]: cleared } } }),
    )
    expect(reloaded.extensionBlocks.find(b => b.key === tableKey)?.lockColumns).toBe(false)
  })

  it("키 없는(모호 라벨) 확장 블록은 custom 으로 보존된다 (Codex P1 회귀)", () => {
    const block: Block = {
      id: "x1",
      type: "repeatable-cell",
      label: "결과/성과",
      value: { type: "repeatable-cell", columns: [], rows: [{ id: "r1", cells: {} }] },
    }
    const payload = toSavePayload(
      makeExperienceV2({ typeId: "extracurricular", extensionBlocks: [block] }),
    )
    const content = payload.content as Record<string, unknown>
    const custom = content.custom as CustomEntry[]
    const preserved = custom.find(
      e => e.entryType === "field" && e.label === "결과/성과",
    )
    expect(preserved).toBeDefined()
    expect(preserved?.entryType === "field" && preserved.value.type).toBe("repeatable-cell")
  })

  it("custom 블록이 왕복 보존된다", () => {
    const custom: Block[] = [
      { id: "c1", key: "custom-1", type: "text", label: "메모", value: text("note") },
    ]
    const payload = toSavePayload(makeExperienceV2({ customBlocks: custom }))
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content, importance: payload.importance }),
    )
    expect(reloaded.customBlocks).toHaveLength(1)
    expect(reloaded.customBlocks[0]).toMatchObject({ label: "메모", type: "text" })
    expect(reloaded.customBlocks[0].value).toEqual(text("note"))
  })

  it("FRT-76: BlockRow.linkedProjectRowId 가 왕복 보존된다(additive·무마이그레이션)", () => {
    // 학회 society-detail 의 OutcomeList 블록을 레지스트리에서 가져와 링크된 행을 심는다.
    const tmpl = getTemplateForType("academic-society")
    const outcomeBlock = tmpl.extensions
      .flatMap(s => s.blocks)
      .find(b => b.key === "society-detail.단체 활동 / 성과")
    expect(outcomeBlock).toBeDefined()
    const linked: Block = {
      ...outcomeBlock!,
      value: {
        type: "repeatable-cell",
        columns: (outcomeBlock!.value as { columns: unknown[] }).columns as never,
        rows: [{ id: "r1", cells: { item: "케이스 대회 은상" }, linkedProjectRowId: "proj-1" }],
      },
    }
    const payload = toSavePayload(
      makeExperienceV2({ typeId: "academic-society", extensionBlocks: [linked] }),
    )
    // 저장: fields[key].rows[0] 에 linkedProjectRowId 가 그대로 실린다(value JSONB 경로).
    const fields = (payload.content as { fields: Record<string, { rows: { linkedProjectRowId?: string }[] }> }).fields
    expect(fields["society-detail.단체 활동 / 성과"].rows[0].linkedProjectRowId).toBe("proj-1")
    // 복원: 로드 후에도 참조가 살아있다(학회 템플릿으로 재구성해야 하므로 type 명시).
    const reloaded = toExperienceV2(
      makeExperience({ type: "academic-society", content: payload.content, importance: payload.importance }),
    )
    const reloadedBlock = reloaded.extensionBlocks.find(b => b.key === "society-detail.단체 활동 / 성과")
    expect(reloadedBlock?.value.type).toBe("repeatable-cell")
    if (reloadedBlock?.value.type === "repeatable-cell") {
      expect(reloadedBlock.value.rows[0].linkedProjectRowId).toBe("proj-1")
    }
  })

  it("FRT-145: BlockRow.extraFields 가 왕복 보존된다(additive·무마이그레이션)", () => {
    // 학회 ③ 프로젝트 표에 사용자가 추가한 항목을 심는다.
    const key = "society-projects.프로젝트/연구활동"
    const tmpl = getTemplateForType("academic-society")
    const projectBlock = tmpl.extensions.flatMap(s => s.blocks).find(b => b.key === key)
    expect(projectBlock).toBeDefined()
    const withExtras: Block = {
      ...projectBlock!,
      value: {
        type: "repeatable-cell",
        columns: (projectBlock!.value as { columns: unknown[] }).columns as never,
        rows: [
          {
            id: "r1",
            cells: { name: "추천 시스템 연구" },
            extraFields: [
              { key: "extra-1", label: "학회 발표 여부", blockType: "text", value: "구두 발표" },
              { key: "extra-2", label: "사용 도구", blockType: "tags", value: ["Python", "PyTorch"] },
            ],
          },
        ],
      },
    }
    const payload = toSavePayload(
      makeExperienceV2({ typeId: "academic-society", extensionBlocks: [withExtras] }),
    )
    const fields = (payload.content as {
      fields: Record<string, { rows: { extraFields?: { label: string; value: unknown }[] }[] }>
    }).fields
    // 저장: 라벨은 id 가 아니라 **이름**으로 실린다 — 백엔드 분석이 JSONB 를 그대로 읽는다.
    expect(fields[key].rows[0].extraFields?.map(f => f.label)).toEqual([
      "학회 발표 여부",
      "사용 도구",
    ])
    // 복원: 로드 후에도 값이 살아있다.
    const reloaded = toExperienceV2(
      makeExperience({ type: "academic-society", content: payload.content, importance: payload.importance }),
    )
    const reloadedBlock = reloaded.extensionBlocks.find(b => b.key === key)
    expect(reloadedBlock?.value.type).toBe("repeatable-cell")
    if (reloadedBlock?.value.type === "repeatable-cell") {
      expect(reloadedBlock.value.rows[0].extraFields?.[0].value).toBe("구두 발표")
      expect(reloadedBlock.value.rows[0].extraFields?.[1].value).toEqual(["Python", "PyTorch"])
    }
  })
})

describe("section round-trip (FRT-78)", () => {
  it("toSavePayload: 사용자 섹션(group 블록)은 entryType:'section' 으로 직렬화된다", () => {
    const g = createGroupBlock("나만의 섹션")
    const child = createTextField("메모")
    if (child.value.type === "text") child.value.text = "내용"
    g.children = [child]
    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const custom = (payload.content as unknown as { custom: CustomEntry[] }).custom
    expect(custom[0].entryType).toBe("section")
    if (custom[0].entryType === "section") {
      expect(custom[0].label).toBe("나만의 섹션")
      expect(custom[0].children).toHaveLength(1)
      expect(custom[0].children[0].entryType).toBe("field")
    }
  })

  it("toExperienceV2: section 항목이 type:'group' Block 으로 복원된다 (평탄화 아님)", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          fields: {},
          custom: [
            {
              key: "s-1",
              entryType: "section",
              label: "복원 섹션",
              children: [
                { key: "c-1", entryType: "field", type: "text", label: "메모", value: { type: "text", text: "내용" } },
              ],
            },
          ],
        },
      }),
    )
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0].type).toBe("group")
    expect(v2.customBlocks[0].label).toBe("복원 섹션")
    expect(v2.customBlocks[0].children).toHaveLength(1)
  })

  it("하위호환: 레거시 entryType:'group'(FRT-72) 도 최상위 group Block 으로 복원된다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          fields: {},
          custom: [
            {
              key: "g-1",
              entryType: "group",
              label: "레거시 그룹",
              children: [
                { key: "c-1", entryType: "field", type: "text", label: "메모", value: { type: "text", text: "내용" } },
              ],
            },
          ],
        },
      }),
    )
    expect(v2.customBlocks[0].type).toBe("group")
    expect(v2.customBlocks[0].label).toBe("레거시 그룹")
    expect(v2.customBlocks[0].children).toHaveLength(1)
  })

  it("FULL round-trip: 두 자식을 가진 섹션이 toSavePayload → toExperienceV2 를 견딘다", () => {
    const g = createGroupBlock("섹션A")
    const a = createTextField("필드1"); if (a.value.type === "text") a.value.text = "v1"
    const b = createTextField("필드2"); if (b.value.type === "text") b.value.text = "v2"
    g.children = [a, b]
    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content as unknown as Record<string, unknown> }),
    )
    const rg = reloaded.customBlocks[0]
    expect(rg.type).toBe("group")
    expect(rg.children).toHaveLength(2)
    expect(rg.children?.map(c => c.label)).toEqual(["필드1", "필드2"])
  })

  it("중첩 섹션/그룹(depth>0)은 평탄화된다 — 1겹 cap", () => {
    const v2 = toExperienceV2(
      makeExperience({
        content: {
          schema_version: 2,
          fields: {},
          custom: [
            {
              key: "s-1",
              entryType: "section",
              label: "외부",
              children: [
                {
                  key: "s-2",
                  entryType: "section",
                  label: "내부(평탄화 대상)",
                  children: [
                    { key: "c-1", entryType: "field", type: "text", label: "메모", value: { type: "text", text: "내용" } },
                  ],
                },
              ],
            },
          ],
        },
      }),
    )
    expect(v2.customBlocks[0].type).toBe("group")
    const children = v2.customBlocks[0].children ?? []
    expect(children.every(c => c.type !== "group")).toBe(true)
    expect(children.map(c => c.label)).toEqual(["메모"])
  })

  it("collapsed 는 직렬화되지 않는다 (local-only)", () => {
    const g = createGroupBlock("섹션")
    const c = createTextField("메모"); if (c.value.type === "text") c.value.text = "x"
    g.children = [c]
    const payload = toSavePayload(makeExperienceV2({ customBlocks: [g] }))
    const custom = (payload.content as unknown as { custom: CustomEntry[] }).custom
    expect(custom[0].entryType).toBe("section")
    expect("collapsed" in custom[0]).toBe(false)
  })

  it("children 없는 섹션이 빈 children:[] 로 왕복된다", () => {
    const g = createGroupBlock("빈 섹션")
    const payload = toSavePayload(makeExperienceV2({ status: "draft", customBlocks: [g] }))
    const reloaded = toExperienceV2(
      makeExperience({ content: payload.content as unknown as Record<string, unknown> }),
    )
    expect(reloaded.customBlocks[0].type).toBe("group")
    expect(reloaded.customBlocks[0].children).toEqual([])
  })
})

describe("빈 사용자 섹션 prune (FRT-78)", () => {
  it("complete 저장 시 children 이 모두 빈 섹션은 custom 에서 제외된다", () => {
    const empty = createGroupBlock("빈 섹션") // children []
    const filled = createGroupBlock("채운 섹션")
    const c = createTextField("메모"); if (c.value.type === "text") c.value.text = "내용"
    filled.children = [c]
    const payload = toSavePayload(
      makeExperienceV2({ status: "complete", customBlocks: [empty, filled] }),
    )
    const custom = (payload.content as unknown as { custom: CustomEntry[] }).custom
    expect(custom).toHaveLength(1)
    expect(custom[0].entryType === "section" && custom[0].label).toBe("채운 섹션")
  })

  it("draft 저장 시 빈 섹션도 보존된다", () => {
    const empty = createGroupBlock("빈 섹션")
    const payload = toSavePayload(
      makeExperienceV2({ status: "draft", customBlocks: [empty] }),
    )
    const custom = (payload.content as unknown as { custom: CustomEntry[] }).custom
    expect(custom).toHaveLength(1)
    expect(custom[0].entryType === "section" && custom[0].label).toBe("빈 섹션")
  })
})

/**
 * FRT-179 는 자격증에서 섹션을 통째로 없앤다(구 'cert-applied' 반복 기록). 필드를 추가·개명하는
 * 다른 확정본 정렬과 달리, 표(repeatable-cell)와 파일 첨부가 통째로 템플릿에서 사라지는 형태라
 * orphan 안전망이 실제로 그 값을 지키는지 여기서 못 박는다.
 */
describe("폐기 섹션 값 보존 (FRT-179 자격증)", () => {
  const RETIRED_TABLE_KEY = "cert-applied.실무 적용 사례"
  const RETIRED_FILE_KEY = "cert-applied.자격증 증빙"
  const RETIRED_FIELD_KEY = "cert-info.자격 번호"

  function retiredCertContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "정보처리기사",
      summary: "",
      status: "complete",
      tags: [],
      fields: {
        "cert-info.자격증명": text("정보처리기사"),
        [RETIRED_FIELD_KEY]: text("24201234567A"),
        [RETIRED_TABLE_KEY]: {
          type: "repeatable-cell",
          columns: [
            { key: "situation", label: "적용 상황/프로젝트명", blockType: "text", required: true },
            { key: "work", label: "내가 한 일", blockType: "textarea" },
          ],
          rows: [{ id: "r1", cells: { situation: "사내 배치 자동화", work: "쿼리 튜닝" } }],
        },
        [RETIRED_FILE_KEY]: {
          type: "file",
          fileName: "cert.pdf",
          description: "합격증",
          evidenceType: "합격증",
        },
        // 빈 폐기 필드 — '기타' 카드에 빈 레거시 필드가 쌓이면 안 된다.
        "cert-info.학습 방식": { type: "single-select", selected: "" },
      },
      custom: [],
    }
  }

  it("템플릿에서 사라진 표·파일·필드 값이 customBlocks 로 보존된다", () => {
    const v2 = toExperienceV2(
      makeExperience({ type: "certification", content: retiredCertContent() }),
    )
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    const table = byKey(RETIRED_TABLE_KEY)
    expect(table?.type).toBe("repeatable-cell")
    expect(table?.value.type === "repeatable-cell" && table.value.rows[0].cells.situation).toBe(
      "사내 배치 자동화",
    )

    const file = byKey(RETIRED_FILE_KEY)
    expect(file?.type).toBe("file")
    expect(file?.value.type === "file" && file.value.fileName).toBe("cert.pdf")

    expect(byKey(RETIRED_FIELD_KEY)?.value).toEqual(text("24201234567A"))
    // 현행 템플릿이 소비하는 키는 orphan 으로 중복되지 않는다.
    expect(byKey("cert-info.자격증명")).toBeUndefined()
    // 빈 폐기 필드는 승격하지 않는다.
    expect(byKey("cert-info.학습 방식")).toBeUndefined()
  })

  it("보존된 값이 재저장 왕복에도 살아남는다 (무음 손실 없음)", () => {
    const first = toExperienceV2(
      makeExperience({ type: "certification", content: retiredCertContent() }),
    )
    const payload = toSavePayload(first)
    const custom = (payload.content as unknown as { custom: CustomEntry[] }).custom
    expect(custom.map(e => e.key)).toEqual(
      expect.arrayContaining([RETIRED_TABLE_KEY, RETIRED_FILE_KEY, RETIRED_FIELD_KEY]),
    )

    const reloaded = toExperienceV2(
      makeExperience({ type: "certification", content: payload.content }),
    )
    const table = reloaded.customBlocks.find(b => b.key === RETIRED_TABLE_KEY)
    expect(table?.value.type === "repeatable-cell" && table.value.rows[0].cells.work).toBe(
      "쿼리 튜닝",
    )
  })
})

/**
 * FRT-211 은 수상경력 13필드 중 10개를 없애거나 개명한다 — 확정본 정렬 중 **가장 큰 폭의 재편**이다.
 * 특히 '수상 구분'(single-select) → '수상 훈격'(text) 은 타입까지 바뀌어 `injectValue` 의 타입
 * 가드에 걸리므로 자동 이관이 원천 차단된다. 값이 조용히 사라지지 않고 orphan 으로 남는지 못 박는다.
 */
describe("수상경력 필드 재편 값 보존 (FRT-211)", () => {
  /** 확정본에서 사라지거나 라벨이 바뀐 구 키 — 전부 '기타' 카드로 가야 한다. */
  const RETIRED_KEYS = [
    "award-info.수상명",
    "award-info.참가 형태",
    "award-info.팀명/팀원",
    "award-info.평가 기준/요구사항",
    "award-info.내 역할/기여",
    "award-info.핵심 성과",
    "core.핵심 성과",
  ]
  const RETIRED_SELECT_KEY = "award-info.수상 구분"
  const RETIRED_FILE_KEY = "award-info.수상 증빙"

  function retiredAwardContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "전국 대학생 창업 경진대회 대상",
      summary: "",
      status: "complete",
      tags: [],
      fields: {
        "award-info.수상명": text("대상"),
        "award-info.주최/기관": text("중소벤처기업부"),
        "award-info.대회/프로그램명": text("전국 대학생 창업 경진대회"),
        // 타입이 바뀌는 대체 — text 로 자동 주입되지 않고 orphan 으로 남아야 한다.
        [RETIRED_SELECT_KEY]: { type: "single-select", options: ["대상", "기타"], selected: "대상" },
        "award-info.참가 형태": { type: "single-select", options: ["개인", "팀"], selected: "팀" },
        "award-info.팀명/팀원": text("팀 아크 4명"),
        "award-info.평가 기준/요구사항": textarea("시장성 40%, 기술성 30%"),
        "award-info.내 역할/기여": textarea("기획·발표 담당"),
        "award-info.핵심 성과": textarea("최종 1위"),
        "core.핵심 성과": textarea("코어에 남아 있던 성과"),
        [RETIRED_FILE_KEY]: {
          type: "file",
          fileName: "award.pdf",
          description: "상장 사본",
          evidenceType: "상장",
        },
        // 현행 템플릿이 그대로 쓰는 키 — orphan 으로 중복되면 안 된다.
        "award-info.수상일": { type: "date", date: "2024-05-01" },
      },
      custom: [],
    }
  }

  it("확정본에서 사라진 구 필드 값이 customBlocks 로 보존된다", () => {
    const v2 = toExperienceV2(makeExperience({ type: "award", content: retiredAwardContent() }))
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    for (const key of RETIRED_KEYS) {
      expect(byKey(key), key).toBeDefined()
    }
    expect(byKey("award-info.수상명")?.value).toEqual(text("대상"))

    // 타입이 바뀐 대체 — select 값이 그대로 남는다(text 로 강제 변환되지 않는다).
    const select = byKey(RETIRED_SELECT_KEY)
    expect(select?.value.type).toBe("single-select")
    expect(select?.value.type === "single-select" && select.value.selected).toBe("대상")

    const file = byKey(RETIRED_FILE_KEY)
    expect(file?.value.type === "file" && file.value.fileName).toBe("award.pdf")

    // 현행 템플릿이 소비하는 키는 orphan 으로 중복되지 않는다.
    expect(byKey("award-info.수상일")).toBeUndefined()
  })

  /**
   * 순수 개명 — 질문은 그대로고 라벨만 바뀐 필드는 값을 **새 필드로 이관**한다. 안정키가
   * `${sectionId}.${label}` 파생이라 라벨을 바꾸면 키가 통째로 바뀌고, 값은 '기타' 로 보존되지만
   * 사용자는 같은 정보를 다시 타이핑해야 한다(Codex P2).
   *
   * ⚠️ **의미가 바뀐 대체는 이관하지 않는다.** '수상명'(상의 이름)·'수상 구분'(드롭다운)을
   * '수상 훈격' 으로 옮기면 옛 답이 새 질문의 답으로 둔갑한다 — 대회명이 훈격 칸에 들어간다.
   */
  it("순수 개명된 구 키의 값이 새 필드에 실린다", () => {
    const v2 = toExperienceV2(makeExperience({ type: "award", content: retiredAwardContent() }))
    const ext = (label: string) => v2.extensionBlocks.find(b => b.label === label)

    expect(ext("대회 / 프로그램명")?.value).toEqual(text("전국 대학생 창업 경진대회"))
    expect(ext("주최 기관")?.value).toEqual(text("중소벤처기업부"))
    // 이관된 구 키는 '기타' 카드에 중복으로 남지 않는다.
    expect(v2.customBlocks.find(b => b.key === "award-info.대회/프로그램명")).toBeUndefined()
    expect(v2.customBlocks.find(b => b.key === "award-info.주최/기관")).toBeUndefined()
  })

  it("의미가 바뀐 대체는 이관하지 않는다 — '수상 훈격'은 비어서 시작한다", () => {
    const v2 = toExperienceV2(makeExperience({ type: "award", content: retiredAwardContent() }))
    expect(v2.extensionBlocks.find(b => b.label === "수상 훈격")?.value).toEqual(text(""))
    expect(v2.customBlocks.find(b => b.key === "award-info.수상명")?.value).toEqual(text("대상"))
  })

  it("새 키에 이미 값이 있으면 구 키가 덮어쓰지 않는다", () => {
    const content = retiredAwardContent()
    ;(content.fields as Record<string, unknown>)["award-info.주최 기관"] = text("이미 채운 새 값")
    const v2 = toExperienceV2(makeExperience({ type: "award", content }))
    expect(v2.extensionBlocks.find(b => b.label === "주최 기관")?.value).toEqual(
      text("이미 채운 새 값"),
    )
  })

  /**
   * v1 레거시(`schema_version` 없음)는 `fields` 맵이 아니라 **저장된 블록 배열 + 라벨 매칭**으로
   * 재구성되므로 키 별칭이 닿지 않는다. 같은 순수 개명인데 v2 만 이어지고 v1 은 '기타' 로
   * 밀려나면 반쪽 수정이다(Codex P2 5라운드). 라벨 별칭도 함께 둔다.
   */
  it("v1 레거시에서도 순수 개명된 라벨이 새 안정키를 받는다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        type: "award",
        content: {
          title: "전국 대학생 창업 경진대회 대상",
          summary: "",
          status: "complete",
          tags: [],
          coreBlocks: [],
          extensionBlocks: [
            { id: "b1", type: "text", label: "대회/프로그램명", value: text("전국 대학생 창업 경진대회") },
            { id: "b2", type: "text", label: "주최/기관", value: text("중소벤처기업부") },
            // 의미가 바뀐 대체는 v1 에서도 이관하지 않는다 — '기타' 로 보존된다.
            { id: "b3", type: "text", label: "수상명", value: text("대상") },
          ],
          customBlocks: [],
        },
      }),
    )

    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)
    expect(byKey("award-info.대회 / 프로그램명")?.value).toEqual(text("전국 대학생 창업 경진대회"))
    expect(byKey("award-info.주최 기관")?.value).toEqual(text("중소벤처기업부"))
    expect(v2.customBlocks.find(b => b.label === "수상명")?.value).toEqual(text("대상"))
  })

  it("보존된 값이 재저장 왕복에도 살아남는다 (무음 손실 없음)", () => {
    const first = toExperienceV2(
      makeExperience({ type: "award", content: retiredAwardContent() }),
    )
    const payload = toSavePayload(first)
    const custom = (payload.content as unknown as { custom: CustomEntry[] }).custom
    expect(custom.map(e => e.key)).toEqual(
      expect.arrayContaining([...RETIRED_KEYS, RETIRED_SELECT_KEY, RETIRED_FILE_KEY]),
    )

    const reloaded = toExperienceV2(makeExperience({ type: "award", content: payload.content }))
    expect(reloaded.customBlocks.find(b => b.key === "award-info.팀명/팀원")?.value).toEqual(
      text("팀 아크 4명"),
    )
  })

  /**
   * 조건부 필드(FRT-211)의 값은 저장 경로를 그대로 탄다 — 조건 미충족이어도 값을 비우지 않는다.
   * 화면에서 감추는 것은 **빈 필드뿐**이므로(conditional-fields.ts) 무음 잔존이 생길 여지가 없고,
   * 저장 시 값을 지우는 방식이었다면 트리거를 잘못 눌러 저장한 한 번에 데이터가 사라졌을 것이다.
   */
  it("조건부 필드의 값은 저장에서 지워지지 않는다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        type: "award",
        content: {
          schema_version: 2,
          template_version: TEMPLATE_VERSION,
          title: "수상",
          summary: "",
          status: "complete",
          tags: [],
          fields: {
            "award-info.개인 / 팀": {
              type: "single-select",
              options: ["개인 수상", "팀 수상 (2~5명)", "팀 수상 (6명 이상)"],
              selected: "개인 수상",
            },
            "award-info.팀에서 내가 맡은 역할": text("팀장"),
          },
          custom: [],
        },
      }),
    )
    const payload = toSavePayload(v2)
    const fields = (payload.content as unknown as { fields: Record<string, BlockValue> }).fields
    expect(fields["award-info.팀에서 내가 맡은 역할"]).toEqual(text("팀장"))
  })
})

describe("선택 필드 숨김 키 (FRT-190)", () => {
  const HIDDEN_KEY = "extended.배운 점"

  function v2Content(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "타이틀",
      summary: "요약",
      status: "draft",
      tags: [],
      fields: {},
      custom: [],
      ...overrides,
    }
  }

  it("content.hidden 을 hiddenKeys 로 읽는다", () => {
    const exp = toExperienceV2(makeExperience({ content: v2Content({ hidden: [HIDDEN_KEY] }) }))
    expect(exp.hiddenKeys).toEqual([HIDDEN_KEY])
  })

  it("hidden 이 없는 v2 레코드는 빈 배열", () => {
    const exp = toExperienceV2(makeExperience({ content: v2Content() }))
    expect(exp.hiddenKeys).toEqual([])
  })

  it("v1 레거시 레코드는 빈 배열", () => {
    const exp = toExperienceV2(makeExperience({ content: { coreBlocks: [], extensionBlocks: [] } }))
    expect(exp.hiddenKeys).toEqual([])
  })

  it("배열이 아닌 hidden 은 버린다 — null·문자열·객체", () => {
    for (const bad of [null, "extended.배운 점", { key: true }, 3]) {
      const exp = toExperienceV2(makeExperience({ content: v2Content({ hidden: bad }) }))
      expect(exp.hiddenKeys).toEqual([])
    }
  })

  it("문자열이 아닌 원소만 골라 버린다 — 섞여 있어도 나머지는 산다", () => {
    const exp = toExperienceV2(
      makeExperience({ content: v2Content({ hidden: [HIDDEN_KEY, null, 7, "", "extended.느낀 점"] }) }),
    )
    expect(exp.hiddenKeys).toEqual([HIDDEN_KEY, "extended.느낀 점"])
  })

  it("toSavePayload 가 hidden 을 기록한다", () => {
    const payload = toSavePayload(makeExperienceV2({ hiddenKeys: [HIDDEN_KEY] }))
    expect((payload.content as unknown as { hidden: string[] }).hidden).toEqual([HIDDEN_KEY])
  })

  it("숨김 키가 로드→저장 왕복에 멱등하게 보존된다", () => {
    const first = toExperienceV2(makeExperience({ content: v2Content({ hidden: [HIDDEN_KEY] }) }))
    const payload = toSavePayload(first)
    const second = toExperienceV2(makeExperience({ content: payload.content }))
    expect(second.hiddenKeys).toEqual([HIDDEN_KEY])
    expect((toSavePayload(second).content as unknown as { hidden: string[] }).hidden).toEqual([
      HIDDEN_KEY,
    ])
  })

  /**
   * 개명은 값만 옮기는 것이 아니다. 숨김 상태를 구 키에 두고 오면 사용자가 감춰 둔 칸이 템플릿
   * 개편 후 혼자 다시 나타나고, `normalizeHiddenKeys` 는 모르는 키를 버리지 않아 옛 키가 저장분에
   * 영원히 남는다(FRT-210, Codex P2).
   */
  it("개명된 안정키는 숨김 목록에서도 새 키로 따라간다", () => {
    const exp = toExperienceV2(
      makeExperience({
        type: "language",
        content: v2Content({ hidden: ["lang-info.점수/등급"] }),
      }),
    )
    expect(exp.hiddenKeys).toEqual(["lang-certificate.점수 / 등급"])
  })

  it("구 키와 새 키가 함께 숨겨져 있어도 중복으로 쌓이지 않는다", () => {
    const exp = toExperienceV2(
      makeExperience({
        type: "language",
        content: v2Content({
          hidden: ["lang-certificate.점수 / 등급", "lang-info.점수/등급"],
        }),
      }),
    )
    expect(exp.hiddenKeys).toEqual(["lang-certificate.점수 / 등급"])
  })
})

/**
 * FRT-210 은 어학능력 템플릿을 확정본 4섹션으로 전면 교체하면서 **섹션 id 를 전부 갈아치운다**.
 *
 * 그게 이 작업의 안전 장치다. 구 '언어'(text)는 확정본에서 드롭다운이고 구 '유효기간'(text)은
 * date 인데, 섹션 id 를 유지했다면 안정키가 같아져 injectValue 는 타입 불일치로 값을 안 싣고
 * (text↔textarea 만 변환) 그 키는 consumedKeys 에 잡혀 orphan 안전망도 건너뛴다 — 값이 '기타'
 * 카드에도 없이 조용히 사라진다. 그 무음 손실을 막았는지 여기서 못 박는다.
 */
describe("확정본 전면 교체 값 보존 (FRT-210 어학능력)", () => {
  const OLD_TABLE_KEY = "lang-usage.활용 사례"

  function legacyLanguageContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "영어",
      summary: "실무 영어",
      status: "complete",
      tags: [],
      fields: {
        // 타입이 바뀌는 둘 — 이관하지 않고 orphan 으로 보존해야 한다(최대 리스크).
        "lang-info.언어": text("영어"),
        "lang-info.유효기간": text("2026-03-10"),
        // 질문·타입이 같아 새 키로 이관되는 둘.
        "lang-info.시험/인증명": text("TOEIC"),
        "lang-info.점수/등급": text("920점"),
        // 질문이 달라 이관하지 않는 것들.
        "lang-info.응시일": { type: "date", date: "2024-03-10" },
        "lang-info.강점 영역": {
          type: "checklist",
          options: ["듣기", "읽기", "말하기", "쓰기"],
          checked: ["듣기", "읽기"],
        },
        "lang-info.학습 기간": { type: "period", start: "2022-03", end: "2024-02", isCurrent: false },
        "lang-info.학습 방식": {
          type: "single-select",
          options: ["학원", "독학", "회화", "첨삭", "스터디"],
          selected: "독학",
        },
        [OLD_TABLE_KEY]: {
          type: "repeatable-cell",
          columns: [
            { key: "situation", label: "상황", blockType: "text", required: true },
            { key: "role", label: "내가 한 역할", blockType: "textarea" },
          ],
          rows: [{ id: "r1", cells: { situation: "사내 화상회의 통역", role: "실시간 순차 통역" } }],
        },
      },
      custom: [],
    }
  }

  const loadLegacy = () =>
    toExperienceV2(makeExperience({ type: "language", content: legacyLanguageContent() }))

  it("질문·타입이 같은 두 필드는 확정본 ④ 자리로 이관된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)

    expect(byKey("lang-certificate.시험 / 자격증명")?.value).toEqual(text("TOEIC"))
    expect(byKey("lang-certificate.점수 / 등급")?.value).toEqual(text("920점"))
    // 옮긴 구 키는 '기타' 에 중복으로 되살아나지 않는다.
    expect(v2.customBlocks.find(b => b.key === "lang-info.시험/인증명")).toBeUndefined()
    expect(v2.customBlocks.find(b => b.key === "lang-info.점수/등급")).toBeUndefined()
  })

  /**
   * 이 테스트가 이번 작업의 그물이다. 섹션 id 를 구 이름으로 되돌리면 '언어'·'유효기간' 값이
   * 어디에도 남지 않고 사라지므로 여기서 실패한다.
   */
  it("타입이 바뀐 필드의 값이 '기타' 카드로 살아남는다 (무음 손실 없음)", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(byKey("lang-info.언어")?.value).toEqual(text("영어"))
    expect(byKey("lang-info.유효기간")?.value).toEqual(text("2026-03-10"))
  })

  it("확정본이 묻지 않는 구 필드·표도 '기타' 카드로 보존된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(byKey("lang-info.응시일")?.value).toEqual({ type: "date", date: "2024-03-10" })
    expect(byKey("lang-info.강점 영역")?.value.type).toBe("checklist")
    expect(byKey("lang-info.학습 기간")?.value.type).toBe("period")
    expect(byKey("lang-info.학습 방식")?.value.type).toBe("single-select")

    const table = byKey(OLD_TABLE_KEY)
    expect(table?.type).toBe("repeatable-cell")
    expect(table?.value.type === "repeatable-cell" && table.value.rows[0].cells.situation).toBe(
      "사내 화상회의 통역",
    )
  })

  it("보존·이관된 값이 재저장 왕복에도 살아남는다", () => {
    const first = loadLegacy()
    const payload = toSavePayload(first)
    const second = toExperienceV2(makeExperience({ type: "language", content: payload.content }))

    expect(
      second.extensionBlocks.find(b => b.key === "lang-certificate.시험 / 자격증명")?.value,
    ).toEqual(text("TOEIC"))
    expect(second.customBlocks.find(b => b.key === "lang-info.언어")?.value).toEqual(text("영어"))
    expect(second.customBlocks.find(b => b.key === OLD_TABLE_KEY)?.type).toBe("repeatable-cell")
  })

  /**
   * ⚠️ **섹션 id 교체는 v1 레거시를 지켜주지 못한다.** v1 은 `fields` 맵이 없어 저장 블록의
   * **라벨**로 안정키를 붙이므로(labelKeyMap), 섹션 id 가 무엇이든 라벨이 그대로면 새 키가 붙는다.
   * '언어'(text→single-select)·'유효기간'(text→date)이 정확히 그 경우다.
   *
   * 그러면 폼은 mergeSavedIntoTemplate 로 저장 블록(text)을 살려 화면엔 값이 보이지만, 저장하는
   * 순간 select 키 자리에 text 값이 들어가고 → 다음 로드에서 injectValue 가 거부 + consumedKeys 가
   * orphan 을 막아 값이 사라진다. 한 번 더 저장하면 영구 삭제다(Codex P1).
   */
  describe("v1 레거시는 라벨로 매칭한다 (섹션 id 교체가 닿지 않는 경로)", () => {
    function legacyV1Content(): Record<string, unknown> {
      return {
        title: "영어",
        summary: "",
        status: "complete",
        tags: [],
        coreBlocks: [],
        extensionBlocks: [
          // 라벨은 그대로인데 확정본에서 타입이 바뀐 둘.
          { id: "b1", type: "text", label: "언어", value: text("영어") },
          { id: "b2", type: "text", label: "유효기간", value: text("2026-03-10") },
          // 라벨이 개명됐고 타입은 그대로 — 이관 대상(renamedLabelKeyMap).
          { id: "b3", type: "text", label: "시험/인증명", value: text("TOEIC") },
        ],
        customBlocks: [],
      }
    }

    const loadV1 = () =>
      toExperienceV2(makeExperience({ type: "language", content: legacyV1Content() }))

    it("타입이 바뀐 라벨에는 새 안정키를 붙이지 않고 '기타' 로 보낸다", () => {
      const v1 = loadV1()

      expect(v1.extensionBlocks.find(b => b.key === "lang-overview.언어")).toBeUndefined()
      expect(v1.extensionBlocks.find(b => b.key === "lang-certificate.유효기간")).toBeUndefined()
      expect(v1.customBlocks.find(b => b.label === "언어")?.value).toEqual(text("영어"))
      expect(v1.customBlocks.find(b => b.label === "유효기간")?.value).toEqual(text("2026-03-10"))
    })

    it("타입이 호환되는 라벨은 그대로 이관된다 (과잉 차단이 아니다)", () => {
      const v1 = loadV1()

      expect(v1.extensionBlocks.find(b => b.key === "lang-certificate.시험 / 자격증명")?.value).toEqual(
        text("TOEIC"),
      )
    })

    it("v1 → 저장 → 재로드 왕복에서 값이 사라지지 않는다", () => {
      const payload = toSavePayload(loadV1())
      const second = toExperienceV2(makeExperience({ type: "language", content: payload.content }))

      const survived = (label: string) =>
        [...second.extensionBlocks, ...second.customBlocks].find(
          b => b.label === label && b.value.type === "text",
        )?.value
      expect(survived("언어")).toEqual(text("영어"))
      expect(survived("유효기간")).toEqual(text("2026-03-10"))
    })
  })
})

/**
 * FRT-236 은 독서 템플릿을 확정본 3섹션으로 전면 교체하면서 섹션 id 를 `reading-*` → `book-*` 로
 * 갈아치운다. 어학능력(FRT-210)과 같은 이유다 — 구 '읽은 기간/완독일'(text)이 확정본에선
 * period 이고 구 '인상 깊은 문장'(textarea)은 개조식 리스트라, id 를 유지했다면 안정키가 같아져
 * injectValue 는 값을 안 싣고 consumedKeys 가 orphan 안전망까지 막아 값이 조용히 사라진다.
 */
describe("확정본 전면 교체 값 보존 (FRT-236 독서)", () => {
  const OLD_TABLE_KEY = "reading-apply.적용/실험"

  function legacyReadingContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "사피엔스",
      summary: "인류사 개론",
      status: "complete",
      tags: [],
      fields: {
        // 질문·타입이 같아 새 키로 이관되는 넷.
        "reading-info.도서명": text("사피엔스"),
        "reading-info.저자": text("유발 하라리"),
        "reading-info.읽은 이유": textarea("교양 수업에서 추천받았다"),
        "reading-info.핵심 요약 (3줄)": textarea("인지혁명·농업혁명·과학혁명"),
        // 타입이 바뀌는 둘 — 이관하지 않고 orphan 으로 보존해야 한다(최대 리스크).
        "reading-info.읽은 기간/완독일": text("2024.03 ~ 2024.05"),
        "reading-info.인상 깊은 문장": textarea("우리가 사는 세계는 대부분 상상의 산물이다"),
        // 확정본이 삭제를 지시한 것들.
        "reading-apply.추천 대상": text("역사에 관심 있는 사람"),
        "reading-apply.관련 자료": {
          type: "link",
          url: "https://example.com/review",
          title: "서평",
          description: "",
          linkType: "",
        },
        [OLD_TABLE_KEY]: {
          type: "repeatable-cell",
          columns: [
            { key: "topic", label: "적용할 주제", blockType: "text", required: true },
            { key: "action", label: "내가 한 행동", blockType: "textarea" },
          ],
          rows: [{ id: "r1", cells: { topic: "화폐 개념 재해석", action: "독서 모임에서 발제" } }],
        },
      },
      custom: [],
    }
  }

  const loadLegacy = () =>
    toExperienceV2(makeExperience({ type: "reading", content: legacyReadingContent() }))

  it("질문·타입이 같은 네 필드는 확정본 ① 자리로 이관된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)

    expect(byKey("book-info.도서명")?.value).toEqual(text("사피엔스"))
    expect(byKey("book-info.저자")?.value).toEqual(text("유발 하라리"))
    expect(byKey("book-info.독서 이유")?.value).toEqual(textarea("교양 수업에서 추천받았다"))
    expect(byKey("book-info.요약")?.value).toEqual(textarea("인지혁명·농업혁명·과학혁명"))

    // 옮긴 구 키는 '기타' 에 중복으로 되살아나지 않는다.
    for (const oldKey of [
      "reading-info.도서명",
      "reading-info.저자",
      "reading-info.읽은 이유",
      "reading-info.핵심 요약 (3줄)",
    ]) {
      expect(v2.customBlocks.find(b => b.key === oldKey), oldKey).toBeUndefined()
    }
  })

  /**
   * 이 테스트가 이번 작업의 그물이다. 섹션 id 를 구 이름으로 되돌리면 '읽은 기간/완독일'·
   * '인상 깊은 문장' 값이 어디에도 남지 않고 사라지므로 여기서 실패한다.
   */
  it("타입이 바뀐 필드의 값이 '기타' 카드로 살아남는다 (무음 손실 없음)", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(byKey("reading-info.읽은 기간/완독일")?.value).toEqual(text("2024.03 ~ 2024.05"))
    expect(byKey("reading-info.인상 깊은 문장")?.value).toEqual(
      textarea("우리가 사는 세계는 대부분 상상의 산물이다"),
    )
  })

  it("확정본이 삭제를 지시한 구 필드·표도 '기타' 카드로 보존된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(byKey("reading-apply.추천 대상")?.value).toEqual(text("역사에 관심 있는 사람"))
    expect(byKey("reading-apply.관련 자료")?.value.type).toBe("link")

    const table = byKey(OLD_TABLE_KEY)
    expect(table?.type).toBe("repeatable-cell")
    expect(table?.value.type === "repeatable-cell" && table.value.rows[0].cells.topic).toBe(
      "화폐 개념 재해석",
    )
  })

  it("보존·이관된 값이 재저장 왕복에도 살아남는다", () => {
    const first = loadLegacy()
    const payload = toSavePayload(first)
    const second = toExperienceV2(makeExperience({ type: "reading", content: payload.content }))

    expect(second.extensionBlocks.find(b => b.key === "book-info.도서명")?.value).toEqual(
      text("사피엔스"),
    )
    expect(
      second.customBlocks.find(b => b.key === "reading-info.읽은 기간/완독일")?.value,
    ).toEqual(text("2024.03 ~ 2024.05"))
    expect(second.customBlocks.find(b => b.key === OLD_TABLE_KEY)?.type).toBe("repeatable-cell")
  })

  it("숨김 키도 개명을 따라간다 (감춘 칸이 혼자 되살아나지 않게)", () => {
    const content = { ...legacyReadingContent(), hidden: ["reading-info.읽은 이유"] }
    const exp = toExperienceV2(makeExperience({ type: "reading", content }))

    expect(exp.hiddenKeys).toEqual(["book-info.독서 이유"])
  })

  /**
   * ⚠️ **섹션 id 교체는 v1 레거시를 지켜주지 못한다.** v1 은 `fields` 맵이 없어 저장 블록의
   * **라벨**로 안정키를 붙이므로, 섹션 id 가 무엇이든 라벨이 그대로면 새 키가 붙는다.
   * 독서에는 라벨이 그대로 유지되면서 타입만 바뀌는 필드가 없지만(둘 다 라벨도 함께 바뀐다),
   * 그건 우연이므로 `isInjectableInto` 가 실제로 걸러 주는지 라벨을 고정해 못 박는다.
   */
  describe("v1 레거시는 라벨로 매칭한다 (섹션 id 교체가 닿지 않는 경로)", () => {
    function legacyV1Content(): Record<string, unknown> {
      return {
        title: "사피엔스",
        summary: "",
        status: "complete",
        tags: [],
        coreBlocks: [],
        extensionBlocks: [
          // 라벨이 개명됐고 타입은 그대로 — 이관 대상(renamedLabelKeyMap).
          { id: "b1", type: "text", label: "도서명", value: text("사피엔스") },
          { id: "b2", type: "textarea", label: "읽은 이유", value: textarea("추천받아서") },
          // 확정본에서 타입이 바뀐 둘 — 라벨이 달라 새 키가 붙지 않아야 한다.
          { id: "b3", type: "text", label: "읽은 기간/완독일", value: text("2024.03 ~ 2024.05") },
          { id: "b4", type: "textarea", label: "인상 깊은 문장", value: textarea("상상의 산물") },
        ],
        customBlocks: [],
      }
    }

    const loadV1 = () =>
      toExperienceV2(makeExperience({ type: "reading", content: legacyV1Content() }))

    it("타입이 바뀐 라벨에는 새 안정키를 붙이지 않고 '기타' 로 보낸다", () => {
      const v1 = loadV1()

      expect(v1.extensionBlocks.find(b => b.key === "book-info.독서 기간")?.value).not.toEqual(
        text("2024.03 ~ 2024.05"),
      )
      expect(v1.customBlocks.find(b => b.label === "읽은 기간/완독일")?.value).toEqual(
        text("2024.03 ~ 2024.05"),
      )
      expect(v1.customBlocks.find(b => b.label === "인상 깊은 문장")?.value).toEqual(
        textarea("상상의 산물"),
      )
    })

    it("타입이 호환되는 라벨은 그대로 이관된다 (과잉 차단이 아니다)", () => {
      const v1 = loadV1()

      expect(v1.extensionBlocks.find(b => b.key === "book-info.도서명")?.value).toEqual(
        text("사피엔스"),
      )
      expect(v1.extensionBlocks.find(b => b.key === "book-info.독서 이유")?.value).toEqual(
        textarea("추천받아서"),
      )
    })

    it("v1 → 저장 → 재로드 왕복에서 값이 사라지지 않는다", () => {
      const payload = toSavePayload(loadV1())
      const second = toExperienceV2(makeExperience({ type: "reading", content: payload.content }))

      const survived = (label: string) =>
        [...second.extensionBlocks, ...second.customBlocks].find(b => b.label === label)?.value
      expect(survived("읽은 기간/완독일")).toEqual(text("2024.03 ~ 2024.05"))
      expect(survived("인상 깊은 문장")).toEqual(textarea("상상의 산물"))
      expect(survived("도서명")).toEqual(text("사피엔스"))
    })
  })
})

/**
 * 봉사 확정본(FRT-247)은 구 `vol-info` 1섹션을 `volunteer-info`/`volunteer-reflection` 으로
 * 갈아치운다. 독서·어학과 같은 이유이며, 여기서 갈리는 것은 **무엇을 옮기고 무엇을 안 옮기는가**다:
 * 선택지 도메인이 통째로 달라진 드롭다운 둘('대상'·'활동 형태')을 옮기면 새 목록에 없는 값이
 * 실려 화면에서 고를 수도, 지울 수도 없는 상태가 된다.
 */
describe("확정본 전면 교체 값 보존 (FRT-247 봉사)", () => {
  function legacyVolunteerContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "지역 학습 멘토링",
      summary: "초등학생 학습 멘토",
      status: "complete",
      tags: [],
      fields: {
        // 질문이 같아 새 키로 이관되는 것들.
        "vol-info.봉사활동명": text("OO아동복지센터 학습 멘토링"),
        "vol-info.기관/장소": text("OO복지관"),
        "vol-info.기간": {
          type: "period",
          startDate: "2024-03",
          endDate: "2024-12",
          isOngoing: false,
        },
        "vol-info.총 시간": text("48시간"),
        "vol-info.활동 내용": textarea("매주 토요일 2시간씩 학습을 도왔다"),
        "vol-info.느낀 점/가치관 변화": textarea("상대의 속도에 맞추는 것이 중요하다"),
        "vol-info.봉사 확인서": {
          type: "file",
          fileName: "확인서.pdf",
          description: "",
          evidenceType: "",
        },
        // 선택지 도메인이 달라 옮기면 안 되는 둘 + 확정본에 대응 필드가 없는 하나
        // + 한 줄 칸으로 좁히면 안 되는 하나.
        "vol-info.대상": { type: "single-select", selected: "아동" },
        "vol-info.활동 형태": { type: "single-select", selected: "오프라인" },
        "vol-info.임팩트/변화": textarea("아이들의 자기주도 학습 시간이 늘었다"),
        // 구 '내 역할' 은 안내 문구 없는 **required textarea** 라 문단 답이 흔하다.
        "vol-info.내 역할": textarea("학습 멘토로 참여했다.\n후반부에는 팀 일정 조율도 맡았다."),
      },
      custom: [],
    }
  }

  const loadLegacy = () =>
    toExperienceV2(makeExperience({ type: "volunteer", content: legacyVolunteerContent() }))

  it("질문이 같은 필드는 확정본 자리로 이관된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)

    expect(byKey("volunteer-info.봉사 활동명")?.value).toEqual(text("OO아동복지센터 학습 멘토링"))
    expect(byKey("volunteer-info.봉사 기관")?.value).toEqual(text("OO복지관"))
    expect(byKey("volunteer-info.활동 기간")?.value).toMatchObject({ startDate: "2024-03" })
    expect(byKey("volunteer-info.총 봉사시간")?.value).toEqual(text("48시간"))
    expect(byKey("volunteer-reflection.봉사 내용")?.value).toEqual(
      textarea("매주 토요일 2시간씩 학습을 도왔다"),
    )
    expect(byKey("volunteer-reflection.배운 점")?.value).toEqual(
      textarea("상대의 속도에 맞추는 것이 중요하다"),
    )
    expect(byKey("volunteer-info.봉사 확인서 첨부")?.value.type).toBe("file")

    // 옮긴 구 키는 '기타' 에 중복으로 되살아나지 않는다.
    for (const oldKey of [
      "vol-info.봉사활동명",
      "vol-info.기관/장소",
      "vol-info.기간",
      "vol-info.총 시간",
      "vol-info.활동 내용",
      "vol-info.느낀 점/가치관 변화",
      "vol-info.봉사 확인서",
    ]) {
      expect(v2.customBlocks.find(b => b.key === oldKey), oldKey).toBeUndefined()
    }
  })

  /**
   * 이 테스트가 이번 작업의 그물이다. '대상'(5종)과 '활동 형태'(4종)를 확정본 '봉사 분야'(11종)·
   * '참여 형태'(5종)로 옮기면 저장된 '아동'·'오프라인' 이 새 선택지에 없는 값으로 들어가
   * 드롭다운이 고를 수도 지울 수도 없는 상태가 된다. 옛 답이 새 질문의 답으로 둔갑하는 것도 같다.
   */
  it("선택지가 달라진 드롭다운은 이관하지 않고 '기타' 카드로 보존한다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(byKey("vol-info.대상")?.value).toMatchObject({ selected: "아동" })
    expect(byKey("vol-info.활동 형태")?.value).toMatchObject({ selected: "오프라인" })

    const field = v2.extensionBlocks.find(b => b.key === "volunteer-info.봉사 분야")
    expect(field?.value).toMatchObject({ selected: "" })
    const participation = v2.extensionBlocks.find(b => b.key === "volunteer-info.참여 형태")
    expect(participation?.value).toMatchObject({ selected: "" })
  })

  it("확정본에 대응 필드가 없는 '임팩트/변화'도 '기타' 카드로 보존된다", () => {
    const v2 = loadLegacy()
    expect(v2.customBlocks.find(b => b.key === "vol-info.임팩트/변화")?.value).toEqual(
      textarea("아이들의 자기주도 학습 시간이 늘었다"),
    )
  })

  /**
   * `isInjectableInto` 는 text↔textarea 를 허용하지만, **허용된다고 옮겨도 되는 것은 아니다.**
   * 구 '내 역할' 은 안내 문구 없는 required textarea 라 문단 답이 흔한데 확정본 '역할' 은
   * "예: 학습 멘토, 팀장" 짜리 한 줄 `<input>` 이다. `<input>` 은 값에서 개행을 지우므로
   * (HTML 명세의 value sanitization) 옮기는 순간 여러 줄이 구분자 없이 붙어 보이고, 사용자가
   * 그 칸을 한 번만 건드리면 붙은 값이 그대로 저장돼 원문이 영구히 사라진다(Codex P2).
   */
  it("문단으로 적은 '내 역할'은 한 줄 '역할' 칸으로 옮기지 않고 '기타'에 보존한다", () => {
    const v2 = loadLegacy()

    expect(v2.customBlocks.find(b => b.key === "vol-info.내 역할")?.value).toEqual(
      textarea("학습 멘토로 참여했다.\n후반부에는 팀 일정 조율도 맡았다."),
    )
    expect(v2.extensionBlocks.find(b => b.key === "volunteer-info.역할")?.value).toEqual(text(""))
  })

  it("보존·이관된 값이 재저장 왕복에도 살아남는다", () => {
    const payload = toSavePayload(loadLegacy())
    const second = toExperienceV2(makeExperience({ type: "volunteer", content: payload.content }))

    expect(second.extensionBlocks.find(b => b.key === "volunteer-info.봉사 활동명")?.value).toEqual(
      text("OO아동복지센터 학습 멘토링"),
    )
    expect(second.customBlocks.find(b => b.key === "vol-info.대상")?.value).toMatchObject({
      selected: "아동",
    })
  })

  it("숨김 키도 개명을 따라간다 (감춘 칸이 혼자 되살아나지 않게)", () => {
    const content = { ...legacyVolunteerContent(), hidden: ["vol-info.총 시간"] }
    const exp = toExperienceV2(makeExperience({ type: "volunteer", content }))

    expect(exp.hiddenKeys).toEqual(["volunteer-info.총 봉사시간"])
  })
})

/**
 * 해외경험 확정본(FRT-249)은 구 `overseas-info`/`overseas-challenges` 를 `overseas-program`/
 * `overseas-reflection`/`overseas-activities` 로 갈아치운다. 봉사(FRT-247)와 갈리는 지점 둘:
 *  · 구 '경험 유형'(5종)과 새 '경험 유형'(9종)은 **라벨도 타입도 같고 선택지 도메인만 다르다.**
 *    섹션 id 를 안 갈면 키가 같아 값이 그냥 실려 버린다 — 교체가 곧 방어선이다.
 *  · 파일 증빙은 옮겨도 된다. `FileBlock` 이 옛 자유입력 `evidenceType` 이 새 options 에 없으면
 *    **선택지에 덧붙여** 살려 두기 때문에, single-select 처럼 값이 박히지 않는다.
 */
describe("확정본 전면 교체 값 보존 (FRT-249 해외경험)", () => {
  function legacyOverseasContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "베를린 교환학생",
      summary: "한 학기 교환학생",
      status: "complete",
      tags: [],
      fields: {
        // ⚠️ 개편 전 폼에서 **코어 '기간' 은 화면에 뜬 적이 없다** — 구 `overseas-info` 에도
        // '기간' 앵커가 있어 `computeFormCards` 의 dedup 이 빈 코어 블록을 지웠다. 그래서 실제
        // 레코드의 코어 기간은 이렇게 비어 있고, 사용자가 채운 값은 `overseas-info.기간` 에 있다.
        // 이 픽스처가 처음엔 코어를 채워 뒀던 탓에 P1 을 못 잡았다(FRT-249, Codex P1).
        "core.기간": { type: "period", start: "", end: "", isCurrent: false },
        // 질문이 같아 새 키로 이관되는 것들.
        "overseas-info.기간": { type: "period", start: "2024-04", end: "2024-07", isCurrent: false },
        "overseas-info.국가/도시": text("독일 베를린"),
        "overseas-challenges.증빙": {
          type: "file",
          fileName: "수료증.pdf",
          description: "교환학생 수료증",
          // 구 템플릿은 증빙 유형이 자유 입력이었다 — 새 options 3종에 없는 값이다.
          evidenceType: "학교 발급 서류",
        },
        // 선택지 도메인이 달라 옮기면 안 되는 하나.
        "overseas-info.경험 유형": { type: "single-select", selected: "연수" },
        // 확정본이 삭제를 지시했거나 질문이 다른 것들.
        "overseas-info.목적": textarea("전공 수업을 현지에서 듣고 싶었다"),
        "overseas-info.활동 요약": textarea("국제 마케팅 팀 프로젝트에 참여했다"),
        "overseas-info.언어 사용 수준": text("일상 회화 가능"),
        "overseas-challenges.성과/산출물": textarea("팀 프로젝트 최우수상"),
      },
      custom: [],
    }
  }

  const loadLegacy = () =>
    toExperienceV2(makeExperience({ type: "overseas", content: legacyOverseasContent() }))

  /** 확정본 '경험 유형' 9종을 템플릿에서 읽는다 — 목록을 테스트에 복제하지 않는다. */
  const overseasKindOptions = (): string[] =>
    getTemplateForType("overseas")
      .extensions.flatMap(s => s.blocks)
      .find(b => b.key === "overseas-program.경험 유형")?.options ?? []

  it("질문이 같은 필드는 확정본 자리로 이관된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)

    expect(byKey("overseas-program.국가 / 도시")?.value).toEqual(text("독일 베를린"))
    expect(byKey("overseas-program.증빙 자료")?.value).toMatchObject({
      fileName: "수료증.pdf",
      evidenceType: "학교 발급 서류",
    })

    // 옮긴 구 키는 '기타' 에 중복으로 되살아나지 않는다.
    for (const oldKey of ["overseas-info.국가/도시", "overseas-challenges.증빙"]) {
      expect(v2.customBlocks.find(b => b.key === oldKey), oldKey).toBeUndefined()
    }
  })

  /**
   * 이 테스트가 이번 작업의 그물이다. 구 '경험 유형'(교환학생/연수/여행/해외 인턴/기타)을 확정본
   * 9종으로 옮기면 저장된 '연수'가 새 목록에 없는 값으로 들어가 드롭다운에서 고를 수도 지울 수도
   * 없게 된다(FRT-247 봉사 '대상'·'활동 형태'와 같은 자리).
   *
   * ⚠️ 판정 단위는 **필드가 아니라 값**이다 — '연수'처럼 새 목록에 없는 답만 여기 해당한다.
   * 그대로 남은 답('교환학생'·'기타')은 아래 테스트대로 이관한다(FRT-249, Codex P2).
   */
  it("선택지가 달라진 '경험 유형'은 이관하지 않고 '기타' 카드로 보존한다", () => {
    const v2 = loadLegacy()

    expect(v2.customBlocks.find(b => b.key === "overseas-info.경험 유형")?.value).toMatchObject({
      selected: "연수",
    })
    expect(
      v2.extensionBlocks.find(b => b.key === "overseas-program.경험 유형")?.value,
    ).toMatchObject({ selected: "" })
  })

  /**
   * 도메인이 교체돼도 **답 자체가 새 목록에 그대로 남아 있으면** 옮긴다. 안 옮기면 새 '경험 유형'
   * 은 값 없는 **required** 칸이 되고, 완료 저장된 레코드를 다시 연 사용자는 **바뀐 것도 없는
   * 답을 다시 골라야** 저장할 수 있다 — 코어 '기간' 에서 겪은 P1 과 같은 실패 양식이다.
   *
   * 옮길 때 선택지는 **템플릿 것으로 정규화**해야 한다. 저장값이 들고 온 옛 5종 목록을 그대로
   * 실으면 `SingleSelectBlock` 이 그쪽을 우선해(`val.options.length > 0 ? val.options : ...`)
   * 확정본이 새로 준 워킹홀리데이·해외 봉사 같은 선택지를 영영 못 받는다.
   */
  it("확정본 목록에 그대로 남은 답은 새 자리로 옮기고 선택지도 확정본 것으로 바꾼다", () => {
    const content = legacyOverseasContent()
    const fields = content.fields as Record<string, BlockValue>
    fields["overseas-info.경험 유형"] = {
      type: "single-select",
      selected: "교환학생",
      options: ["교환학생", "연수", "여행", "해외 인턴", "기타"],
    }
    const v2 = toExperienceV2(makeExperience({ type: "overseas", content }))

    const moved = v2.extensionBlocks.find(b => b.key === "overseas-program.경험 유형")
    expect(moved?.value).toMatchObject({ selected: "교환학생" })
    expect((moved?.value as SingleSelectBlockValue).options).toEqual(overseasKindOptions())
    // 옮긴 값이 '기타' 에 중복으로 남지 않는다.
    expect(v2.customBlocks.find(b => b.key === "overseas-info.경험 유형")).toBeUndefined()
  })

  /**
   * 개편 전 폼은 코어 증빙(`isEvidenceBlock` 이라 dedup 을 타지 않아 '활동 증빙' 카드로 **항상**
   * 보였다)과 `overseas-challenges.증빙`(접힌 섹션 안)을 **동시에** 노출했다. 그래서 첨부가
   * 코어 쪽에만 있는 레코드가 실재한다. 확정본은 증빙을 ① 안에 두므로 코어를 뺐는데
   * (`CORE_EXCLUDE`), 옮기지 않으면 그 파일은 '기타' 로 밀리고 ① 증빙 칸은 빈 채로 남는다.
   *
   * 전역 `RENAMED_FIELD_KEYS` 로는 `core.*` 를 출발점으로 쓸 수 없다 — 다른 9유형까지 끌려간다.
   * 유형 스코프 맵이라야 표현되는 이관이다(FRT-249, Codex P2).
   */
  it("코어에만 남은 증빙은 확정본 ① 의 증빙 자료로 옮긴다", () => {
    const content = legacyOverseasContent()
    const fields = content.fields as Record<string, BlockValue>
    delete fields["overseas-challenges.증빙"]
    fields["core.증빙 자료"] = {
      type: "file",
      fileName: "항공권.pdf",
      description: "출국 증빙",
      evidenceType: "기타",
    }
    const v2 = toExperienceV2(makeExperience({ type: "overseas", content }))

    expect(
      v2.extensionBlocks.find(b => b.key === "overseas-program.증빙 자료")?.value,
    ).toMatchObject({ fileName: "항공권.pdf" })
    expect(v2.customBlocks.find(b => b.key === "core.증빙 자료")).toBeUndefined()
  })

  /**
   * 둘 다 채워진 레코드에서는 **유형 섹션 쪽이 이기고 코어 값은 '기타' 에 남는다.** 목적지가 찬
   * 상태에서 구 키를 지우면 첨부가 **조용히 사라진다** — 전역 `applyRenamedKeys` 가 그렇게
   * 동작하므로(목적지가 차 있으면 구 키를 보존 없이 delete) 유형 스코프 이관은 반대로,
   * 못 옮길 때 **구 키를 손대지 않는다**.
   */
  it("증빙이 양쪽에 다 있으면 유형 섹션 값이 이기고 코어 값은 '기타' 에 보존된다", () => {
    const content = legacyOverseasContent()
    const fields = content.fields as Record<string, BlockValue>
    fields["core.증빙 자료"] = {
      type: "file",
      fileName: "항공권.pdf",
      description: "출국 증빙",
      evidenceType: "기타",
    }
    const v2 = toExperienceV2(makeExperience({ type: "overseas", content }))

    expect(
      v2.extensionBlocks.find(b => b.key === "overseas-program.증빙 자료")?.value,
    ).toMatchObject({ fileName: "수료증.pdf" })
    expect(v2.customBlocks.find(b => b.key === "core.증빙 자료")?.value).toMatchObject({
      fileName: "항공권.pdf",
    })
  })

  /**
   * 타입이 안 맞는 값(손상된 레거시 데이터)은 옮기지 않는다. 옮기면 구 키를 지운 뒤 하류
   * `injectValue` 가 타입 불일치로 주입을 **생략**해, 값이 어디에도 없이 사라진다.
   */
  it("타입이 맞지 않는 코어 값은 옮기지 않고 '기타' 에 남긴다", () => {
    const content = legacyOverseasContent()
    const fields = content.fields as Record<string, BlockValue>
    delete fields["overseas-challenges.증빙"]
    fields["core.증빙 자료"] = text("증빙 없음")
    const v2 = toExperienceV2(makeExperience({ type: "overseas", content }))

    expect(v2.customBlocks.find(b => b.key === "core.증빙 자료")?.value).toEqual(text("증빙 없음"))
    expect(
      v2.extensionBlocks.find(b => b.key === "overseas-program.증빙 자료")?.value,
    ).toMatchObject({ fileName: "" })
  })

  /**
   * '언어 사용 수준'→'사용 언어' 는 타입이 같아 `isInjectableInto` 가 통과시키지만 **묻는 것이
   * 다르다** — 수준(일상 회화 가능)과 언어명(독일어)은 다른 답이다. 옮기면 옛 답이 새 질문의
   * 답으로 둔갑한다(FRT-211 의 '개명 vs 대체' 기준).
   */
  it("질문이 다른 '언어 사용 수준'은 '사용 언어'로 옮기지 않는다", () => {
    const v2 = loadLegacy()

    expect(v2.customBlocks.find(b => b.key === "overseas-info.언어 사용 수준")?.value).toEqual(
      text("일상 회화 가능"),
    )
    expect(v2.extensionBlocks.find(b => b.key === "overseas-program.사용 언어")?.value).toEqual(
      text(""),
    )
  })

  it("확정본이 삭제한 칸들도 '기타' 카드로 보존된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)?.value

    expect(byKey("overseas-info.목적")).toEqual(textarea("전공 수업을 현지에서 듣고 싶었다"))
    expect(byKey("overseas-info.활동 요약")).toEqual(
      textarea("국제 마케팅 팀 프로젝트에 참여했다"),
    )
    expect(byKey("overseas-challenges.성과/산출물")).toEqual(textarea("팀 프로젝트 최우수상"))
  })

  /**
   * ⚠️ 이번 라운드의 핵심 그물(FRT-249, Codex P1). 코어 '기간'을 남기는 설계에서는 사용자가
   * 채운 `overseas-info.기간` 이 '기타' 로 밀리고 화면에는 **값 없는 required 기간 칸**이 떴다 —
   * 완료 저장된 레코드를 다시 열면 저장이 막힌다. 확정본 ① 이 자기 '기간'을 갖도록 되돌린 뒤
   * 그 자리로 이관한다. 목적지가 새 키라 `applyRenamedKeys` 의 "목적지가 차 있으면 진다"에
   * 걸리지 않는다.
   */
  it("구 '기간'은 확정본 ① 의 '기간' 칸으로 이관된다 — 빈 required 칸이 뜨지 않게", () => {
    const v2 = loadLegacy()

    expect(v2.extensionBlocks.find(b => b.key === "overseas-program.기간")?.value).toMatchObject({
      start: "2024-04",
      end: "2024-07",
    })
    // 옮긴 구 키가 '기타' 에 중복으로 되살아나지 않는다.
    expect(v2.customBlocks.find(b => b.key === "overseas-info.기간")).toBeUndefined()
  })

  it("코어에서 빠진 '기간'은 블록으로도 '기타'로도 남지 않는다 (빈 값이라 보존 대상이 아님)", () => {
    const v2 = loadLegacy()

    expect(v2.coreBlocks.find(b => b.key === "core.기간")).toBeUndefined()
    expect(v2.customBlocks.find(b => b.key === "core.기간")).toBeUndefined()
  })

  /**
   * 코어 기간이 채워진 레코드가 어떤 경로로든 있었다면, 코어에서 빼는 순간 그 값이 조용히
   * 사라지면 안 된다. orphan 안전망이 '기타' 로 받는지 따로 세운다 — 이관 대상(구 `overseas-info`
   * 쪽)이 이겼다고 해서 진 쪽을 버리지 않는다는 뜻이다.
   */
  it("코어 기간이 채워진 예외 레코드는 '기타' 카드로 보존된다", () => {
    const content = legacyOverseasContent()
    ;(content.fields as Record<string, unknown>)["core.기간"] = {
      type: "period",
      start: "2024-03",
      end: "2024-08",
      isCurrent: false,
    }
    const v2 = toExperienceV2(makeExperience({ type: "overseas", content }))

    expect(v2.customBlocks.find(b => b.key === "core.기간")?.value).toMatchObject({
      start: "2024-03",
      end: "2024-08",
    })
    // 사용자가 실제로 채운 쪽은 여전히 확정본 자리에 실린다.
    expect(v2.extensionBlocks.find(b => b.key === "overseas-program.기간")?.value).toMatchObject({
      start: "2024-04",
    })
  })

  it("보존·이관된 값이 재저장 왕복에도 살아남는다", () => {
    const payload = toSavePayload(loadLegacy())
    const second = toExperienceV2(makeExperience({ type: "overseas", content: payload.content }))

    expect(second.extensionBlocks.find(b => b.key === "overseas-program.국가 / 도시")?.value).toEqual(
      text("독일 베를린"),
    )
    expect(second.customBlocks.find(b => b.key === "overseas-info.경험 유형")?.value).toMatchObject({
      selected: "연수",
    })
  })

  it("숨김 키도 개명을 따라간다 (감춘 칸이 혼자 되살아나지 않게)", () => {
    const content = { ...legacyOverseasContent(), hidden: ["overseas-info.국가/도시"] }
    const exp = toExperienceV2(makeExperience({ type: "overseas", content }))

    expect(exp.hiddenKeys).toEqual(["overseas-program.국가 / 도시"])
  })

  /**
   * ⚠️ 섹션 id 교체는 **v2 만** 지킨다(FRT-210 의 구조, Codex P2). v1 은 `fields` 맵이 없어
   * **라벨로** 템플릿 필드를 찾으므로 '경험 유형'은 라벨이 그대로라 그 방어선을 통과해 버린다.
   * 통과시키면 렌더러가 `val.options` 를 우선하는 탓에(SingleSelectBlock) 구 레코드가 **옛 5종
   * 목록을 그대로 달고** 새 키에 눌러앉아, 확정본 9종을 영영 못 받고 다음 저장에 v2 로 굳는다.
   */
  it("v1 레거시의 '경험 유형'도 이관하지 않는다 — 라벨 매칭이 섹션 id 교체를 우회하지 못하게", () => {
    const v1 = toExperienceV2(
      makeExperience({
        type: "overseas",
        content: {
          title: "베를린 교환학생",
          summary: "",
          status: "complete",
          tags: [],
          coreBlocks: [],
          extensionBlocks: [
            {
              id: "b1",
              type: "single-select",
              label: "경험 유형",
              value: {
                type: "single-select",
                selected: "연수",
                options: ["교환학생", "연수", "여행", "해외 인턴", "기타"],
              },
            },
            // 대조군 — 라벨도 질문도 그대로인 필드는 v1 에서도 정상 매칭된다.
            { id: "b2", type: "text", label: "사용 언어", value: text("독일어") },
          ],
          customBlocks: [],
        },
      }),
    )

    expect(v1.extensionBlocks.find(b => b.label === "경험 유형")).toBeUndefined()
    expect(v1.customBlocks.find(b => b.label === "경험 유형")?.value).toMatchObject({
      selected: "연수",
    })
    expect(v1.extensionBlocks.find(b => b.key === "overseas-program.사용 언어")?.value).toEqual(
      text("독일어"),
    )
  })

  /**
   * v1 도 v2 와 **같은 판정**을 받아야 한다. 한쪽만 값을 이어받으면 스키마 버전이 사용자 눈에
   * 보이는 차이가 되고, 그건 v1 을 통째로 막았던 위 테스트가 피하려던 것과 같은 종류의 어긋남이다.
   * v1 은 라벨로 매칭하므로 선택지 정규화도 여기서 해줘야 한다 — 저장 블록의 값을 그대로 두면
   * `mergeSavedIntoTemplate` 이 옛 5종 목록째 실어 나른다.
   */
  it("v1 레거시도 같은 값 조건부 판정을 받는다 — 남은 답은 확정본 선택지로 매칭된다", () => {
    const v1 = toExperienceV2(
      makeExperience({
        type: "overseas",
        content: {
          title: "베를린 교환학생",
          summary: "",
          status: "complete",
          tags: [],
          coreBlocks: [],
          extensionBlocks: [
            {
              id: "b1",
              type: "single-select",
              label: "경험 유형",
              value: {
                type: "single-select",
                selected: "교환학생",
                options: ["교환학생", "연수", "여행", "해외 인턴", "기타"],
              },
            },
          ],
          customBlocks: [],
        },
      }),
    )

    const moved = v1.extensionBlocks.find(b => b.key === "overseas-program.경험 유형")
    expect(moved?.value).toMatchObject({ selected: "교환학생" })
    expect((moved?.value as SingleSelectBlockValue).options).toEqual(overseasKindOptions())
    expect(v1.customBlocks.find(b => b.label === "경험 유형")).toBeUndefined()
  })
})

describe("확정본 전면 교체 값 보존 (FRT-267 창작물)", () => {
  /**
   * ⚠️ 레거시 픽스처는 "그럴듯한 값"이 아니라 **그 시점의 렌더 경로가 실제로 만들어낼 수 있는 값**
   * 이어야 한다(FRT-249 Codex P1 을 놓친 이유). 코어 4칸이 서로 다른 이유로 갈린다:
   *  · `core.기간` — 구 `cw-info` 에 '제작 기간'(SEMANTIC_GROUPS.period) 앵커가 있어 dedup 이
   *    빈 코어를 화면에서 지웠다 → 채울 방법이 없었으므로 **항상 비어 있다.**
   *  · `core.핵심 성과` — 구 `cw-process` 에 '반응/성과'(achievement) 앵커가 있어 같은 이유로 비어 있다.
   *  · `core.내 역할/기여도` — role 동의어 앵커가 **하나도 없어 실제로 렌더됐다** → 값이 있을 수 있다.
   *    이 한 줄이 `CORE_EXCLUDE` 에서 이 필드만 뺀 근거이자, 그 판정을 지키는 그물이다.
   *  · `core.증빙 자료` — `isEvidenceBlock` 이라 dedup 자체를 타지 않고 '활동 증빙' 카드에 **항상**
   *    보였다 → 값이 있을 수 있다.
   */
  function legacyCreativeContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "골목 기록 프로젝트",
      summary: "사진과 인터뷰를 엮은 독립 잡지",
      status: "complete",
      tags: [],
      fields: {
        "core.기간": { type: "period", start: "", end: "", isCurrent: false },
        "core.핵심 성과": textarea(""),
        "core.내 역할/기여도": textarea("기획·촬영·편집을 모두 맡았습니다."),
        "core.증빙 자료": {
          type: "file",
          fileName: "졸업전시-도록.pdf",
          description: "졸업전시 도록",
          evidenceType: "전시 도록",
        },
        // 질문이 같아 새 키로 이관되는 것들.
        "cw-info.작품/작업물명": text("골목의 기록"),
        "cw-info.제작 기간": { type: "period", start: "2024-03", end: "2024-06", isCurrent: false },
        "cw-info.사용 도구": { type: "tags", tags: ["Lightroom", "InDesign"] },
        "cw-info.의도/주제": textarea("사라져가는 골목 문화를 기록하고 싶었습니다."),
        "cw-process.반응/성과": textarea("졸업전시 우수작으로 선정됐습니다."),
        // 선택지 도메인이 달라 **값 조건부**인 것 — '디자인'은 새 13종에 그대로 없다.
        "cw-info.분야": { type: "single-select", selected: "디자인", options: ["디자인", "글", "영상", "음악", "사진", "일러스트", "기타"] },
        // 타입이 달라 못 옮기는 것들.
        "cw-process.제작 과정": {
          type: "repeatable-cell",
          columns: [
            { key: "step", label: "단계명", blockType: "text" },
            { key: "work", label: "한 일", blockType: "textarea" },
          ],
          rows: [{ id: "r1", cells: { step: "리서치", work: "골목 20곳 답사" } }],
        },
        "cw-process.공개 링크": { type: "link", url: "https://behance.net/golmok" },
        // 확정본에 대응 칸이 없는 것들.
        "cw-info.한 줄 소개": text("골목을 기록한 독립 잡지"),
        "cw-process.저작권/사용 범위": text("CC BY-NC"),
        // 범용 '확장 입력' — 창작물은 자기 detail 섹션이 없어 이 8필드가 실제로 렌더됐다.
        "extended.배운 점": textarea("편집 단계에서 톤이 결정된다는 걸 배웠습니다."),
      },
      custom: [],
    }
  }

  const loadLegacy = () =>
    toExperienceV2(makeExperience({ type: "creative-work", content: legacyCreativeContent() }))

  /** 확정본 '유형 / 매체' 13종을 템플릿에서 읽는다 — 목록을 테스트에 복제하지 않는다. */
  const mediumOptions = (): string[] =>
    getTemplateForType("creative-work")
      .extensions.flatMap(s => s.blocks)
      .find(b => b.key === "creative-info.유형 / 매체")?.options ?? []

  it("질문이 같은 필드는 확정본 자리로 이관된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)

    expect(byKey("creative-info.작품명 / 작업물명")?.value).toEqual(text("골목의 기록"))
    expect(byKey("creative-info.작업 기간")?.value).toMatchObject({ start: "2024-03", end: "2024-06" })
    expect(byKey("creative-info.사용 툴 / 기술")?.value).toMatchObject({ tags: ["Lightroom", "InDesign"] })
    expect(byKey("creative-detail.작업 배경 / 컨셉")?.value).toEqual(
      textarea("사라져가는 골목 문화를 기록하고 싶었습니다."),
    )
    expect(byKey("creative-detail.반응 / 피드백")?.value).toEqual(
      textarea("졸업전시 우수작으로 선정됐습니다."),
    )

    // 옮긴 구 키는 '기타' 에 중복으로 되살아나지 않는다.
    for (const oldKey of [
      "cw-info.작품/작업물명",
      "cw-info.제작 기간",
      "cw-info.사용 도구",
      "cw-info.의도/주제",
      "cw-process.반응/성과",
    ]) {
      expect(v2.customBlocks.find(b => b.key === oldKey), oldKey).toBeUndefined()
    }
  })

  /**
   * 구 '분야'(7종)와 확정본 '유형 / 매체'(13종)는 **같은 질문**(이 작업의 매체가 무엇인가)이지만
   * 선택지가 통째로 다시 짜였다. '디자인'은 새 목록에서 그래픽/브랜딩/웹·앱 UI/제품/공간으로
   * 갈라졌으므로 어느 하나로 좁히면 **답이 둔갑한다** — 옮기지 않고 사용자가 원본을 보고 고르게 둔다
   * (FRT-249 ⑨ 의 값 조건부 이관, 판정 단위는 필드가 아니라 **값**).
   */
  it("새 목록에 없는 '분야' 값은 이관하지 않고 '기타' 카드로 보존한다", () => {
    const v2 = loadLegacy()

    expect(v2.customBlocks.find(b => b.key === "cw-info.분야")?.value).toMatchObject({
      selected: "디자인",
    })
    expect(
      v2.extensionBlocks.find(b => b.key === "creative-info.유형 / 매체")?.value,
    ).toMatchObject({ selected: "" })
  })

  /**
   * 답이 새 목록에 그대로 남아 있으면 옮긴다. 안 옮기면 '유형 / 매체'는 값 없는 **required** 칸이
   * 되고, 완료 저장된 레코드를 다시 연 사용자가 **바뀐 것도 없는 답을 다시 골라야** 저장된다.
   * 옮길 때 선택지는 템플릿 것으로 정규화한다 — 저장값이 들고 온 옛 7종이 그대로 실리면
   * `SingleSelectBlock` 이 그쪽을 우선해 확정본이 새로 준 13종을 영영 못 받는다.
   */
  it("확정본 목록에 그대로 남은 답('사진')은 옮기고 선택지도 확정본 것으로 바꾼다", () => {
    const content = legacyCreativeContent()
    const fields = content.fields as Record<string, BlockValue>
    fields["cw-info.분야"] = {
      type: "single-select",
      selected: "사진",
      options: ["디자인", "글", "영상", "음악", "사진", "일러스트", "기타"],
    }
    const v2 = toExperienceV2(makeExperience({ type: "creative-work", content }))

    const moved = v2.extensionBlocks.find(b => b.key === "creative-info.유형 / 매체")
    expect(moved?.value).toMatchObject({ selected: "사진" })
    expect((moved?.value as SingleSelectBlockValue).options).toEqual(mediumOptions())
    expect(v2.customBlocks.find(b => b.key === "cw-info.분야")).toBeUndefined()
  })

  /**
   * 확정본 ② '제작 과정'은 구 4컬럼 표와 **라벨이 같은 textarea** 다. 타입이 달라
   * `isInjectableInto` 가 막지 않으면 표가 통째로 사라진다 — 섹션 id 교체와 타입 판정이
   * 이중으로 지키는 자리다.
   */
  it("타입이 달라진 필드는 확정본 자리에 실리지 않고 '기타' 카드로 보존한다", () => {
    const v2 = loadLegacy()

    const table = v2.customBlocks.find(b => b.key === "cw-process.제작 과정")
    expect((table?.value as RepeatableCellBlockValue).rows).toHaveLength(1)
    expect(v2.extensionBlocks.find(b => b.key === "creative-detail.제작 과정")?.value).toEqual(
      textarea(""),
    )

    expect(v2.customBlocks.find(b => b.key === "cw-process.공개 링크")?.value).toMatchObject({
      url: "https://behance.net/golmok",
    })
  })

  /**
   * 코어 증빙은 옮길 자리가 없다 — 확정본 ① 의 '작품 링크 / 파일'은 `repeatable-cell` 이라
   * `file` 값을 받을 수 없다(해외경험이 쓴 `V2_CORE_SCOPED_MIGRATIONS` 는 타입이 맞을 때만 성립).
   * 그래서 '기타'로 보존하는 것이 유일한 무손실 경로이고, 그 사실을 여기서 고정한다.
   */
  it("확정본에 대응 칸이 없는 값 · 코어 증빙 · 범용 확장 필드는 '기타' 카드로 보존된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(byKey("cw-info.한 줄 소개")?.value).toEqual(text("골목을 기록한 독립 잡지"))
    expect(byKey("cw-process.저작권/사용 범위")?.value).toEqual(text("CC BY-NC"))
    expect(byKey("core.증빙 자료")?.value).toMatchObject({ fileName: "졸업전시-도록.pdf" })
    // detail 섹션이 생기면서 범용 '확장 입력'이 걷힌다 — 그 값도 사라지지 않는다.
    // (확정본 '이 작업이 나에게 남긴 것'으로의 이관은 FRT-248 범위다.)
    expect(byKey("extended.배운 점")?.value).toEqual(
      textarea("편집 단계에서 톤이 결정된다는 걸 배웠습니다."),
    )
  })

  /**
   * ⚠️ 선행 5종과 **반대 결론**을 지키는 그물이다. 봉사·해외경험은 코어 '내 역할/기여도'를
   * `CORE_EXCLUDE` 로 뺐지만 창작물은 빼지 않는다 — 구 템플릿에 role 앵커가 없어 이 칸이 실제로
   * 렌더됐고, 빼면 사용자가 적어 둔 역할 서술이 '기타'로 밀리기 때문이다.
   *
   * ⚠️ 다만 **남기는 것만으로는 부족했다.** 코어를 남긴 채 확정본 '역할'을 새로 띄우면 값이 든
   * 코어는 dedup 을 안 타므로 권위 있는 칸이 **둘**이 되고, `pickValue` 는 정확 라벨을 먼저
   * 고르므로(build-portfolio.ts) 사용자가 새 '역할'을 고쳐도 포트폴리오는 옛 코어 값을 계속
   * 발행한다 — 화면과 산출물이 어긋난다(FRT-267 Codex P2). 그래서 값을 확정본 칸으로 **옮긴다**:
   * 코어는 비어 dedup 이 숨기고, 옮겨진 값은 '개인 작업'에서도 화면에 남는다.
   */
  it("코어 '내 역할/기여도' 값은 확정본 '역할'로 옮겨 권위 있는 칸을 하나로 만든다", () => {
    const v2 = loadLegacy()

    // 값은 확정본 칸에 있다(textarea→text 는 `isInjectableInto` 가 허용, 문자열은 그대로).
    expect(v2.extensionBlocks.find(b => b.key === "creative-info.역할")?.value).toEqual(
      text("기획·촬영·편집을 모두 맡았습니다."),
    )
    // 코어에는 남지 않는다 — 남으면 두 칸이 되어 발행이 옛 값으로 굳는다.
    const coreRole = v2.coreBlocks.find(b => b.key === "core.내 역할/기여도")
    expect(coreRole === undefined || isBlockEmpty(coreRole)).toBe(true)
    // '기타'로도 밀리지 않는다 — 옮긴 것이지 버린 것이 아니다.
    expect(v2.customBlocks.find(b => b.key === "core.내 역할/기여도")).toBeUndefined()
    // 반면 앵커가 있어 늘 비어 있던 코어 둘은 템플릿에서 아예 사라진다.
    for (const gone of ["core.기간", "core.핵심 성과"]) {
      expect(v2.coreBlocks.find(b => b.key === gone), gone).toBeUndefined()
    }
  })

  /**
   * ⚠️ 이관의 경계 — 확정본 '역할'은 한 줄 `text` 다. `isInjectableInto` 는 text↔textarea 를
   * 호환으로 보지만(저장 형식이 같은 문자열이라 맞는 말이다), 화면의 `<input>` 은 개행을 지운다.
   * 문단이 든 구 값을 옮기면 첫 화면부터 한 줄로 뭉개져 보이고 한 글자만 고쳐도 그대로 저장된다.
   * 옮기지 않고 구 코어 칸에 남기면 값도 문단 구조도 그대로다(FRT-267 Codex P2).
   */
  it("여러 줄 역할 값은 한 줄 '역할' 칸으로 옮기지 않고 원본을 남긴다", () => {
    const content = legacyCreativeContent()
    ;(content.fields as Record<string, BlockValue>)["core.내 역할/기여도"] = {
      type: "textarea",
      text: "기획을 맡았습니다.\n\n촬영과 편집도 직접 했습니다.",
    }
    const v2 = toExperienceV2(makeExperience({ type: "creative-work", content }))

    // 확정본 칸은 비어 있다 — 뭉갠 사본을 만들지 않는다.
    const moved = v2.extensionBlocks.find(b => b.key === "creative-info.역할")
    expect(moved && isBlockEmpty(moved)).toBe(true)
    // 원본은 개행까지 그대로 코어에 남는다.
    expect(v2.coreBlocks.find(b => b.key === "core.내 역할/기여도")?.value).toEqual(
      textarea("기획을 맡았습니다.\n\n촬영과 편집도 직접 했습니다."),
    )
  })

  /** 값만 새 키로 옮기고 숨김 상태를 두고 오면 사용자가 감춰 둔 칸이 혼자 다시 나타난다(FRT-210). */
  it("숨김 키도 개명을 따라간다", () => {
    const content = legacyCreativeContent()
    content.hidden = ["cw-info.사용 도구"]
    const v2 = toExperienceV2(makeExperience({ type: "creative-work", content }))

    expect(v2.hiddenKeys).toContain("creative-info.사용 툴 / 기술")
    expect(v2.hiddenKeys).not.toContain("cw-info.사용 도구")
  })

  describe("v1 레거시는 라벨로 매칭한다 (섹션 id 교체가 닿지 않는 경로)", () => {
    /**
     * v1 은 `fields` 맵이 없어 **라벨로** 매칭하므로 섹션 id 교체라는 방어선이 통째로 비껴간다.
     * 구 '제작 과정'(표)과 확정본 '제작 과정'(textarea)은 라벨이 같아 여기서 정면으로 만나고,
     * `isInjectableInto` 만이 값을 지킨다(FRT-210 Codex P1 과 같은 자리).
     */
    it("라벨이 같아도 타입이 다른 '제작 과정' 표는 '기타'로 보존된다", () => {
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [],
            extensionBlocks: [
              {
                id: "b1",
                type: "repeatable-cell",
                label: "제작 과정",
                value: {
                  type: "repeatable-cell",
                  columns: [{ key: "step", label: "단계명", blockType: "text" }],
                  rows: [{ id: "r1", cells: { step: "리서치" } }],
                },
              },
            ],
            customBlocks: [],
          },
        }),
      )

      const preserved = v1.customBlocks.find(b => b.label === "제작 과정")
      expect((preserved?.value as RepeatableCellBlockValue).rows).toHaveLength(1)
      // v1 은 저장된 블록만 싣는다 — 표가 새 키를 달고 확장 블록으로 넘어가지 않아야 한다.
      expect(v1.extensionBlocks.find(b => b.key === "creative-detail.제작 과정")).toBeUndefined()
    })

    /**
     * ⚠️ 도메인 교체(`SELECT_DOMAIN_MIGRATIONS`)의 v1 조회는 **목적지 라벨로만** 색인돼 있었다.
     * 선행 유형은 선택지만 갈리고 라벨은 그대로여서 목적지 라벨 == 저장 라벨이라 우연히 맞았는데,
     * 창작물은 '분야'→'유형 / 매체' 로 라벨까지 갈려 조회가 빗나갔다 — 값이 새 목록에 그대로
     * 있는데도 '기타'로 밀리고 required 칸은 빈 채 남는다(FRT-267 Codex P2). 키가 있든 없든 같다.
     */
    function loadV1Medium(saved: string, withKey: boolean) {
      return toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [],
            extensionBlocks: [
              {
                id: "b1",
                ...(withKey ? { key: "cw-info.분야" } : {}),
                type: "single-select",
                label: "분야",
                value: { type: "single-select", options: ["사진", "디자인", "기타"], selected: saved },
              },
            ],
            customBlocks: [],
          },
        }),
      )
    }

    /**
     * ⚠️ v2 는 코어를 현재 템플릿에서 다시 짜 `CORE_EXCLUDE` 가 저절로 적용되지만, v1 은 저장된
     * 코어 배열을 그대로 통과시켜 **확정본이 뺀 칸이 되살아난다.** 빈 코어 '증빙 자료' 하나가
     * dedup 없이 evidence 버킷으로 직행해 2카드 설계에 세 번째 카드를 만든다 — 채울 것도 없는
     * 카드라 진행도만 막힌다(FRT-267 Codex P2). 창작물만의 문제가 아니라 `CORE_EXCLUDE` 를 쓰는
     * 유형 전부가 같았고, 이 수정은 그 전부에 적용된다.
     */
    it("확정본이 뺀 빈 코어 칸은 v1 에서도 되살아나지 않는다 — 2카드가 유지된다", () => {
      const core = cloneBlocks(getTemplateForType("creative-work").commonCore.blocks)
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [
              ...core,
              { id: "ev", type: "file", label: "증빙 자료", value: { type: "file", fileName: "", description: "", evidenceType: "" } },
            ],
            extensionBlocks: [],
            customBlocks: [],
          },
        }),
      )

      expect(v1.coreBlocks.find(b => b.label === "증빙 자료")).toBeUndefined()

      const t = getTemplateForType("creative-work")
      const cards = computeFormCards(
        v1.coreBlocks,
        t.extensions.map(e => ({ id: e.id, category: e.category, blocks: cloneBlocks(e.blocks) })),
        SECTION_LABEL_OVERRIDES["creative-work"],
      )
      expect(cards.visibleCategories).toEqual(["basic", "detail"])
    })

    /** ⚠️ 빈 것만 버린다 — 값이 든 칸을 지우는 쪽이 카드 하나 더 뜨는 것보다 훨씬 나쁘다. */
    it("값이 든 코어 칸은 확정본이 뺐어도 v1 에서 그대로 남는다", () => {
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [
              {
                id: "ev",
                type: "file",
                label: "증빙 자료",
                value: { type: "file", fileName: "poster.pdf", description: "", evidenceType: "", fileId: "f1" },
              },
            ],
            extensionBlocks: [],
            customBlocks: [],
          },
        }),
      )

      expect(v1.coreBlocks.find(b => b.label === "증빙 자료")).toBeDefined()
    })

    /**
     * ⚠️ **"비었다"를 버림 판정에 그대로 쓰면 안 된다.** `isBlockEmpty` 는 파일 블록을 업로드
     * 신원(`fileName`/`fileId`/`url`)으로만 보는데, `FileBlock` 은 파일 없이도 설명·증빙 유형을
     * 먼저 칠 수 있고 파일을 지워도 그 둘을 **의도적으로 남긴다**(handleDelete). 그 블록을 빈 것으로
     * 보고 버리면 사용자가 입력한 메타데이터가 다음 저장에 영구 삭제된다(FRT-267 Codex P2).
     */
    it("파일 없이 설명·증빙 유형만 남은 코어 증빙은 v1 에서 버리지 않는다", () => {
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [
              {
                id: "ev",
                type: "file",
                label: "증빙 자료",
                value: { type: "file", fileName: "", description: "전시 도록 사진", evidenceType: "전시 도록" },
              },
            ],
            extensionBlocks: [],
            customBlocks: [],
          },
        }),
      )

      const kept = v1.coreBlocks.find(b => b.label === "증빙 자료")
      expect(kept?.value).toEqual({
        type: "file",
        fileName: "",
        description: "전시 도록 사진",
        evidenceType: "전시 도록",
      })
    })

    /** 같은 판정은 v2 orphan 안전망에도 걸려 있다 — 한쪽만 고치면 세대에 따라 결과가 갈린다. */
    it("파일 없이 설명만 남은 orphan 증빙은 v2 에서도 '기타'로 보존된다", () => {
      const content = legacyCreativeContent()
      ;(content.fields as Record<string, BlockValue>)["cw-old.옛 증빙"] = {
        type: "file",
        fileName: "",
        description: "도록 스캔본을 다시 올릴 것",
        evidenceType: "",
      }
      const v2 = toExperienceV2(makeExperience({ type: "creative-work", content }))

      expect(v2.customBlocks.find(b => b.key === "cw-old.옛 증빙")?.value).toEqual({
        type: "file",
        fileName: "",
        description: "도록 스캔본을 다시 올릴 것",
        evidenceType: "",
      })
    })

    /**
     * ⚠️ v2 는 코어 잔재를 확정본 칸으로 옮겨 권위 있는 칸을 하나로 만드는데, v1 은 그 이관이
     * 통째로 빠져 있었다. "값 유실은 없다"는 것이 미룬 근거였지만 — 남는 두 칸이 바로 무음
     * 오염이다. `pickValue` 가 정확 라벨인 코어를 먼저 골라, 사용자가 새 '역할'에 고쳐 써도
     * 포트폴리오는 옛 코어 값을 계속 발행한다(FRT-267 Codex P2).
     */
    it("v1 코어 '내 역할/기여도'도 확정본 '역할'로 옮겨 칸을 하나로 만든다", () => {
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [
              { id: "role", type: "textarea", label: "내 역할/기여도", value: textarea("기획·촬영·편집을 모두 맡았습니다.") },
            ],
            extensionBlocks: [],
            customBlocks: [],
          },
        }),
      )

      // 값은 확정본 칸으로 옮겨진다.
      expect(v1.extensionBlocks.find(b => b.key === "creative-info.역할")?.value).toEqual(
        text("기획·촬영·편집을 모두 맡았습니다."),
      )
      // 코어에는 값이 남지 않는다 — 남으면 발행이 옛 값으로 굳는다.
      const coreRole = v1.coreBlocks.find(b => b.label === "내 역할/기여도")
      expect(coreRole === undefined || isBlockEmpty(coreRole)).toBe(true)
      // 옮긴 것이지 버린 것이 아니다.
      expect(v1.customBlocks.find(b => b.label === "내 역할/기여도")).toBeUndefined()
    })

    /**
     * ⚠️ 이관은 **목적지가 비었을 때만** 한다 — v2 `applyScopedMigrations` 와 같은 우선순위다
     * (유형 섹션 쪽 값이 먼저 목적지를 차지하고, 코어 잔재는 빈자리에만 들어간다). 이 순서가
     * 없으면 사용자가 확정본 칸에 새로 적은 답을 구 코어 값이 조용히 덮는다.
     */
    it("확정본 '역할'이 이미 차 있으면 코어 잔재가 그 값을 덮지 않는다", () => {
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [
              { id: "role", type: "textarea", label: "내 역할/기여도", value: textarea("옛 코어 값") },
            ],
            extensionBlocks: [
              { id: "newrole", key: "creative-info.역할", type: "text", label: "역할", value: text("팀 리더") },
            ],
            customBlocks: [],
          },
        }),
      )

      expect(v1.extensionBlocks.find(b => b.key === "creative-info.역할")?.value).toEqual(text("팀 리더"))
      // 옮기지 못한 코어 값은 버리지 않는다 — 화면에 남겨 사용자가 판단하게 한다.
      expect(v1.coreBlocks.find(b => b.label === "내 역할/기여도")?.value).toEqual(textarea("옛 코어 값"))
    })

    /** 이관 경계는 v1 에서도 같다 — 여러 줄 값은 한 줄 칸으로 옮기지 않고 원본을 남긴다. */
    it("v1 여러 줄 역할 값은 옮기지 않고 코어에 그대로 남긴다", () => {
      const v1 = toExperienceV2(
        makeExperience({
          type: "creative-work",
          content: {
            title: "골목 기록 프로젝트",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: [
              {
                id: "role",
                type: "textarea",
                label: "내 역할/기여도",
                value: textarea("기획을 맡았습니다.\n\n촬영과 편집도 직접 했습니다."),
              },
            ],
            extensionBlocks: [],
            customBlocks: [],
          },
        }),
      )

      const moved = v1.extensionBlocks.find(b => b.key === "creative-info.역할")
      expect(moved === undefined || isBlockEmpty(moved)).toBe(true)
      expect(v1.coreBlocks.find(b => b.label === "내 역할/기여도")?.value).toEqual(
        textarea("기획을 맡았습니다.\n\n촬영과 편집도 직접 했습니다."),
      )
    })

    for (const withKey of [false, true]) {
      const how = withKey ? "키가 있는" : "키가 없는"

      it(`${how} v1 '분야'의 답이 새 목록에 그대로 있으면 '유형 / 매체'로 옮는다`, () => {
        const v1 = loadV1Medium("사진", withKey)

        const moved = v1.extensionBlocks.find(b => b.key === "creative-info.유형 / 매체")
        expect((moved?.value as SingleSelectBlockValue).selected).toBe("사진")
        // 선택지는 템플릿 것으로 정규화된다 — 옛 목록이 따라오면 확정본 13종을 영영 못 받는다.
        expect((moved?.value as SingleSelectBlockValue).options).toContain("웹/앱 UI")
        expect(v1.customBlocks.find(b => b.label === "분야")).toBeUndefined()
      })

      it(`${how} v1 '분야'의 답이 새 목록에 없으면 '기타'로 보존한다 — 시스템이 대신 고르지 않는다`, () => {
        const v1 = loadV1Medium("디자인", withKey)

        expect(v1.extensionBlocks.find(b => b.key === "creative-info.유형 / 매체")).toBeUndefined()
        const preserved = v1.customBlocks.find(b => b.label === "분야")
        expect((preserved?.value as SingleSelectBlockValue).selected).toBe("디자인")
      })
    }
  })
})

describe("확정본 전면 교체 값 보존 (FRT-269 연구논문)", () => {
  /**
   * ⚠️ 레거시 픽스처는 "그럴듯한 값"이 아니라 **그 시점의 렌더 경로가 실제로 만들어낼 수 있는 값**
   * 이어야 한다(FRT-249 Codex P1 을 놓친 이유). 코어 4칸이 서로 다른 이유로 갈린다:
   *  · `core.기간` — 구 `research-info` 에 '기간'(동명) 앵커가 있어 dedup 이 빈 코어를 화면에서
   *    지웠다 → 채울 방법이 없었으므로 **항상 비어 있다.**
   *  · `core.내 역할/기여도` — 구 '역할'·'내가 맡은 파트' 둘 다 SEMANTIC_GROUPS.role 등재라 같은 이유.
   *  · `core.핵심 성과` — 구 '성과'(tags)가 achievement 등재라 같은 이유.
   *  · `core.증빙 자료` — `isEvidenceBlock` 이라 dedup 자체를 타지 않고 '활동 증빙' 카드에 **항상**
   *    보였다 → 값이 있을 수 있다. 확정본 ④ 가 곧 이 카드이므로 창작물과 달리 **빼지 않는다.**
   */
  function legacyResearchContent(): Record<string, unknown> {
    return {
      schema_version: 2,
      template_version: TEMPLATE_VERSION,
      title: "SNS 사용과 학업 몰입도 연구",
      summary: "대학생 300명 설문 기반 실증 연구",
      status: "complete",
      tags: [],
      fields: {
        "core.기간": { type: "period", start: "", end: "", isCurrent: false },
        "core.핵심 성과": textarea(""),
        "core.내 역할/기여도": textarea(""),
        "core.증빙 자료": {
          type: "file",
          fileName: "연구참여확인서.pdf",
          description: "학과 발급 확인서",
          evidenceType: "연구 참여 확인서",
        },
        // 질문도 타입도 같아 새 키로 이관되는 것들.
        "research-info.연구 주제/논문 제목": text("대학생의 SNS 사용 패턴이 학업 몰입도에 미치는 영향"),
        "research-info.소속/기관/랩": text("OO대학교 경영학과 소비자행동연구실"),
        "research-info.기간": { type: "period", start: "2024-03", end: "2024-08", isCurrent: false },
        // 선택지 도메인이 달라 **값 조건부**인 것 — '주저자'는 새 5종에 그대로 없다.
        "research-info.역할": {
          type: "single-select",
          selected: "주저자",
          options: ["주저자", "공저", "연구원", "RA", "기타"],
        },
        // 묻는 것이 달라 옮기지 않는 것들.
        "research-info.연구 질문/가설": textarea("SNS 사용량이 학업 몰입도를 낮추는가?"),
        "research-info.결과 요약": textarea("3시간 이상 사용 시 몰입도가 유의하게 감소했다."),
        // 타입이 달라 옮길 수 없는 것들.
        "research-info.방법/설계": textarea("설문 300부 + 심층 인터뷰 8명"),
        "research-info.성과": { type: "tags", tags: ["학회 발표"] },
        "research-info.재현/공유 자료": { type: "link", url: "https://osf.io/abcde" },
        "research-info.산출물": {
          type: "file",
          fileName: "논문초고.pdf",
          description: "",
          evidenceType: "",
        },
        // 확정본에 대응 칸이 없는 것들.
        "research-info.데이터/자료 출처": text("한국복지패널 2023"),
        "research-info.참고문헌/관련 읽을거리": textarea("Kim(2022), Lee(2021)"),
        "research-info.내가 맡은 파트": textarea("설문 설계와 회귀 분석을 맡았습니다."),
      },
      custom: [],
    }
  }

  const loadLegacy = () =>
    toExperienceV2(makeExperience({ type: "research", content: legacyResearchContent() }))

  /** 확정본 '역할 / 기여도' 5종을 템플릿에서 읽는다 — 목록을 테스트에 복제하지 않는다. */
  const roleOptions = (): string[] =>
    getTemplateForType("research")
      .extensions.flatMap(s => s.blocks)
      .find(b => b.key === "research-paper.역할 / 기여도")?.options ?? []

  it("질문도 타입도 같은 필드는 확정본 자리로 이관된다", () => {
    const v2 = loadLegacy()
    const byKey = (k: string) => v2.extensionBlocks.find(b => b.key === k)

    expect(byKey("research-paper.연구 / 논문 제목")?.value).toEqual(
      text("대학생의 SNS 사용 패턴이 학업 몰입도에 미치는 영향"),
    )
    expect(byKey("research-paper.소속 기관 / 연구실")?.value).toEqual(
      text("OO대학교 경영학과 소비자행동연구실"),
    )
    expect(byKey("research-paper.연구 기간")?.value).toMatchObject({
      start: "2024-03",
      end: "2024-08",
    })

    // 옮긴 구 키는 '기타' 에 중복으로 되살아나지 않는다.
    for (const oldKey of [
      "research-info.연구 주제/논문 제목",
      "research-info.소속/기관/랩",
      "research-info.기간",
    ]) {
      expect(v2.customBlocks.find(b => b.key === oldKey), oldKey).toBeUndefined()
    }
  })

  /**
   * 구 '역할'(주저자/공저/연구원/RA/기타)과 확정본 '역할 / 기여도'(5종)는 **같은 질문**(이 연구에서
   * 내가 무엇이었나)이지만 선택지가 통째로 다시 짜였다. '주저자'→'제 1저자(주저자)' 는 이름이
   * 바뀌었고 '연구원'·'RA' 는 확정본이 역할의 성격을 묻는 쪽으로 갈아 1:1이 아니다 — 어느 쪽으로든
   * 좁히면 **답이 둔갑한다**(FRT-249 ⑨ 의 값 조건부 이관, 판정 단위는 필드가 아니라 **값**).
   */
  it("새 목록에 없는 '역할' 값은 이관하지 않고 '기타' 카드로 보존한다", () => {
    const v2 = loadLegacy()

    expect(v2.customBlocks.find(b => b.key === "research-info.역할")?.value).toMatchObject({
      selected: "주저자",
    })
    expect(
      v2.extensionBlocks.find(b => b.key === "research-paper.역할 / 기여도")?.value,
    ).toMatchObject({ selected: "" })
  })

  /**
   * 답이 새 목록에 그대로 남아 있으면 옮긴다. 옮길 때 선택지는 템플릿 것으로 정규화한다 —
   * 저장값이 들고 온 옛 5종이 그대로 실리면 `SingleSelectBlock` 이 그쪽을 우선해(`val.options`)
   * 확정본이 새로 준 선택지를 영영 못 받고, 다음 저장에 그 상태가 굳는다.
   */
  it("확정본 목록에 그대로 남은 답('기타')은 옮기고 선택지도 확정본 것으로 바꾼다", () => {
    const content = legacyResearchContent()
    const fields = content.fields as Record<string, BlockValue>
    fields["research-info.역할"] = {
      type: "single-select",
      selected: "기타",
      options: ["주저자", "공저", "연구원", "RA", "기타"],
    }
    const v2 = toExperienceV2(makeExperience({ type: "research", content }))

    const moved = v2.extensionBlocks.find(b => b.key === "research-paper.역할 / 기여도")
    expect(moved?.value).toMatchObject({ selected: "기타" })
    expect((moved?.value as SingleSelectBlockValue).options).toEqual(roleOptions())
    expect(v2.customBlocks.find(b => b.key === "research-info.역할")).toBeUndefined()
  })

  /**
   * 질문이 다르거나 타입이 다른 구 필드는 시스템이 대신 판단하지 않는다 — 원본 그대로 '기타'에
   * 남겨 사용자가 직접 옮기게 둔다. 특히 '결과 요약'→'초록 / 핵심 요약' 은 타입이 같아 **옮기려면
   * 옮길 수 있는데도** 옮기지 않는다: 확정본 초록은 목적·방법·결과 전체의 요약이라, 결과만 적힌
   * 옛 답을 실으면 초록 칸이 채워진 것처럼 보인다(FRT-211 의 '개명 vs 대체').
   */
  it("질문·타입이 달라진 구 필드는 확정본 자리에 실리지 않고 '기타' 카드로 보존한다", () => {
    const v2 = loadLegacy()
    const custom = (k: string) => v2.customBlocks.find(b => b.key === k)

    expect(custom("research-info.결과 요약")?.value).toEqual(
      textarea("3시간 이상 사용 시 몰입도가 유의하게 감소했다."),
    )
    expect(
      v2.extensionBlocks.find(b => b.key === "research-content.초록 / 핵심 요약")?.value,
    ).toEqual(textarea(""))

    expect(custom("research-info.연구 질문/가설")?.value).toEqual(
      textarea("SNS 사용량이 학업 몰입도를 낮추는가?"),
    )
    expect(custom("research-info.방법/설계")?.value).toEqual(textarea("설문 300부 + 심층 인터뷰 8명"))
    expect(custom("research-info.내가 맡은 파트")?.value).toEqual(
      textarea("설문 설계와 회귀 분석을 맡았습니다."),
    )
    expect(custom("research-info.성과")?.value).toMatchObject({ tags: ["학회 발표"] })
    expect(custom("research-info.재현/공유 자료")?.value).toMatchObject({
      url: "https://osf.io/abcde",
    })
    expect(custom("research-info.산출물")?.value).toMatchObject({ fileName: "논문초고.pdf" })
    expect(custom("research-info.데이터/자료 출처")?.value).toEqual(text("한국복지패널 2023"))
    expect(custom("research-info.참고문헌/관련 읽을거리")?.value).toEqual(
      textarea("Kim(2022), Lee(2021)"),
    )
  })

  /**
   * ⚠️ 선행 5종과 **반대 결론**이다. 봉사·어학·해외는 유형 섹션이 자기 증빙 칸을 따로 가져
   * core '증빙 자료'를 뺐지만, 연구논문 확정본 ④ '연구 증빙'은 **코어 증빙 카드 그 자체**다.
   * 빼면 첨부 수단이 통째로 사라지고 확정본 4섹션이 3카드로 줄어든다.
   */
  it("코어 증빙은 코어에 그대로 남고, 확정본 4섹션이 화면에서도 4카드다", () => {
    const v2 = loadLegacy()

    expect(v2.coreBlocks.find(b => b.key === "core.증빙 자료")?.value).toMatchObject({
      fileName: "연구참여확인서.pdf",
      evidenceType: "연구 참여 확인서",
    })
    // 확정본이 뺀 코어 셋은 되살아나지 않는다.
    for (const gone of ["core.기간", "core.내 역할/기여도", "core.핵심 성과"]) {
      expect(v2.coreBlocks.find(b => b.key === gone), gone).toBeUndefined()
    }

    const t = getTemplateForType("research")
    const cards = computeFormCards(
      v2.coreBlocks,
      t.extensions.map(e => ({ id: e.id, category: e.category, blocks: cloneBlocks(e.blocks) })),
      SECTION_LABEL_OVERRIDES["research"],
    )
    expect(cards.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])
    expect(cards.cards.map(c => c.label)).toEqual([
      "기본 정보",
      "연구 내용",
      "게재 / 발표 이력",
      "연구 증빙",
    ])
  })

  describe("v1 레거시(라벨 매칭)", () => {
    function loadV1(blocks: { coreBlocks?: Block[]; extensionBlocks?: Block[] }): ExperienceV2 {
      return toExperienceV2(
        makeExperience({
          type: "research",
          content: {
            title: "SNS 사용과 학업 몰입도 연구",
            summary: "",
            status: "complete",
            tags: [],
            coreBlocks: blocks.coreBlocks ?? [],
            extensionBlocks: blocks.extensionBlocks ?? [],
            customBlocks: [],
          },
        }),
      )
    }

    /**
     * ⚠️ v2 는 코어를 현재 템플릿에서 다시 짜 `CORE_EXCLUDE` 가 저절로 적용되지만, v1 은 저장된
     * 코어 배열을 그대로 통과시킨다 — 확정본이 뺀 빈 칸이 되살아나면 채울 것도 없는 칸이 카드에
     * 낀다(FRT-267 Codex P2). 반대로 **'증빙 자료'는 남아야 한다** — 확정본 ④ 가 그 칸이라
     * 버리면 v1 레코드만 증빙 카드를 잃는다. 한 판정이 두 방향으로 갈리는 자리다.
     */
    it("확정본이 뺀 빈 코어만 사라지고 '증빙 자료'는 v1 에서도 남는다 — 4카드가 유지된다", () => {
      const v1 = loadV1({
        coreBlocks: [
          {
            id: "p",
            type: "period",
            label: "기간",
            value: { type: "period", start: "", end: "", isCurrent: false },
          },
          { id: "r", type: "textarea", label: "내 역할/기여도", value: textarea("") },
          { id: "a", type: "textarea", label: "핵심 성과", value: textarea("") },
          {
            id: "ev",
            type: "file",
            label: "증빙 자료",
            value: { type: "file", fileName: "", description: "", evidenceType: "" },
          },
        ],
      })

      for (const gone of ["기간", "내 역할/기여도", "핵심 성과"]) {
        expect(v1.coreBlocks.find(b => b.label === gone), gone).toBeUndefined()
      }
      expect(v1.coreBlocks.find(b => b.label === "증빙 자료")).toBeDefined()

      const t = getTemplateForType("research")
      const cards = computeFormCards(
        v1.coreBlocks,
        t.extensions.map(e => ({ id: e.id, category: e.category, blocks: cloneBlocks(e.blocks) })),
        SECTION_LABEL_OVERRIDES["research"],
      )
      expect(cards.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])
    })

    /** ⚠️ 빈 것만 버린다 — 값이 든 칸을 지우는 쪽이 칸 하나 더 뜨는 것보다 훨씬 나쁘다. */
    it("값이 든 코어 칸은 확정본이 뺐어도 v1 에서 그대로 남는다", () => {
      const v1 = loadV1({
        coreBlocks: [
          {
            id: "r",
            type: "textarea",
            label: "내 역할/기여도",
            value: textarea("회귀 분석을 맡았습니다."),
          },
        ],
      })

      expect(v1.coreBlocks.find(b => b.label === "내 역할/기여도")?.value).toEqual(
        textarea("회귀 분석을 맡았습니다."),
      )
    })

    /** 값 조건부 이관은 v1·v2 양쪽에 같게 적용한다 — 사용자에게 스키마 버전이 보이면 안 된다. */
    for (const withKey of [false, true]) {
      const how = withKey ? "키가 있는" : "키가 없는"
      const loadV1Role = (saved: string) =>
        loadV1({
          extensionBlocks: [
            {
              id: "b1",
              ...(withKey ? { key: "research-info.역할" } : {}),
              type: "single-select",
              label: "역할",
              value: { type: "single-select", options: ["주저자", "공저", "기타"], selected: saved },
            },
          ],
        })

      it(`${how} v1 '역할'의 답이 새 목록에 그대로 있으면 '역할 / 기여도'로 옮는다`, () => {
        const v1 = loadV1Role("기타")

        const moved = v1.extensionBlocks.find(b => b.key === "research-paper.역할 / 기여도")
        expect((moved?.value as SingleSelectBlockValue).selected).toBe("기타")
        // 선택지는 템플릿 것으로 정규화된다 — 옛 목록이 따라오면 확정본 5종을 영영 못 받는다.
        expect((moved?.value as SingleSelectBlockValue).options).toEqual(roleOptions())
        expect(v1.customBlocks.find(b => b.label === "역할")).toBeUndefined()
      })

      it(`${how} v1 '역할'의 답이 새 목록에 없으면 '기타'로 보존한다 — 시스템이 대신 고르지 않는다`, () => {
        const v1 = loadV1Role("주저자")

        const moved = v1.extensionBlocks.find(b => b.key === "research-paper.역할 / 기여도")
        expect(moved === undefined || isBlockEmpty(moved)).toBe(true)
        const preserved = v1.customBlocks.find(b => b.label === "역할")
        expect((preserved?.value as SingleSelectBlockValue).selected).toBe("주저자")
      })
    }

    /**
     * 확정본 ④ 가 정한 증빙 유형 4종(CORE_EVIDENCE_OPTIONS.research)은 **화면 메타데이터**라
     * 저장값에 없다. v2 는 코어를 템플릿에서 다시 짜 저절로 받지만 v1 은 저장 배열을 그대로
     * 통과시켜, 안 실어 주면 같은 유형인데 세대에 따라 드롭다운과 자유 입력으로 갈린다
     * (FRT-269 Codex P2). 목록은 템플릿에서 뽑아 대조한다 — 테스트에 복제하지 않는다.
     */
    it("v1 코어 '증빙 자료'도 확정본 증빙 유형 선택지를 받는다", () => {
      const v1 = loadV1({
        coreBlocks: [
          {
            id: "ev",
            type: "file",
            label: "증빙 자료",
            value: {
              type: "file",
              fileName: "연구참여확인서.pdf",
              description: "",
              evidenceType: "",
            },
          },
        ],
      })

      const expected = getTemplateForType("research").commonCore.blocks.find(
        b => b.label === "증빙 자료",
      )?.options
      expect(expected?.length).toBeGreaterThan(0)
      expect(v1.coreBlocks.find(b => b.label === "증빙 자료")?.options).toEqual(expected)
    })
  })

  /**
   * 숨김 상태도 값과 함께 새 자리로 따라가야 한다 — 값만 옮기고 두고 오면 사용자가 치워 둔 칸이
   * 개편 후 혼자 다시 나타나고, `normalizeHiddenKeys` 는 모르는 키를 버리지 않아 옛 키가 저장분에
   * 영원히 남는다(FRT-210 Codex P2 가 순수 개명에서 세운 규칙). 확정본이 라벨과 선택지를 갈아
   * `SELECT_DOMAIN_MIGRATIONS` 로 옮기는 '역할'도 **묻는 질문은 그대로**라 같은 규칙을 받는다
   * (FRT-269 Codex P2).
   */
  it("숨겨 둔 구 '역할'의 숨김 상태가 확정본 '역할 / 기여도'로 따라간다", () => {
    const v2 = toExperienceV2(
      makeExperience({
        type: "research",
        content: {
          ...legacyResearchContent(),
          hidden: ["research-info.역할"],
        },
      }),
    )

    expect(v2.hiddenKeys).toContain("research-paper.역할 / 기여도")
    expect(v2.hiddenKeys).not.toContain("research-info.역할")
  })
})

// ─── FRT-200: 저장된 값이 타입이 약속한 모양대로 오지 않을 때 ──────────
//
// `content` 는 서버 JSONB 라 `Block.value` 가 non-nullable 로 선언돼 있어도 런타임엔 null·결측
// 필드가 도착한다. 그 값이 매퍼를 그대로 통과해 판정·렌더에서 화면을 통째로 죽였다.
//
// ⚠️ 픽스처는 `as unknown as` 로 타입 안전망을 우회한다 — 타입이 허용하는 리터럴로만 쓰면
// 컴파일러가 그 입력을 막아 결함을 재현하지 못하고, 통과하는 테스트가 그물이 아니게 된다.
// ⚠️ 키는 하드코딩하지 않고 템플릿에서 읽는다 — 라벨이 바뀌면 테스트가 조용히 무의미해진다.

/**
 * 헤더 코어는 `fields` 가 아니라 `content.title`/`summary` 로 저장되므로 아래 헬퍼에서 제외한다
 * — 이걸 고르면 왕복 검사가 `fields[key]` 에서 영원히 undefined 를 본다.
 */
const HEADER_KEYS = ["core.경험명", "core.한 줄 요약"]

/** career 템플릿에서 그 타입의 첫 블록 키. 없으면 실패시킨다(빈 컬렉션 위양성 차단). */
function firstKeyOfType(type: Block["type"]): string {
  const tmpl = getTemplateForType("career")
  const all = [...tmpl.commonCore.blocks, ...tmpl.extensions.flatMap(s => s.blocks)]
  // 제외 목록이 실제 템플릿과 어긋나면(라벨 개명 등) 조용히 헤더를 고르게 되므로 함께 잠근다.
  for (const headerKey of HEADER_KEYS) {
    if (!all.some(b => b.key === headerKey)) {
      throw new Error(`career 템플릿에 헤더 키 ${headerKey} 가 없다 — 테스트 전제가 깨졌다`)
    }
  }
  const found = all.find(b => b.type === type && b.key && !HEADER_KEYS.includes(b.key))?.key
  if (!found) throw new Error(`career 템플릿에 ${type} 블록이 없다 — 테스트 전제가 깨졌다`)
  return found
}

/** v2 저장 레코드. `fields`/`custom` 에 타입이 허용하지 않는 손상 값을 실을 수 있다. */
function makeV2Content(fields: unknown, custom: unknown = []): Experience["content"] {
  return {
    schema_version: 2,
    template_version: TEMPLATE_VERSION,
    title: "회사",
    summary: "요약",
    status: "draft",
    tags: [],
    fields,
    custom,
  } as unknown as Experience["content"]
}

describe("toExperienceV2 — 손상된 저장 값 (FRT-200)", () => {
  it("템플릿 필드 값이 통째로 null 이어도 경험을 연다", () => {
    const periodKey = firstKeyOfType("period")
    const exp = makeExperience({ content: makeV2Content({ [periodKey]: null }) })

    expect(() => toExperienceV2(exp)).not.toThrow()
    const v2 = toExperienceV2(exp)
    // 값이 없으면 템플릿이 준 빈 값 그대로여야 한다 — 블록이 사라지면 안 된다.
    const block = v2.coreBlocks.find(b => b.key === periodKey)
    expect(block).toBeDefined()
    expect(isBlockEmpty(block!)).toBe(true)
  })

  /**
   * 핵심 단언. "죽지 않는다"만 물으면 **손상 값을 통째로 비우는 오구현도 통과한다** —
   * 그 구현은 살아 있는 `start` 를 지운다. 살아남은 값을 함께 물어야 그물이 된다.
   */
  it("한쪽 필드만 깨진 템플릿 값은 살아 있는 쪽을 보존한다", () => {
    const periodKey = firstKeyOfType("period")
    const exp = makeExperience({
      content: makeV2Content({ [periodKey]: { type: "period", start: "2023.01", end: null } }),
    })

    const v2 = toExperienceV2(exp)
    const block = v2.coreBlocks.find(b => b.key === periodKey)
    expect(block?.value).toMatchObject({ type: "period", start: "2023.01", end: "" })
    expect(isBlockEmpty(block!)).toBe(false)
  })

  /**
   * custom 은 **사용자가 만든 칸 자체가 정보**다. 형제 `orphanFieldsToBlocks` 처럼 버리면
   * 값이 없다는 이유로 사용자가 만든 필드가 화면에서 사라진다. 존재·개수를 함께 단언하지
   * 않으면 그 오구현이 통과한다.
   */
  it("커스텀 필드 값이 null 이어도 그 필드는 사라지지 않고 빈 값으로 복구된다", () => {
    const exp = makeExperience({
      content: makeV2Content({}, [
        { key: "c1", entryType: "field", type: "date", label: "직접 만든 날짜", value: null },
      ]),
    })

    expect(() => toExperienceV2(exp)).not.toThrow()
    const v2 = toExperienceV2(exp)
    expect(v2.customBlocks).toHaveLength(1)
    expect(v2.customBlocks[0].label).toBe("직접 만든 날짜")
    expect(v2.customBlocks[0].value).toEqual({ type: "date", date: "" })
  })

  /**
   * 경계 고정. orphan 은 `value.type` 이 유일한 타입 신호라 그것이 없으면 복구할 근거가 없다 —
   * custom 을 고쳤다고 orphan 까지 되살리면 안 된다(현행 드롭 유지).
   */
  it("템플릿이 안 쓰는 잔재 키의 값이 null 이면 지금처럼 버린다", () => {
    const exp = makeExperience({ content: makeV2Content({ "구템플릿.사라진필드": null }) })

    const v2 = toExperienceV2(exp)
    expect(v2.customBlocks.find(b => b.key === "구템플릿.사라진필드")).toBeUndefined()
  })

  it("v1 레거시 저장 블록이 손상돼 있어도 경험을 열고 살아 있는 값을 지킨다", () => {
    const exp = makeExperience({
      content: {
        coreBlocks: [
          {
            id: "b1",
            key: "core.기간",
            type: "period",
            label: "기간",
            value: { type: "period", start: "2022.03", end: null },
          },
          { id: "b2", type: "date", label: "깨진 날짜", value: null },
        ],
        extensionBlocks: [],
        customBlocks: [],
      } as unknown as Experience["content"],
    })

    expect(() => toExperienceV2(exp)).not.toThrow()
    const v2 = toExperienceV2(exp)
    const all = [...v2.coreBlocks, ...v2.extensionBlocks, ...v2.customBlocks]
    const period = all.find(b => b.label === "기간")
    expect(period?.value).toMatchObject({ type: "period", start: "2022.03", end: "" })
  })
})

describe("저장 왕복 — 손상된 값 정규화 (FRT-200)", () => {
  it("손상된 값은 빈 값으로 정규화돼 저장되고, 멀쩡한 값은 그대로 간다", () => {
    const periodKey = firstKeyOfType("period")
    const textKey = firstKeyOfType("text")
    const exp = makeExperience({
      content: makeV2Content(
        {
          [periodKey]: { type: "period", start: "2023.01", end: null },
          [textKey]: { type: "text", text: "멀쩡한 값" },
        },
        [{ key: "c1", entryType: "field", type: "date", label: "직접 만든 날짜", value: null }],
      ),
    })

    const payload = toSavePayload(toExperienceV2(exp))
    const content = payload.content as {
      fields: Record<string, unknown>
      custom: Array<{ key: string; value: unknown }>
    }
    expect(content.fields[periodKey]).toMatchObject({
      type: "period",
      start: "2023.01",
      end: "",
    })
    expect(content.fields[textKey]).toMatchObject({ type: "text", text: "멀쩡한 값" })
    const custom = content.custom.find(c => c.key === "c1")
    expect(custom).toBeDefined()
    expect(custom).toMatchObject({ entryType: "field", value: { type: "date", date: "" } })
  })

  /**
   * `type` 만 빠진 값은 **버릴 값이 아니다.** 블록이 선언한 타입이 복구 근거가 되는데,
   * 빈 값으로 갈아치우면 열었다 저장하는 것만으로 살아 있던 입력이 영구히 사라진다.
   */
  it("type 만 빠진 템플릿 값도 알맹이가 살아남아 그대로 재저장된다", () => {
    const periodKey = firstKeyOfType("period")
    const exp = makeExperience({
      content: makeV2Content({ [periodKey]: { start: "2023.01", end: "2023.12" } }),
    })

    const v2 = toExperienceV2(exp)
    const block = v2.coreBlocks.find(b => b.key === periodKey)
    expect(block?.value).toMatchObject({ type: "period", start: "2023.01", end: "2023.12" })

    const content = toSavePayload(v2).content as { fields: Record<string, unknown> }
    expect(content.fields[periodKey]).toMatchObject({ start: "2023.01", end: "2023.12" })
  })

  /**
   * 열 정의(`columns`)도 선택지(`options`)와 같다 — 사용자가 친 값이 아니라 템플릿이 주는
   * 정의다. 결측이라고 `[]` 로 두면 표에 그릴 칸이 하나도 없어 입력한 행을 볼 수도 고칠 수도 없다.
   */
  it("표 값이 열 정의를 잃어도 템플릿 열로 되살리고 행은 지킨다", () => {
    const cellKey = firstKeyOfType("repeatable-cell")
    const exp = makeExperience({
      content: makeV2Content({
        [cellKey]: {
          type: "repeatable-cell",
          columns: null,
          rows: [{ id: "r1", cells: {} }],
        } as unknown as BlockValue,
      }),
    })

    const v2 = toExperienceV2(exp)
    const block = [...v2.coreBlocks, ...v2.extensionBlocks]
      .flatMap(b => [b, ...(b.children ?? [])])
      .find(b => b.key === cellKey)
    expect(block).toBeDefined()
    const value = block!.value as unknown as { type: string; columns: unknown[]; rows: unknown[] }
    expect(value.type).toBe("repeatable-cell")
    expect(value.columns.length).toBeGreaterThan(0)
    expect(value.rows).toHaveLength(1)
  })

  it("커스텀 필드도 type 만 빠지면 entry 의 타입으로 되살려 알맹이를 지킨다", () => {
    const exp = makeExperience({
      content: makeV2Content({}, [
        {
          key: "c1",
          entryType: "field",
          type: "period",
          label: "직접 만든 기간",
          value: { start: "2022.03", end: "" } as unknown as BlockValue,
        },
      ]),
    })

    const v2 = toExperienceV2(exp)
    const block = v2.customBlocks.find(b => b.key === "c1")
    expect(block?.value).toMatchObject({ type: "period", start: "2022.03" })
  })
})

/**
 * 새 스키마가 쓴 값을 **구 프론트가 지우면 안 된다.** orphan 안전망은 모르는 키를 보존하는데,
 * 모르는 *타입*을 "비어 있음"으로 보고 버리면 그 안전망이 무력해진다 (FRT-200 리뷰).
 */
describe("toExperienceV2 — 이 코드가 모르는 타입 (FRT-200)", () => {
  it("모르는 type 의 orphan 값을 버리지 않고 왕복에서 지킨다", () => {
    const exp = makeExperience({
      content: makeV2Content({
        "future.신규칸": {
          type: "brand-new-in-v3",
          payload: "미래 스키마가 쓴 값",
        } as unknown as BlockValue,
      }),
    })

    const v2 = toExperienceV2(exp)
    const block = [...v2.customBlocks, ...v2.extensionBlocks].find(b => b.key === "future.신규칸")
    expect(block).toBeDefined()

    const payload = toSavePayload(v2)
    const content = payload.content as {
      fields: Record<string, unknown>
      custom: Array<{ key: string; value: unknown }>
    }
    const survived =
      content.fields["future.신규칸"] ?? content.custom.find(c => c.key === "future.신규칸")?.value
    expect(survived).toMatchObject({ type: "brand-new-in-v3", payload: "미래 스키마가 쓴 값" })
  })
})
