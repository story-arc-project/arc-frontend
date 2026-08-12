import { describe, it, expect } from "vitest"
import {
  computeFormCards,
  isCardComplete,
  computeFormProgress,
  equivalentLabels,
} from "@/lib/utils/form-cards"
import { partitionByCondition } from "@/lib/utils/conditional-fields"
import { getTemplateForType } from "@/lib/constants/templates-v2"
import { cloneBlocks } from "@/lib/utils/block-utils"
import type { FormCardSection, FormCardModel } from "@/lib/utils/form-cards"
import type { Block } from "@/types/archive"
import { SECTION_LABEL_OVERRIDES } from "@/types/archive"

function sectionsFor(typeId: Parameters<typeof getTemplateForType>[0]): { core: ReturnType<typeof cloneBlocks>; sections: FormCardSection[] } {
  const t = getTemplateForType(typeId)
  return {
    core: cloneBlocks(t.commonCore.blocks),
    sections: t.extensions.map(e => ({ id: e.id, category: e.category, blocks: cloneBlocks(e.blocks) })),
  }
}

describe("동의어 등록 — 코어를 뺀 자리를 이어받은 라벨 (FRT-291)", () => {
  /**
   * `CORE_EXCLUDE` 로 코어를 빼는 것과 그 자리를 이어받은 라벨을 `SEMANTIC_GROUPS` 에 넣는 것은
   * **한 쌍**이다(FRT-269 리뷰). 앞만 하면 폴백이던 코어까지 함께 사라져 발행 경로가 값을 못 찾는다.
   *
   * ⚠️ 이 테스트는 표를 직접 본다 — **동작 테스트로는 잡히지 않기 때문**이다. 프로젝트의 발행
   * 기간은 `TYPE_PERIOD_KEY` 가 안정키로 먼저 집으므로, 이 등록을 지워도 지금은 아무 발행물이
   * 바뀌지 않는다(회귀 주입에서 유일하게 GREEN 이었던 자리). 그래서 지금은 **방어선이자 의도
   * 표기**다 — 훗날 우선 조회 키가 빠지거나 라벨이 또 바뀌면 그때 범용 폴백이 유일한 경로가 되고,
   * 그 순간 이 등록이 없으면 기간이 조용히 빈다. 못 잡는 걸 잡는 척하지 않고, 무엇을 지키는지
   * 아는 층위에서 고정한다.
   */
  it("확정본 '진행 기간'이 코어 '기간'의 동의어로 등록돼 있다", () => {
    expect(equivalentLabels("기간")).toContain("진행 기간")
  })

  it("확정본 '팀원'·'기획 배경 / 동기'도 구 라벨과 같은 그룹이다", () => {
    expect(equivalentLabels("팀 구성")).toContain("팀원")
    expect(equivalentLabels("목표/만들고 싶었던 이유")).toContain("기획 배경 / 동기")
    expect(equivalentLabels("목표/문제 정의")).toContain("기획 배경 / 동기")
  })
})

describe("computeFormCards", () => {
  it("헤더(경험명/요약)를 key 로 추출하고 카드에 넣지 않는다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    expect(r.titleBlock?.label).toBe("경험명")
    expect(r.summaryBlock?.label).toBe("한 줄 요약")
    for (const c of r.cards) {
      expect(c.blocks.find(b => b.label === "경험명")).toBeUndefined()
      expect(c.blocks.find(b => b.label === "한 줄 요약")).toBeUndefined()
    }
  })

  it("career: basic=근무정보, repeat=프로젝트/담당 업무, detail=경험상세, evidence=증빙 카드가 보인다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])
    const basic = r.cards.find(c => c.category === "basic")!
    expect(basic.blocks.some(b => b.label === "회사명")).toBe(true)
    const repeat = r.cards.find(c => c.category === "repeat")!
    expect(repeat.blocks.some(b => b.label === "프로젝트/담당 업무")).toBe(true)
    const evidence = r.cards.find(c => c.category === "evidence")!
    expect(evidence.blocks.some(b => b.label === "증빙 자료")).toBe(true)
  })

  it("detail 카드만 optional", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    for (const c of r.cards) {
      expect(!!c.optional).toBe(c.category === "detail")
    }
  })

  it("dedup(career): 비어있는 core 기간은 재직기간과 중복이라 숨긴다", () => {
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks)
    expect(all.filter(b => b.label === "기간").length).toBe(0)
  })

  it("dedup(career): core 역할/성과가 type 섹션 동의어와 중복이면 숨긴다", () => {
    // career 는 '직무 / 포지션'(role)·'나의 담당 업무 / 주요 성과'(achievement)를 앵커로 가져
    // 비어있는 core 역할/기여도·핵심 성과를 숨긴다. (수업은 성과 앵커가 없어 CORE_EXCLUDE 로 제거)
    const { core, sections } = sectionsFor("career")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks)
    expect(all.filter(b => b.label === "내 역할/기여도").length).toBe(0)
    expect(all.filter(b => b.label === "핵심 성과").length).toBe(0)
  })

  it("dedup 안전장치: 값이 채워진 core 블록은 중복이어도 유지한다", () => {
    const { core, sections } = sectionsFor("career")
    const period = core.find(b => b.label === "기간")!
    period.value = { type: "period", start: "2024-01", end: "2024-06", isCurrent: false }
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks)
    expect(all.some(b => b.id === period.id)).toBe(true)
  })

  it("repeat 섹션이 없는 유형(award)은 repeat 카드를 숨긴다", () => {
    const { core, sections } = sectionsFor("award")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).not.toContain("repeat")
    expect(r.visibleCategories).toContain("basic")
    expect(r.visibleCategories).toContain("evidence")
  })

  it("labelOverrides: 지정 카테고리는 오버라이드 라벨, 미지정은 기본 라벨", () => {
    const { core, sections } = sectionsFor("academic-society")
    const overridden = computeFormCards(core, sections, { repeat: "프로젝트 기록" })
    const repeat = overridden.cards.find(c => c.category === "repeat")!
    expect(repeat.label).toBe("프로젝트 기록")
    // 미지정 카테고리는 기본(SECTION_CATEGORIES) 라벨 유지
    expect(overridden.cards.find(c => c.category === "basic")!.label).toBe("기본 정보")
  })

  it("labelOverrides 미전달 시 기본 라벨을 쓴다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const plain = computeFormCards(core, sections)
    expect(plain.cards.find(c => c.category === "repeat")!.label).toBe("반복 기록")
  })

  it("학회 detail 카드는 학회 전용 6필드로 구성되고 범용 확장·commonCore 성과 필드가 없다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    const labels = detail.blocks.map(b => b.label)
    // 학회 전용 6필드(노션 원본) 존재
    for (const l of [
      "참여 동기",
      "단체 활동 / 성과",
      "개인 활동 / 성과",
      "성장 / 변화",
      "사용한 스킬 / 툴 / 기술",
      "협업 / 팀원",
    ]) {
      expect(labels).toContain(l)
    }
    // 범용 확장 필드(buildExtendedSection) 부재
    expect(labels).not.toContain("배경/목표")
    expect(labels).not.toContain("내가 한 행동")
    expect(labels).not.toContain("결과/성과")
    expect(labels).not.toContain("배운 점")
    expect(labels).not.toContain("난이도")
    // commonCore detail 필드는 학회 앵커와 동의어라 dedup 으로 부재
    expect(labels).not.toContain("핵심 성과")
    expect(labels).not.toContain("내 역할/기여도")
    // 공개 설정은 포트폴리오 발행에 필요하므로 보존
    expect(labels).toContain("공개 설정")
  })

  // detail 섹션을 정의하지 않은 유형은 지금도 범용 확장 카드로 폴백한다.
  // (club 은 FRT-178, volunteer 는 FRT-247 에서 자기 detail 섹션을 갖게 되어 더는 예시가 아니다 —
  //  확정본 정렬이 한 유형씩 들어올 때마다 이 예시를 옮겨 왔다.)
  it("비-커스텀 유형(sports)은 범용 확장 필드(배경/목표·공개 설정)를 유지한다", () => {
    const { core, sections } = sectionsFor("sports")
    const r = computeFormCards(core, sections)
    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    expect(all).toContain("배경/목표")
    expect(all).toContain("공개 설정")
  })

  /**
   * FRT-247: 봉사 확정본은 섹션이 둘이고 §7 도 "사이드 네비: 섹션 2개 앵커"로 못 박았다.
   * core '증빙 자료'를 CORE_EXCLUDE 로 빼지 않으면 evidence 카드가 따로 생겨 3카드가 되고,
   * 확정본이 ① 안에 둔 '봉사 확인서 첨부' 옆에 파일 입력칸이 한 벌 더 붙는다.
   */
  it("봉사: 확정본대로 2카드이고 detail 카드 이름이 '봉사 회고'다", () => {
    const { core, sections } = sectionsFor("volunteer")
    const r = computeFormCards(core, sections, SECTION_LABEL_OVERRIDES.volunteer)

    expect(r.visibleCategories).toEqual(["basic", "detail"])
    expect(r.cards.find(c => c.category === "detail")!.label).toBe("봉사 회고")

    // 파일 입력칸은 ① 안의 '봉사 확인서 첨부' 하나뿐이다.
    const fileBlocks = r.cards.flatMap(c => c.blocks).filter(b => b.type === "file")
    expect(fileBlocks.map(b => b.label)).toEqual(["봉사 확인서 첨부"])
  })

  /**
   * FRT-267: 창작물 확정본도 섹션이 둘이고 §7 이 "사이드 네비: 섹션 2개 앵커"로 못 박았다.
   * core '증빙 자료'를 CORE_EXCLUDE 로 빼지 않으면 evidence 카드가 따로 생겨 3카드가 된다.
   *
   * ⚠️ 봉사와 달리 core '내 역할/기여도'는 남긴다 — 구 창작물 템플릿에 role 앵커가 없어 이 칸이
   * 실제로 렌더됐고 값이 들어 있을 수 있기 때문이다. **비어 있으면** 확정본 '역할'이 앵커가 되어
   * dedup 이 숨기고, 값이 있으면 남는다. 두 방향을 함께 고정한다.
   */
  it("창작물: 확정본대로 2카드이고 detail 카드 이름이 '작업 상세'다", () => {
    const { core, sections } = sectionsFor("creative-work")
    const r = computeFormCards(core, sections, SECTION_LABEL_OVERRIDES["creative-work"])

    expect(r.visibleCategories).toEqual(["basic", "detail"])
    expect(r.cards.find(c => c.category === "detail")!.label).toBe("작업 상세")

    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    // detail 섹션이 생겼으므로 범용 확장 필드는 더 이상 붙지 않는다.
    expect(all).not.toContain("배경/목표")
    expect(all).not.toContain("배운 점")
    // 빈 코어 '내 역할/기여도'는 확정본 '역할' 앵커에 밀려 숨는다.
    expect(all).not.toContain("내 역할/기여도")
    // 파일 입력칸은 ① 안의 '작품 링크 / 파일' 표뿐 — core '증빙 자료' 파일 블록이 남지 않는다.
    expect(r.cards.flatMap(c => c.blocks).filter(b => b.type === "file")).toEqual([])
  })

  it("창작물: 값이 든 코어 '내 역할/기여도'는 dedup 에 지워지지 않는다", () => {
    const { core, sections } = sectionsFor("creative-work")
    const filledCore = core.map(b =>
      b.label === "내 역할/기여도"
        ? { ...b, value: { type: "textarea" as const, text: "기획·촬영·편집을 모두 맡았습니다." } }
        : b,
    )
    const r = computeFormCards(filledCore, sections, SECTION_LABEL_OVERRIDES["creative-work"])

    expect(r.cards.flatMap(c => c.blocks).map(b => b.label)).toContain("내 역할/기여도")
    // 값이 살아나도 카드 수는 그대로 둘이다(코어는 detail 버킷으로 들어간다).
    expect(r.visibleCategories).toEqual(["basic", "detail"])
  })

  /**
   * FRT-267 리뷰 지적 — 위 두 테스트는 `computeFormCards` 만 본다. 실제 화면은 그 뒤에
   * `partitionByCondition` 이 한 번 더 걸리므로, **둘을 함께 돌려야** 사용자가 보는 역할 칸이 나온다.
   *
   * ⚠️ 여기서 나오는 결론이 창작물의 의도된 동작이다: **'개인 작업'을 고르면 역할 칸이 하나도 없다.**
   * `computeFormCards` 는 `visibleWhen` 을 보지 않고 템플릿 라벨을 전부 앵커로 삼으므로 확정본
   * '역할'(SEMANTIC_GROUPS.role 동의어)이 빈 코어 '내 역할/기여도'를 항상 지우고, 그 '역할'은
   * 조건 미충족이라 렌더되지 않는다. 확정본 §7 이 "'개인 작업' 외 선택 시 노출"로 정한 그대로다 —
   * 혼자 한 작업에 역할을 묻지 않는 것이 확정본의 결정이고, 선행 5종(봉사·해외경험·독서·어학·자격증)은
   * 아예 `CORE_EXCLUDE` 로 역할 칸을 없앴다.
   *
   * ⚠️ 그래도 **값은 어느 경로로도 잃지 않는다** — 아래 두 케이스가 그 방어선이다:
   *  · 구 레코드의 코어 역할에 값이 있으면 dedup 이 못 지운다(`keepCoreOrExtended`)
   *  · 팀에서 '역할'을 적고 '개인 작업'으로 되돌려도 `partitionByCondition` 은 빈 블록만 숨긴다
   * 이 넷을 한 테스트에 묶는다. 어느 하나라도 뒤집히면(예: '역할' 라벨을 role 그룹 밖으로 바꾸거나
   * `computeFormCards` 가 `visibleWhen` 을 보게 되면) 여기서 걸린다.
   */
  it("창작물: 개인/팀 값에 따라 화면에 남는 역할 칸이 갈리고, 값은 어느 쪽에서도 안 사라진다", () => {
    const roleFieldsFor = (collab: string, coreRole = "") => {
      const { core, sections } = sectionsFor("creative-work")
      const withCore = core.map(b =>
        b.label === "내 역할/기여도" && coreRole
          ? { ...b, value: { type: "textarea" as const, text: coreRole } }
          : b,
      )
      const withCollab = sections.map(s => ({
        ...s,
        blocks: s.blocks.map(b =>
          b.label === "개인 / 팀" && collab
            ? { ...b, value: { type: "single-select" as const, selected: collab, options: [] } }
            : b,
        ),
      }))
      const r = computeFormCards(withCore, withCollab, SECTION_LABEL_OVERRIDES["creative-work"])
      const cardBlocks = r.cards.flatMap(c => c.blocks)
      const allFlat = [...withCore, ...withCollab.flatMap(s => s.blocks)]
      return partitionByCondition(cardBlocks, allFlat)
        .visible.map(b => b.label)
        .filter(l => l.includes("역할") || l.includes("기여"))
    }

    // 아직 안 고른 신규 기록 · '개인 작업' — 확정본대로 역할을 묻지 않는다.
    expect(roleFieldsFor("")).toEqual([])
    expect(roleFieldsFor("개인 작업")).toEqual([])
    // 팀 작업 — 확정본 '역할' 하나만. 코어가 함께 나와 두 칸이 되면 안 된다.
    expect(roleFieldsFor("팀 작업(2~5명)")).toEqual(["역할"])
    // 구 레코드가 코어에 남긴 값은 '개인 작업'에서도 화면에 남는다(= 유실 없음).
    expect(roleFieldsFor("개인 작업", "혼자 기획·촬영·편집")).toEqual(["내 역할/기여도"])
  })

  /**
   * 위 마지막 방어선의 짝 — 팀에서 '역할'을 적은 뒤 '개인 작업'으로 되돌리는 경로.
   * `partitionByCondition` 이 조건 미충족이어도 **빈 블록만** 숨기므로 적어 둔 값이 화면에 남는다
   * (conditional-fields.ts 의 FRT-190 결론: 값 있는 필드를 숨기면 화면엔 없는데 저장 payload·
   * AI 분석에는 남는 무음 잔존이 된다).
   */
  it("창작물: 팀에서 적은 '역할' 값은 '개인 작업'으로 되돌려도 화면에서 사라지지 않는다", () => {
    const { core, sections } = sectionsFor("creative-work")
    const edited = sections.map(s => ({
      ...s,
      blocks: s.blocks.map(b => {
        if (b.label === "개인 / 팀") {
          return { ...b, value: { type: "single-select" as const, selected: "개인 작업", options: [] } }
        }
        if (b.label === "역할") {
          return { ...b, value: { type: "text" as const, text: "아트디렉터" } }
        }
        return b
      }),
    }))
    const r = computeFormCards(core, edited, SECTION_LABEL_OVERRIDES["creative-work"])
    const cardBlocks = r.cards.flatMap(c => c.blocks)
    const allFlat = [...core, ...edited.flatMap(s => s.blocks)]
    const { visible, hidden } = partitionByCondition(cardBlocks, allFlat)

    expect(visible.map(b => b.label)).toContain("역할")
    expect(hidden.map(b => b.label)).not.toContain("역할")
  })

  /**
   * 프로젝트(FRT-291)는 창작물과 같은 조합인데 **코어 역할을 안 뺐다는 점이 다르다** —
   * 구 개인 프로젝트 템플릿에 role 앵커가 하나도 없어 그 코어 칸이 실제로 렌더됐기 때문이다.
   * 그래서 "신규 개인 프로젝트에는 역할 칸이 0개"(확정본대로)와 "구 레코드의 코어 역할 값은
   * 남는다"(유실 없음)가 **동시에** 성립해야 한다. 함수 하나가 아니라 화면이 보는 마지막 층까지
   * 이어 붙여 센다(FRT-267 ⑩).
   */
  it("프로젝트: 개인/팀 값에 따라 화면에 남는 역할 칸이 갈리고, 값은 어느 쪽에서도 안 사라진다", () => {
    const roleFieldsFor = (collab: string, coreRole = "") => {
      const { core, sections } = sectionsFor("personal-project")
      const withCore = core.map(b =>
        b.label === "내 역할/기여도" && coreRole
          ? { ...b, value: { type: "textarea" as const, text: coreRole } }
          : b,
      )
      const withCollab = sections.map(s => ({
        ...s,
        blocks: s.blocks.map(b =>
          b.label === "개인 / 팀" && collab
            ? { ...b, value: { type: "single-select" as const, selected: collab, options: [] } }
            : b,
        ),
      }))
      const r = computeFormCards(withCore, withCollab, SECTION_LABEL_OVERRIDES["personal-project"])
      const cardBlocks = r.cards.flatMap(c => c.blocks)
      const allFlat = [...withCore, ...withCollab.flatMap(s => s.blocks)]
      return partitionByCondition(cardBlocks, allFlat)
        .visible.map(b => b.label)
        .filter(l => l.includes("역할") || l.includes("기여"))
    }

    // 아직 안 고른 신규 기록 · '개인 프로젝트' — 확정본대로 역할을 묻지 않는다(사용자 확인).
    expect(roleFieldsFor("")).toEqual([])
    expect(roleFieldsFor("개인 프로젝트")).toEqual([])
    // 팀 프로젝트 — 확정본 '역할' 하나만. 코어가 함께 나와 두 칸이 되면 안 된다.
    expect(roleFieldsFor("팀 프로젝트(2~5명)")).toEqual(["역할"])
    // 구 개인 프로젝트 레코드가 코어에 남긴 값은 '개인 프로젝트'에서도 화면에 남는다(= 유실 없음).
    expect(roleFieldsFor("개인 프로젝트", "기획부터 배포까지 혼자")).toEqual(["내 역할/기여도"])
  })

  /** 확정본 5섹션이 고정 4카테고리로 접힌다 — ④ 공개/배포와 ⑤ 결과물이 한 카드다. */
  it("프로젝트: 확정본 5섹션이 4카드로 접히고 ④⑤ 가 한 카드에 순서대로 든다", () => {
    const { core, sections } = sectionsFor("personal-project")
    const r = computeFormCards(core, sections, SECTION_LABEL_OVERRIDES["personal-project"])

    expect(r.cards.map(c => c.label)).toEqual([
      "기본 정보",
      "프로젝트 상세",
      "세부 작업 기록",
      "공개 / 배포 · 결과물",
    ])
    const evidence = r.cards.find(c => c.category === "evidence")!
    expect(evidence.blocks.map(b => b.label)).toEqual([
      "배포 / 공개 채널",
      "사용자 수 / 반응",
      "외부 노출 이력",
      "서비스 운영 상태",
      "결과물 링크 / 파일",
    ])
  })

  // ── FRT-178: 동아리가 확정본 4카드로 그려지는지 (문서 ①~④) ──
  it("동아리: 4카드가 모두 보이고 범용 확장 카드가 걷힌다", () => {
    const { core, sections } = sectionsFor("club")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])

    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    // detail 섹션이 생겼으므로 범용 확장 필드는 더 이상 붙지 않는다.
    expect(all).not.toContain("배경/목표")
    expect(all).not.toContain("내가 한 행동")
    expect(all).not.toContain("배운 점")
    // core '기간'·'내 역할/기여도'는 '활동 기간'·'역할 / 직책' 동의어라 숨는다.
    expect(all).not.toContain("기간")
    expect(all).not.toContain("내 역할/기여도")
    // core '핵심 성과'는 CORE_EXCLUDE 로 애초에 없다(② 주요 성과·③ 핵심 성과 컬럼이 대신 묻는다).
    expect(all).not.toContain("핵심 성과")
    // 문서 ④ 활동 증빙 = core 증빙 자료.
    expect(r.cards.find(c => c.category === "evidence")!.blocks.map(b => b.label)).toContain("증빙 자료")
    // 공개 설정은 보존(설정 섹션).
    expect(all).toContain("공개 설정")
  })

  it("동아리 detail 카드는 확정본 5필드 + 공개 설정만 갖는다", () => {
    const { core, sections } = sectionsFor("club")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    expect(detail.blocks.map(b => b.label)).toEqual([
      "가입 동기",
      "동아리 소개",
      "주요 활동 / 이벤트",
      "주요 성과",
      "활동 성격",
      "공개 설정",
    ])
  })

  // ── FRT-177: 대외활동이 확정본 4카드로 그려지는지 (문서 ①~④) ──
  it("대외활동: 4카드가 모두 보이고 core 중복 필드는 유형 앵커에 흡수된다", () => {
    const { core, sections } = sectionsFor("extracurricular")
    const r = computeFormCards(core, sections)
    expect(r.visibleCategories).toEqual(["basic", "detail", "repeat", "evidence"])

    const all = r.cards.flatMap(c => c.blocks).map(b => b.label)
    // core '기간'·'내 역할/기여도'는 '활동 기간'·'참여 역할 / 포지션' 동의어라 숨는다.
    expect(all).not.toContain("기간")
    expect(all).not.toContain("내 역할/기여도")
    // core '핵심 성과'는 CORE_EXCLUDE 로 애초에 없다(② 주요 성과·③ 핵심 성과 컬럼이 대신 묻는다).
    expect(all).not.toContain("핵심 성과")
    // 문서 ④ 활동 증빙 = core 증빙 자료(파일+설명+증빙 유형).
    expect(r.cards.find(c => c.category === "evidence")!.blocks.map(b => b.label)).toContain("증빙 자료")
  })

  it("대외활동 detail 카드는 확정본 ② 5필드 + 공개 설정만 갖는다", () => {
    const { core, sections } = sectionsFor("extracurricular")
    const r = computeFormCards(core, sections)
    const labels = r.cards.find(c => c.category === "detail")!.blocks.map(b => b.label)
    expect(labels).toEqual([
      "지원 동기",
      "활동 내용 요약",
      "주요 미션 / 프로젝트",
      "주요 성과",
      "활동 성격",
      "공개 설정",
    ])
    // 범용 확장(buildExtendedSection) 필드는 유형 전용 detail 이 있으므로 부재
    expect(labels).not.toContain("배경/목표")
  })

  it("학회 템플릿: society-info 에 지원 동기가 없고 society-detail 에 참여 동기가 있다", () => {
    const t = getTemplateForType("academic-society")
    const info = t.extensions.find(e => e.id === "society-info")!
    expect(info.blocks.some(b => b.label === "지원 동기")).toBe(false)
    const detail = t.extensions.find(e => e.id === "society-detail")!
    expect(detail.category).toBe("detail")
    expect(detail.blocks.some(b => b.label === "참여 동기")).toBe(true)
  })
})

describe("isCardComplete / computeFormProgress", () => {
  function fillBlock(card: FormCardModel, label: string, text: string) {
    const b = card.blocks.find(x => x.label === label)!
    b.value = { type: b.value.type === "textarea" ? "textarea" : "text", text } as Block["value"]
  }

  it("필수 항목이 모두 채워지면 완료, 하나라도 비면 미완료", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const basic = r.cards.find(c => c.category === "basic")!
    // basic 필수(학회): 학회명·기간·역할/직책(경험명은 titleBlock 으로 추출돼 카드 밖). 초기엔 미완료.
    expect(basic.blocks.filter(b => b.required).map(b => b.label).sort()).toEqual(["기간", "역할/직책", "학회명"])
    expect(isCardComplete(basic)).toBe(false)
    // 필수 텍스트만 채우고 기간(period)은 비워두면 여전히 미완료
    fillBlock(basic, "학회명", "한국인공지능학회")
    fillBlock(basic, "역할/직책", "부회장")
    expect(isCardComplete(basic)).toBe(false)
    // 기간(period)까지 채우면 완료
    const period = basic.blocks.find(b => b.label === "기간")!
    period.value = { type: "period", start: "2024-03", end: "2024-12", isCurrent: false }
    expect(isCardComplete(basic)).toBe(true)
  })

  // 기간 셀은 종료를 먼저 고르면 시작이 빈 채로 저장된다 — 사용자가 방금 고른 값을 잃지
  // 않으려는 의도된 직렬화다. 다만 그 부분 입력이 필수 컬럼을 충족한 것으로 잡히면
  // 진행도가 완료라고 거짓말한다(기간은 시작이 있어야 한 기간이다).
  it("기간 필수 컬럼은 시작 없이 종료만 있으면 완료로 치지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")

    const withPeriodColumn = {
      ...cell.value,
      columns: [{ key: "period", label: "기간", blockType: "period" as const, required: true }],
    }

    cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: " ~ 2024.01" } }] }
    expect(isCardComplete(repeat)).toBe(false)

    cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: " ~ 현재" } }] }
    expect(isCardComplete(repeat)).toBe(false)

    // 시작이 들어오면 그때 완료다. 종료가 없는 한 토큰짜리 값도 온전한 기간이다.
    cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: "2023.03" } }] }
    expect(isCardComplete(repeat)).toBe(true)

    cell.value = {
      ...withPeriodColumn,
      rows: [{ id: "row-1", cells: { period: "2023.03 ~ 2024.01" } }],
    }
    expect(isCardComplete(repeat)).toBe(true)
  })

  // 텍스트 열을 기간으로 바꾸면 옛 값이 그대로 남는다. 셀은 그 값을 못 그려 빈 칸 + 안내를
  // 띄우는데, 진행도만 "채워짐"이라고 하면 화면과 어긋난다 — 두 판정이 같은 기준을 써야 한다.
  it("기간 필수 컬럼은 달력에 없는 옛 값을 완료로 치지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")

    const withPeriodColumn = {
      ...cell.value,
      columns: [{ key: "period", label: "기간", blockType: "period" as const, required: true }],
    }

    for (const legacy of ["자유 형식 메모", "2023.13", "2023.13 ~ 2024.01", "작년 봄쯤"]) {
      cell.value = { ...withPeriodColumn, rows: [{ id: "row-1", cells: { period: legacy } }] }
      expect(isCardComplete(repeat), legacy).toBe(false)
    }

    // 일 단위 값은 절삭돼도 시작 월이 실재하므로 기간으로 성립한다.
    cell.value = {
      ...withPeriodColumn,
      rows: [{ id: "row-1", cells: { period: "2023.03.15 ~ 2024.01.20" } }],
    }
    expect(isCardComplete(repeat)).toBe(true)
  })

  // 블록 층위 기간도 같은 부분 입력을 만든다 — `PeriodBlock` 이 `formatPeriodString` 을 거치므로
  // 종료만 고르면 start 가 빈 값으로 저장되고, `isBlockEmpty` 는 둘 중 하나만 있어도 '안 비었다'다.
  it("블록 층위 기간도 시작 없이 종료만 있으면 완료로 치지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const basic = r.cards.find(c => c.category === "basic")!
    fillBlock(basic, "학회명", "한국인공지능학회")
    fillBlock(basic, "역할/직책", "부회장")
    const period = basic.blocks.find(b => b.label === "기간")!

    period.value = { type: "period", start: "", end: "2024-12", isCurrent: false }
    expect(isCardComplete(basic)).toBe(false)

    period.value = { type: "period", start: "", end: "", isCurrent: true }
    expect(isCardComplete(basic)).toBe(false)

    period.value = { type: "period", start: "2024-03", end: "", isCurrent: true }
    expect(isCardComplete(basic)).toBe(true)
  })

  it("필수 없는 섹션(detail)은 하나라도 채우면 완료", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    expect(detail.blocks.some(b => b.required)).toBe(false)
    expect(isCardComplete(detail)).toBe(false)
    fillBlock(detail, detail.blocks[0].label, "무언가 입력")
    expect(isCardComplete(detail)).toBe(true)
  })

  it("repeatable-cell 섹션(학회 프로젝트 기록): 빈 행은 미완료, 필수 셀 채운 행은 완료", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    expect(isCardComplete(repeat)).toBe(false)
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    const requiredKeys = cell.value.columns.filter(c => c.required).map(c => c.key)
    expect(requiredKeys.length).toBeGreaterThan(0)
    // 빈 행만 추가하면 여전히 미완료 (필수 셀 미충족)
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: {} }] }
    expect(isCardComplete(repeat)).toBe(false)
    // 필수 셀을 모두 채운 행이 있으면 완료
    const filledCells: Record<string, string> = {}
    for (const k of requiredKeys) filledCells[k] = "값"
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: filledCells }] }
    expect(isCardComplete(repeat)).toBe(true)
  })

  it("필수 컬럼 repeatable + optional 형제: optional 만 채우면 미완료", () => {
    // Codex P2: block.required 는 false 지만 필수 컬럼을 가진 repeatable-cell 은 필수로 취급해야 한다.
    //
    // ⚠️ 카드를 **직접 구성**한다. 원래는 팀 프로젝트 '작업 기록' 카드를 픽스처로 썼는데, 확정본
    // 정렬(FRT-291)로 그 카드가 사라졌고 **지금은 이 모양을 가진 유형이 하나도 없다**(필수 컬럼
    // 표와 표 아닌 형제가 같은 repeat 카드에 있는 조합). 다른 유형으로 갈아타면 그 유형이 개편될
    // 때 이 테스트가 다시 죽거나, 더 나쁘게는 모양이 조용히 달라져 **아무것도 검증하지 않는
    // 그물**이 된다. 검증 대상은 `isCardComplete` 의 판정 규칙이지 특정 템플릿의 생김새가 아니다.
    const cell: Block = {
      id: "cell", key: "t.표", type: "repeatable-cell", label: "작업 기록",
      value: {
        type: "repeatable-cell",
        columns: [
          { key: "task", label: "작업명", blockType: "text", required: true },
          { key: "memo", label: "메모", blockType: "textarea" },
        ],
        rows: [],
      },
    }
    const sibling: Block = {
      id: "sib", key: "t.메모", type: "textarea", label: "회고",
      value: { type: "textarea", text: "" },
    }
    const repeat: FormCardModel = { category: "repeat", label: "반복 기록", blocks: [cell, sibling] }
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(cell.value.columns.some(c => c.required)).toBe(true)
    expect(cell.required).toBeFalsy()
    // optional 형제만 채움 → 필수 컬럼 미충족이므로 여전히 미완료여야 한다
    sibling.value = { type: "textarea", text: "채움" }
    expect(isCardComplete(repeat)).toBe(false)
    // 필수 컬럼을 채운 행이 생기면 완료
    const filled: Record<string, string> = {}
    for (const c of cell.value.columns.filter(c => c.required)) filled[c.key] = "값"
    cell.value = { ...cell.value, rows: [{ id: "row-1", cells: filled }] }
    expect(isCardComplete(repeat)).toBe(true)
  })

  it("FRT-145: 추가 항목만 채우면 필수 컬럼을 대신 충족하지 않는다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const repeat = r.cards.find(c => c.category === "repeat")!
    const cell = repeat.blocks.find(b => b.value.type === "repeatable-cell")!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(cell.value.columns.some(c => c.required)).toBe(true)
    // 사용자가 추가한 항목만 채운 행 — 필수 컬럼(프로젝트명)은 여전히 비어 있다.
    cell.value = {
      ...cell.value,
      rows: [{
        id: "row-1",
        cells: {},
        extraFields: [{ key: "x1", label: "발표 여부", blockType: "text", value: "구두 발표" }],
      }],
    }
    expect(isCardComplete(repeat)).toBe(false)
  })

  it("FRT-145: 필수 컬럼이 없는 반복 블록은 추가 항목만 채워도 완료로 본다", () => {
    // 필수 컬럼이 없으면 판정은 '아무거나 채워졌는가'다 — 그 '아무거나'에 추가 항목도 포함된다
    // (제외하면 사용자가 쓴 값이 진행도에 안 잡힌다).
    const { core, sections } = sectionsFor("education")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    const cell = detail.blocks.find(
      b => b.value.type === "repeatable-cell" && !b.value.columns.some(c => c.required),
    )!
    if (cell.value.type !== "repeatable-cell") throw new Error("expected repeatable-cell")
    expect(isCardComplete(detail)).toBe(false)
    cell.value = {
      ...cell.value,
      rows: [{
        id: "row-1",
        cells: {},
        extraFields: [{ key: "x1", label: "참고 자료", blockType: "text", value: "링크" }],
      }],
    }
    expect(isCardComplete(detail)).toBe(true)
  })

  it("computeFormProgress: done/total 카운트", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    expect(computeFormProgress(r.cards)).toEqual({ done: 0, total: r.cards.length })
    const detail = r.cards.find(c => c.category === "detail")!
    fillBlock(detail, detail.blocks[0].label, "채움")
    expect(computeFormProgress(r.cards).done).toBe(1)
  })

  /**
   * FRT-190 — 숨김은 진행도에도 반영돼야 한다.
   *
   * 필수 없는 카드(경험 상세·증빙)는 `blocks.some(채워짐)` 이라 **하나라도** 채워야 완료다.
   * 사용자가 그 카드의 빈 선택 항목을 "해당 없음"으로 전부 치우면 채울 것이 하나도 안 남는데,
   * 판정이 숨긴 블록을 계속 세면 그 카드는 **영원히 미완료**로 남아 진행도가 100% 에 못 간다.
   * 되돌려서 자기에게 해당 없는 항목을 채워야만 바가 차는 셈이라, 숨김 기능과 정면으로 어긋난다.
   */
  it("선택 카드의 빈 항목을 전부 숨기면 그 카드는 완료로 센다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    const before = computeFormProgress(r.cards).done

    const allKeys = detail.blocks.map(b => b.key).filter((k): k is string => !!k)
    expect(allKeys.length).toBeGreaterThan(0) // 픽스처가 분기를 실제로 거치는지
    expect(computeFormProgress(r.cards, allKeys).done).toBe(before + 1)
  })

  it("일부만 숨기면 여전히 미완료다 — 남은 칸은 채울 것이 있다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const detail = r.cards.find(c => c.category === "detail")!
    const oneKey = detail.blocks.map(b => b.key).filter((k): k is string => !!k)[0]
    expect(detail.blocks.length).toBeGreaterThan(1)
    expect(computeFormProgress(r.cards, [oneKey]).done).toBe(0)
  })

  /** 필수가 남아 있으면 숨김과 무관하게 필수 기준 그대로다(필수는 애초에 숨길 수 없다). */
  it("필수가 있는 카드는 숨김 목록이 있어도 필수를 채워야 완료다", () => {
    const { core, sections } = sectionsFor("academic-society")
    const r = computeFormCards(core, sections)
    const basic = r.cards.find(c => c.category === "basic")!
    const someKey = basic.blocks.map(b => b.key).filter((k): k is string => !!k)[0]
    expect(computeFormProgress(r.cards, [someKey]).done).toBe(0)
  })
})
