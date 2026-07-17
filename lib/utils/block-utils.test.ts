import { describe, expect, it } from "vitest"
import {
  cloneBlock,
  cloneBlocks,
  createChecklistField,
  createDateField,
  createFileField,
  createGroupBlock,
  createLinkField,
  createOutcomeList,
  createPeriodField,
  createRepeatableCell,
  createSelectField,
  createTagsField,
  createTextField,
  isBlockEmpty,
  validateRequiredBlocks,
} from "@/lib/utils/block-utils"

describe("isBlockEmpty", () => {
  it("새로 만든 빈 블록은 모든 타입에서 empty 다", () => {
    expect(isBlockEmpty(createTextField("t"))).toBe(true)
    expect(isBlockEmpty(createDateField("d"))).toBe(true)
    expect(isBlockEmpty(createPeriodField("p"))).toBe(true)
    expect(isBlockEmpty(createSelectField("s", ["a", "b"]))).toBe(true)
    expect(isBlockEmpty(createChecklistField("c", ["a"]))).toBe(true)
    expect(isBlockEmpty(createTagsField("g"))).toBe(true)
    expect(isBlockEmpty(createLinkField("l"))).toBe(true)
    expect(isBlockEmpty(createFileField("f"))).toBe(true)
  })

  it("text 에 값이 들어가면 empty 가 아니다", () => {
    const t = createTextField("t")
    if (t.value.type === "text") t.value.text = "내용"
    expect(isBlockEmpty(t)).toBe(false)
  })

  it("공백만 있는 text 는 여전히 empty 다", () => {
    const t = createTextField("t")
    if (t.value.type === "text") t.value.text = "   "
    expect(isBlockEmpty(t)).toBe(true)
  })

  it("file 은 fileName·fileId·url 중 하나라도 있으면 채워진 것으로 본다", () => {
    const byName = createFileField("f")
    if (byName.value.type === "file") byName.value.fileName = "a.pdf"
    expect(isBlockEmpty(byName)).toBe(false)

    const byId = createFileField("f")
    if (byId.value.type === "file") byId.value.fileId = "file-1"
    expect(isBlockEmpty(byId)).toBe(false)

    const byUrl = createFileField("f")
    if (byUrl.value.type === "file") byUrl.value.url = "https://x"
    expect(isBlockEmpty(byUrl)).toBe(false)
  })
})

describe("validateRequiredBlocks", () => {
  it("required 이면서 비어 있는 블록만 에러 메시지를 모은다", () => {
    const required = createTextField("이름", { required: true })
    const optionalEmpty = createTextField("별명")
    const requiredFilled = createTextField("학교", { required: true })
    if (requiredFilled.value.type === "text") requiredFilled.value.text = "OO대"

    const errors = validateRequiredBlocks([required, optionalEmpty, requiredFilled])
    expect(errors).toEqual(['"이름" 항목을 입력해주세요.'])
  })

  it("문제가 없으면 빈 배열을 반환한다", () => {
    expect(validateRequiredBlocks([createTextField("별명")])).toEqual([])
  })
})

describe("cloneBlock", () => {
  it("새 id 를 부여하고 값은 깊은 복제한다", () => {
    const original = createTextField("t")
    if (original.value.type === "text") original.value.text = "원본"

    const clone = cloneBlock(original)
    expect(clone.id).not.toBe(original.id)
    expect(clone.label).toBe(original.label)
    expect(clone.value).toEqual(original.value)

    // 깊은 복제이므로 클론 변경이 원본에 영향을 주지 않는다.
    if (clone.value.type === "text") clone.value.text = "변경됨"
    expect(original.value).toMatchObject({ text: "원본" })
  })
})

describe("group block", () => {
  it("createGroupBlock 은 grp- 접두사 id·빈 children·collapsed:false 를 갖는다", () => {
    const g = createGroupBlock("새 그룹")
    expect(g.id).toMatch(/^grp-/)
    expect(g.type).toBe("group")
    expect(g.label).toBe("새 그룹")
    expect(g.children).toEqual([])
    expect(g.collapsed).toBe(false)
    expect(g.value).toEqual({ type: "group" })
  })

  it("isBlockEmpty: children 이 없으면 group 은 empty 다", () => {
    const g = createGroupBlock("g")
    expect(isBlockEmpty(g)).toBe(true)
  })

  it("isBlockEmpty: children 이 모두 비어 있으면 group 은 empty 다", () => {
    const g = createGroupBlock("g")
    g.children = [createTextField("t")]
    expect(isBlockEmpty(g)).toBe(true)
  })

  it("isBlockEmpty: children 중 하나라도 채워지면 group 은 empty 가 아니다", () => {
    const g = createGroupBlock("g")
    const t = createTextField("t")
    if (t.value.type === "text") t.value.text = "내용"
    g.children = [t]
    expect(isBlockEmpty(g)).toBe(false)
  })

  it("cloneBlock: group 은 자신·자식 모두 새 id 를 받는다", () => {
    const g = createGroupBlock("g")
    const child = createTextField("c")
    g.children = [child]

    const clone = cloneBlock(g)
    expect(clone.id).not.toBe(g.id)
    expect(clone.children).toHaveLength(1)
    expect(clone.children![0].id).not.toBe(child.id)
    // 깊은 복제 — 클론 자식 변경이 원본에 영향 없음
    if (clone.children![0].value.type === "text") clone.children![0].value.text = "변경"
    expect(child.value).toMatchObject({ text: "" })
  })

  it("cloneBlocks: group 을 포함한 배열도 자식까지 re-id 된다", () => {
    const g = createGroupBlock("g")
    g.children = [createTextField("c")]
    const origChildId = g.children[0].id

    const [cloned] = cloneBlocks([g])
    expect(cloned.children![0].id).not.toBe(origChildId)
  })

  it("validateRequiredBlocks: group 자식의 required 빈 블록도 에러를 낸다", () => {
    const g = createGroupBlock("g")
    const req = createTextField("이름", { required: true })
    g.children = [req]

    const errors = validateRequiredBlocks([g])
    expect(errors).toEqual(['"이름" 항목을 입력해주세요.'])
  })

  it("validateRequiredBlocks: group 자식이 채워져 있으면 에러 없음", () => {
    const g = createGroupBlock("g")
    const req = createTextField("이름", { required: true })
    if (req.value.type === "text") req.value.text = "홍길동"
    g.children = [req]

    expect(validateRequiredBlocks([g])).toEqual([])
  })
})

describe("createRepeatableCell lockColumns (FRT-104)", () => {
  const cols = [{ key: "name", label: "이름", blockType: "text" as const }]

  it("기본으로 컬럼을 잠근다 — 템플릿 표는 컬럼이 고정이다", () => {
    expect(createRepeatableCell("프로젝트/연구활동", cols).lockColumns).toBe(true)
  })

  it("lockColumns:false 로 열 관리를 다시 열 수 있다", () => {
    expect(createRepeatableCell("표", cols, { lockColumns: false }).lockColumns).toBe(false)
  })

  it("createOutcomeList 는 컬럼을 잠그지 않는다 — 레거시 다중컬럼이 표로 폴백되면 열 관리가 필요하다", () => {
    expect(createOutcomeList("단체 활동 / 성과").lockColumns).toBe(false)
  })
})

describe("createOutcomeList (FRT-97/FRT-76)", () => {
  it("단일컬럼 repeatable-cell + variant:'outcome-list' 을 만든다", () => {
    const b = createOutcomeList("단체 활동 / 성과", { placeholder: "예: 수상" })
    expect(b.type).toBe("repeatable-cell")
    expect(b.variant).toBe("outcome-list")
    expect(b.value.type).toBe("repeatable-cell")
    if (b.value.type === "repeatable-cell") {
      expect(b.value.columns).toHaveLength(1)
      expect(b.value.columns[0].key).toBe("item")
      expect(b.value.columns[0].placeholder).toBe("예: 수상")
    }
  })

  it("link 미지정이면 linkConfig 가 없다(프로젝트 연결 버튼 미노출)", () => {
    const b = createOutcomeList("성장 / 변화", { itemLabel: "항목" })
    expect(b.linkConfig).toBeUndefined()
  })

  it("link 를 주면 linkConfig 를 세팅한다(인스턴스별 opt-in·문구 설정)", () => {
    const b = createOutcomeList("단체 활동 / 성과", {
      link: { targetSectionId: "society-projects", titleColumnKey: "name", label: "프로젝트로 연결" },
    })
    expect(b.linkConfig).toEqual({
      targetSectionId: "society-projects",
      titleColumnKey: "name",
      label: "프로젝트로 연결",
    })
  })

  it("link 를 줘도 컬럼은 1개 유지된다(BlockRenderer columnCount<=1 가드 → 표 폴백 안 됨)", () => {
    const b = createOutcomeList("단체 활동 / 성과", {
      link: { targetSectionId: "society-projects", titleColumnKey: "name" },
    })
    if (b.value.type === "repeatable-cell") {
      expect(b.value.columns).toHaveLength(1)
    }
  })
})
