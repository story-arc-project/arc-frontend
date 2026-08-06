import { describe, expect, it } from "vitest"
import type {
  Block,
  BlockValue,
  CustomEntry,
  ExperienceV2,
  RepeatableCellBlockValue,
} from "@/types/archive"
import type { Experience } from "@/types/experience"
import { getTemplateForType, TEMPLATE_VERSION } from "@/lib/constants/templates-v2"
import {
  toExperienceV2,
  toSavePayload,
} from "@/lib/utils/experience-mapper"
import { createGroupBlock, createTextField } from "@/lib/utils/block-utils"

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
    "award-info.주최/기관",
    "award-info.대회/프로그램명",
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
})
