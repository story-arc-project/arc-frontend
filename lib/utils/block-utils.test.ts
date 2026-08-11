import { describe, expect, it } from "vitest"
import {
  cloneBlock,
  roleNamesOf,
  renameRoleTag,
  removeRoleTag,
  mapRoleTags,
  createRoleHistory,
  cloneBlocks,
  createChecklistField,
  createDateField,
  createEmptyRow,
  createFileField,
  createGroupBlock,
  createLinkField,
  createOutcomeList,
  createPeriodField,
  createRepeatableCell,
  createSelectField,
  createTagsField,
  createTextField,
  cellFilled,
  cellText,
  isFileCellValue,
  rowHasContent,
  isBlockDiscardable,
  isBlockEmpty,
  normalizeBlock,
  normalizeBlockForRender,
  normalizeBlockValue,
  normalizeBlocks,
  validateRequiredBlocks,
} from "@/lib/utils/block-utils"
import type { Block, BlockValue, CellValue, FileCellValue } from "@/types/archive"

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

describe("isBlockEmpty repeatable-cell (FRT-122)", () => {
  const cols = [{ key: "item", label: "활동 / 성과", blockType: "text" as const }]

  function withRows(block: ReturnType<typeof createRepeatableCell>, rows: ReturnType<typeof createEmptyRow>[]) {
    if (block.value.type === "repeatable-cell") block.value.rows = rows
    return block
  }

  it("행이 하나도 없으면 empty 다", () => {
    expect(isBlockEmpty(createRepeatableCell("표", cols))).toBe(true)
  })

  it("빈 셀만 있는 행 하나는 empty 다 — 유령 섹션을 만들지 않는다", () => {
    const b = withRows(createRepeatableCell("표", cols), [createEmptyRow(cols)])
    expect(isBlockEmpty(b)).toBe(true)
  })

  it("여러 개의 빈 행도 여전히 empty 다", () => {
    const b = withRows(createRepeatableCell("표", cols), [createEmptyRow(cols), createEmptyRow(cols)])
    expect(isBlockEmpty(b)).toBe(true)
  })

  it("셀 하나라도 채워지면 empty 가 아니다", () => {
    const row = createEmptyRow(cols)
    row.cells.item = "케이스 대회 은상"
    const b = withRows(createRepeatableCell("표", cols), [row])
    expect(isBlockEmpty(b)).toBe(false)
  })

  it("다중 컬럼: 마지막 셀 하나만 채워도 empty 가 아니다", () => {
    const multi = [
      { key: "a", label: "A", blockType: "text" as const },
      { key: "b", label: "B", blockType: "text" as const },
    ]
    const row = createEmptyRow(multi)
    row.cells.b = "값"
    const b = createRepeatableCell("표", multi)
    if (b.value.type === "repeatable-cell") b.value.rows = [row]
    expect(isBlockEmpty(b)).toBe(false)
  })

  it("tags 셀(string[])이 채워지면 empty 가 아니다", () => {
    const tcols = [{ key: "tags", label: "태그", blockType: "tags" as const }]
    const row = createEmptyRow(tcols)
    row.cells.tags = ["백엔드"]
    const b = createRepeatableCell("표", tcols)
    if (b.value.type === "repeatable-cell") b.value.rows = [row]
    expect(isBlockEmpty(b)).toBe(false)
  })

  it("outcome-list 의 빈 행도 empty 다(placeholder 실체화 후 다시 비운 경우)", () => {
    const b = createOutcomeList("성장 / 변화")
    if (b.value.type === "repeatable-cell") b.value.rows = [createEmptyRow(b.value.columns)]
    expect(isBlockEmpty(b)).toBe(true)
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

// ── FRT-178: 역할 태그 파생·전파 ────────────────────────────────

describe("roleNamesOf", () => {
  it("등록된 역할명을 입력 순서대로, 공백·중복 없이 뽑는다", () => {
    const block = createRoleHistory("역할 이력")
    if (block.value.type !== "repeatable-cell") throw new Error("unreachable")
    block.value.rows = [
      { id: "r1", cells: { start: "2024-03", end: "", role: " 회장 " } },
      { id: "r2", cells: { start: "", end: "", role: "" } },
      { id: "r3", cells: { start: "", end: "", role: "회장" } },
      { id: "r4", cells: { start: "", end: "", role: "공연팀장" } },
    ]
    expect(roleNamesOf(block)).toEqual(["회장", "공연팀장"])
  })

  it("repeatable-cell 이 아니면 빈 목록", () => {
    expect(roleNamesOf(createTextField("역할 / 직책"))).toEqual([])
  })
})

describe("mapRoleTags", () => {
  function outcomeWithTags(tags: string[]) {
    const b = createOutcomeList("주요 활동 / 이벤트", { roleTags: true })
    if (b.value.type !== "repeatable-cell") throw new Error("unreachable")
    b.value.rows = [{ id: "r1", cells: { item: "정기 공연" }, roleTags: tags }]
    return b
  }

  function tableWithRoleColumn(tags: string[]) {
    const b = createRepeatableCell("활동 / 이벤트", [
      { key: "role", label: "이 활동 때의 역할", blockType: "checklist", variant: "role-chip" },
      { key: "name", label: "프로젝트명", blockType: "text" },
    ])
    if (b.value.type !== "repeatable-cell") throw new Error("unreachable")
    b.value.rows = [{ id: "r1", cells: { role: tags, name: "봄 공연" } }]
    return b
  }

  it("개조식 행의 roleTags 를 치환한다", () => {
    const next = mapRoleTags(outcomeWithTags(["회장"]), renameRoleTag("회장", "회장단"))
    if (next.value.type !== "repeatable-cell") throw new Error("unreachable")
    expect(next.value.rows[0].roleTags).toEqual(["회장단"])
  })

  it("role-chip 컬럼의 셀을 치환한다", () => {
    const next = mapRoleTags(tableWithRoleColumn(["회장"]), renameRoleTag("회장", "회장단"))
    if (next.value.type !== "repeatable-cell") throw new Error("unreachable")
    expect(next.value.rows[0].cells.role).toEqual(["회장단"])
    expect(next.value.rows[0].cells.name).toBe("봄 공연")
  })

  it("role-chip 이 아닌 컬럼은 이름이 같아도 건드리지 않는다", () => {
    // '역할 이력' 블록 자신의 role 컬럼(자유 텍스트)이 여기 걸리면 사용자가 입력 중인
    // 이름이 자기 자신의 전파로 덮인다.
    const history = createRoleHistory("역할 이력")
    if (history.value.type !== "repeatable-cell") throw new Error("unreachable")
    history.value.rows = [{ id: "r1", cells: { start: "", end: "", role: "회장" } }]
    const next = mapRoleTags(history, renameRoleTag("회장", "회장단"))
    expect(next).toBe(history)
  })

  it("삭제는 태그에서 그 이름만 뺀다", () => {
    const next = mapRoleTags(outcomeWithTags(["회장", "총무"]), removeRoleTag("회장"))
    if (next.value.type !== "repeatable-cell") throw new Error("unreachable")
    expect(next.value.rows[0].roleTags).toEqual(["총무"])
  })

  it("이름을 빈 값으로 고치면 제거로 동작한다", () => {
    const next = mapRoleTags(outcomeWithTags(["회장"]), renameRoleTag("회장", "  "))
    if (next.value.type !== "repeatable-cell") throw new Error("unreachable")
    expect(next.value.rows[0].roleTags).toEqual([])
  })

  it("치환 결과가 이미 붙어 있던 이름과 겹치면 중복을 만들지 않는다", () => {
    const next = mapRoleTags(outcomeWithTags(["회장", "총무"]), renameRoleTag("회장", "총무"))
    if (next.value.type !== "repeatable-cell") throw new Error("unreachable")
    expect(next.value.rows[0].roleTags).toEqual(["총무"])
  })

  it("바뀐 게 없으면 같은 참조를 돌려준다(불필요한 리렌더 방지)", () => {
    const block = outcomeWithTags(["회장"])
    expect(mapRoleTags(block, renameRoleTag("총무", "총무2"))).toBe(block)
  })

  it("group 블록의 자식까지 훑는다", () => {
    const group = createGroupBlock("사용자 섹션")
    group.children = [outcomeWithTags(["회장"])]
    const next = mapRoleTags(group, renameRoleTag("회장", "회장단"))
    const child = next.children![0]
    if (child.value.type !== "repeatable-cell") throw new Error("unreachable")
    expect(child.value.rows[0].roleTags).toEqual(["회장단"])
  })
})

// ─── FRT-213: 파일 셀 값 헬퍼 ────────────────────────────────────

const fileCell: FileCellValue = {
  type: "file",
  fileId: "file-abc",
  fileName: "성적표.pdf",
  mimeType: "application/pdf",
  size: 12345,
}

describe("isFileCellValue (FRT-213)", () => {
  it("파일 셀 값을 알아본다", () => {
    expect(isFileCellValue(fileCell)).toBe(true)
  })

  it("문자열·배열·undefined 는 파일 셀이 아니다", () => {
    expect(isFileCellValue("2023.03 ~ 현재")).toBe(false)
    expect(isFileCellValue(["a", "b"])).toBe(false)
    expect(isFileCellValue(undefined)).toBe(false)
  })
})

describe("cellFilled — 파일 셀 (FRT-213)", () => {
  it("fileId 가 있으면 채워진 것으로 본다", () => {
    expect(cellFilled(fileCell)).toBe(true)
  })

  it("fileId 가 비면 채워지지 않은 것으로 본다 — 업로드 전 빈 껍데기", () => {
    expect(cellFilled({ type: "file", fileId: "", fileName: "" })).toBe(false)
  })

  it("기존 문자열·배열 판정은 그대로다", () => {
    expect(cellFilled("값")).toBe(true)
    expect(cellFilled("   ")).toBe(false)
    expect(cellFilled(["태그"])).toBe(true)
    expect(cellFilled([])).toBe(false)
    expect(cellFilled(undefined)).toBe(false)
  })
})

describe("cellText (FRT-213)", () => {
  it("파일 셀은 파일명으로 접힌다", () => {
    expect(cellText(fileCell)).toBe("성적표.pdf")
  })

  it("파일명이 비면 대체 문구로 접힌다 — 빈 문자열이면 첨부 사실이 사라진다", () => {
    expect(cellText({ type: "file", fileId: "file-x", fileName: "" })).toBe("첨부파일")
  })

  // 첨부를 지우면 `handleDelete` 가 `{fileId:"", fileName:""}` 를 남긴다. 이걸 '첨부파일'로
  // 접으면 없는 첨부가 화면에 남고, 열 유형이 텍스트로 바뀌면 그 문구가 값으로 굳는다.
  // `cellFilled` 는 같은 값을 '비었다'로 보므로 두 판정이 어긋나서도 안 된다.
  it("지워진 첨부는 빈 문자열로 접힌다 — 유령 첨부를 만들지 않는다", () => {
    expect(cellText({ type: "file", fileId: "", fileName: "" })).toBe("")
    expect(cellText({ type: "file", fileId: "", fileName: "성적표.pdf" })).toBe("")
  })

  it("배열은 쉼표로 잇고 문자열은 그대로 둔다 — 기존 6곳의 중복 로직과 동일하다", () => {
    expect(cellText(["a", "b"])).toBe("a, b")
    expect(cellText("2023.03 ~ 현재")).toBe("2023.03 ~ 현재")
    expect(cellText(undefined)).toBe("")
  })
})

describe("rowHasContent — 파일 셀만 채운 행 (FRT-213)", () => {
  it("파일만 첨부한 행은 빈 행이 아니다", () => {
    expect(rowHasContent({ id: "r1", cells: { 결과물: fileCell } })).toBe(true)
  })

  it("빈 파일 셀만 있는 행은 빈 행이다", () => {
    expect(
      rowHasContent({ id: "r1", cells: { 결과물: { type: "file", fileId: "", fileName: "" } } }),
    ).toBe(false)
  })
})

// ─── FRT-200: 저장된 값이 타입이 약속한 모양대로 오지 않을 때 ──────────
//
// `Block.value` 는 non-nullable 로 선언돼 있지만 실제 값은 백엔드 JSONB 를 역직렬화한 것이라
// 런타임에 null·결측 필드가 도착할 수 있다. 그 값이 판정·렌더까지 무검증으로 흘러 화면을
// 통째로 죽였다(FRT-200).
//
// ⚠️ 픽스처는 반드시 `as unknown as` 로 타입 안전망을 우회한다. 타입이 허용하는 리터럴로만
// 쓰면 컴파일러가 그 입력을 막아 **결함을 재현하지 못한다** — 통과하는 테스트가 그물이 아니다.

/** 손상된 저장 값을 타입 검사 없이 블록에 싣는다 — 실제 JSONB 경로를 흉내낸다. */
function withRawValue(block: Block, raw: unknown): Block {
  return { ...block, value: raw as BlockValue }
}

describe("isBlockEmpty — 손상된 저장 값 (FRT-200)", () => {
  it("value 가 통째로 없어도 죽지 않고 '비어 있다'로 판정한다", () => {
    expect(() => isBlockEmpty(withRawValue(createDateField("d"), null))).not.toThrow()
    expect(isBlockEmpty(withRawValue(createDateField("d"), null))).toBe(true)
    expect(isBlockEmpty(withRawValue(createTextField("t"), undefined))).toBe(true)
  })

  it("type 은 있는데 문자열 필드가 null 이어도 죽지 않는다", () => {
    expect(isBlockEmpty(withRawValue(createDateField("d"), { type: "date", date: null }))).toBe(true)
    expect(isBlockEmpty(withRawValue(createTextField("t"), { type: "text" }))).toBe(true)
    expect(
      isBlockEmpty(withRawValue(createLinkField("l"), { type: "link", url: null })),
    ).toBe(true)
  })

  it("배열 필드가 null 이어도 죽지 않는다", () => {
    expect(
      isBlockEmpty(withRawValue(createChecklistField("c", ["a"]), { type: "checklist", checked: null })),
    ).toBe(true)
    expect(isBlockEmpty(withRawValue(createTagsField("g"), { type: "tags", tags: null }))).toBe(true)
  })

  /**
   * 이 단언이 이 묶음의 핵심이다. "죽지 않는다"만 확인하면 **손상 값을 통째로 빈 값으로
   * 갈아치우는 오구현도 통과한다** — 그 구현은 살아 있는 `start` 를 지워 버린다.
   * 살아남은 값이 실제로 판정에 반영되는지를 함께 물어야 그물이 된다.
   */
  it("한쪽 필드만 깨졌으면 살아 있는 쪽이 판정에 반영된다 — 통째 치환 오구현을 잡는다", () => {
    const partial = withRawValue(createPeriodField("p"), {
      type: "period",
      start: "2023.01",
      end: null,
    })
    expect(isBlockEmpty(partial)).toBe(false)
  })

  it("알 수 없는 type 은 '비어 있다'로 접는다", () => {
    expect(isBlockEmpty(withRawValue(createTextField("t"), { type: "미래에생길타입" }))).toBe(true)
  })
})

describe("normalizeBlockValue (FRT-200)", () => {
  it("value 가 통째로 없으면 블록 타입 기준 빈 값으로 복구한다", () => {
    expect(normalizeBlockValue("date", null)).toEqual({ type: "date", date: "" })
    expect(normalizeBlockValue("period", undefined)).toEqual({
      type: "period",
      start: "",
      end: "",
      isCurrent: false,
    })
    expect(normalizeBlockValue("tags", "문자열이왔다")).toEqual({ type: "tags", tags: [] })
  })

  /**
   * `type` 만 깨진 값은 **버릴 값이 아니다.** 블록이 선언한 타입이 곧 그 값을 그리던 컨트롤이라
   * 복구 근거가 된다 — 여기서 빈 값으로 갈면 열었다 저장하는 것만으로 사용자 입력이 지워진다.
   */
  it("type 만 없고 알맹이는 멀쩡한 값은 블록 타입으로 되살린다 — 비우지 않는다", () => {
    expect(normalizeBlockValue("text", { text: "값은있는데 type 이 없다" })).toEqual({
      type: "text",
      text: "값은있는데 type 이 없다",
    })
    expect(normalizeBlockValue("period", { start: "2023.01", end: "2023.12" })).toEqual({
      type: "period",
      start: "2023.01",
      end: "2023.12",
      isCurrent: false,
    })
  })

  /** 값이 든 `type` 을 이 코드가 모를 때도 같다 — 블록이 아는 타입으로 되살린다. */
  /**
   * ⚠️ **모르는 `type` 은 "깨진 것"이 아니라 "내가 모르는 것"일 수 있다** — 새 스키마가 쓴 값을
   * 구 프론트가 열면 그렇다. 블록 타입으로 갈아 끼우면 그 판별자가 지워진 채 저장되어,
   * **열었다 저장하는 것만으로 새 스키마 값이 구 모양으로 굳는다.** 그대로 둔다.
   */
  it("이 코드가 모르는 type 은 갈아 끼우지 않고 그대로 둔다", () => {
    const newer = { type: "brand-new-in-v3", text: "살아있는 값" }
    expect(normalizeBlockValue("text", newer)).toBe(newer)
  })

  /**
   * 값도 블록도 모르는 타입이면 복구할 근거가 없다. 그래도 **지우지는 않는다** —
   * `emptyValue` 는 모르는 타입에서 `undefined` 를 주므로, 갈아치우면 값이 통째로 사라진다.
   */
  it("값도 블록도 모르는 타입이면 원본을 그대로 둔다 (undefined 를 만들지 않는다)", () => {
    const alien = { type: "brand-new-in-v3", payload: "미래 스키마" }
    const out = normalizeBlockValue("brand-new-in-v3" as BlockValue["type"], alien)
    expect(out).toBe(alien)
  })
  /** 살아 있는 값을 지우지 않는다 — 결측 필드만 채운다. */
  it("일부 필드만 깨졌으면 그 필드만 채우고 나머지는 보존한다", () => {
    expect(normalizeBlockValue("period", { type: "period", start: "2023.01", end: null })).toEqual({
      type: "period",
      start: "2023.01",
      end: "",
      isCurrent: false,
    })
    expect(
      normalizeBlockValue("single-select", { type: "single-select", options: ["a"], selected: null }),
    ).toEqual({ type: "single-select", options: ["a"], selected: "" })
  })

  /**
   * 온전한 값은 **같은 참조**로 돌려준다. 렌더 관문(BlockRenderer)이 매 렌더 이 함수를 부르는데
   * 정상 값마다 새 객체를 만들면 props 가 매번 바뀌어 불필요한 리렌더를 낳는다.
   */
  it("온전한 값은 새 객체를 만들지 않고 원본 참조를 그대로 돌려준다", () => {
    const intact: BlockValue = { type: "date", date: "2024-03-01" }
    expect(normalizeBlockValue("date", intact)).toBe(intact)

    const rows: BlockValue = {
      type: "repeatable-cell",
      columns: [{ key: "item", label: "활동", blockType: "text" }],
      rows: [{ id: "r1", cells: { item: "값" } }],
    }
    expect(normalizeBlockValue("repeatable-cell", rows)).toBe(rows)
  })

  /**
   * 행에는 스키마에 없는 부가 필드(FRT-76 링크·FRT-178 역할태그·FRT-145 행 추가항목)가 붙는다.
   * 보정하면서 행을 재구성하면 이것들이 조용히 사라진다 — 값 유실보다 나쁜 건 없다.
   */
  it("행을 보정해도 링크·역할태그·행 추가항목은 살아남는다", () => {
    const normalized = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: null,
      rows: [
        {
          id: "r1",
          cells: { item: "값" },
          linkedProjectRowId: "proj-1",
          roleTags: ["팀장"],
          extraFields: [{ key: "k", label: "메모", blockType: "text", value: "남긴 말" }],
        },
      ],
    })
    expect(normalized).toMatchObject({
      type: "repeatable-cell",
      columns: [],
      rows: [
        {
          id: "r1",
          cells: { item: "값" },
          linkedProjectRowId: "proj-1",
          roleTags: ["팀장"],
          extraFields: [{ key: "k", label: "메모", blockType: "text", value: "남긴 말" }],
        },
      ],
    })
  })

  it("행이 배열이 아니거나 셀이 없어도 죽지 않는다", () => {
    expect(normalizeBlockValue("repeatable-cell", { type: "repeatable-cell", rows: null })).toMatchObject({
      rows: [],
    })
    const noCells = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [{ id: "r1" }],
    })
    expect(() => isBlockEmpty(withRawValue(createTextField("t"), noCells))).not.toThrow()
  })

  it("group 은 값이 없는 센티넬이라 그대로 둔다", () => {
    expect(normalizeBlockValue("group", null)).toEqual({ type: "group" })
  })

  /**
   * ⚠️ **표의 셀·열은 위치가 곧 의미다.** 깨진 원소를 걸러 내면(`filter`) 뒤 원소가 앞으로
   * 당겨져 **다른 열의 값이 된다** — 값 유실보다 나쁜 무음 오염이다. 자리에서 바꿔야 한다.
   */
  it("표는 깨진 셀·열을 걸러 내지 않고 그 자리에서 바꾼다 (열이 밀리면 안 된다)", () => {
    const out = normalizeBlockValue("table", {
      type: "table",
      columns: ["A", null, "C"],
      rows: [[null, "B값", "C값"]],
    })
    expect(out).toMatchObject({
      type: "table",
      columns: ["A", "", "C"],
      rows: [["", "B값", "C값"]],
    })
  })

  /**
   * 행 id 는 수정·삭제 핸들러가 행을 찾는 열쇠다. 결측을 인덱스로 채울 때 이미 그 이름을 쓰는
   * 행이 있으면 **둘이 같은 id 를 갖고**, 하나를 고치면 둘 다 바뀌고 하나를 지우면 둘 다 사라진다.
   */
  /** 이미 저장된 두 행이 같은 id 를 들고 있으면 각 행은 성해 보여도 **쌍으로는 깨져 있다.** */
  it("저장분에 이미 중복된 행 id 가 있으면 뒤엣것을 갈아 준다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [
        { id: "r1", cells: { a: "먼저" } },
        { id: "r1", cells: { a: "나중" } },
      ],
    }) as unknown as { rows: { id: string; cells: Record<string, unknown> }[] }
    expect(new Set(out.rows.map(r => r.id)).size).toBe(2)
    expect(out.rows.map(r => r.cells.a)).toEqual(["먼저", "나중"]) // 값은 그대로
  })

  it("행 id 를 인덱스로 채울 때 이미 쓰는 id 와 겹치지 않는다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [{ id: "row-1", cells: { a: "먼저" } }, { cells: { a: "나중" } }],
    }) as unknown as { rows: { id: string }[] }
    const ids = out.rows.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /**
   * ⚠️ **컨테이너가 배열이라고 원소가 성한 게 아니다.** `tags:[{}]` 를 온전하다고 통과시키면
   * `TagsBlock` 이 객체를 React 자식으로 그리다 죽어, 이 PR 이 막으려던 바로 그 에러 화면이 뜬다.
   */
  it("배열 안에 문자열 아닌 원소가 있으면 온전하다고 보지 않고 걸러 낸다", () => {
    expect(
      normalizeBlockValue("tags", { type: "tags", tags: ["좋음", { broken: true }] }),
    ).toMatchObject({ type: "tags", tags: ["좋음"] })

    expect(
      normalizeBlockValue("checklist", {
        type: "checklist",
        options: ["a", null],
        checked: ["a", { broken: true }],
      }),
    ).toMatchObject({ type: "checklist", options: ["a"], checked: ["a"] })
  })
})

/**
 * ⚠️ **컨테이너를 막았다고 잎이 막힌 게 아니다** (FRT-200 리뷰 3라운드). 값 하나가 몇 겹인지
 * 세지 않고 방어를 넣으면 매 라운드 한 겹씩 남는다 — 블록 → 셀 → 배열 원소 → 셀 안의 배열.
 */
describe("normalizeBlockValue — 잎까지 (FRT-200)", () => {
  it("파일의 선택 메타데이터가 깨져도 렌더가 부를 수 있는 모양으로 만든다", () => {
    const out = normalizeBlockValue("file", {
      type: "file",
      fileName: "증빙.pdf",
      description: "",
      evidenceType: "",
      mimeType: { broken: true },
      url: 12,
    }) as unknown as { fileName: string; mimeType?: unknown; url?: unknown }
    expect(out.fileName).toBe("증빙.pdf") // 살아 있는 값은 지킨다
    expect(typeof out.mimeType === "string" || out.mimeType === undefined).toBe(true)
    expect(typeof out.url === "string" || out.url === undefined).toBe(true)
  })

  /**
   * ⚠️ 셀을 채워 두면 `rowHasContent` 의 `||` 가 앞에서 끝나 **부가 항목에 닿지도 않는다**
   * (실제로 그렇게 써서 위양성으로 통과했다). 셀을 비워 두 번째 항을 반드시 평가하게 한다.
   */
  it("행의 부가 항목이 깨져도 행 판정이 죽지 않는다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [{ key: "item", label: "활동", blockType: "text" }],
      rows: [{ id: "r1", cells: {}, extraFields: [null], roleTags: [{ x: 1 }] }],
    }) as unknown as { rows: Parameters<typeof rowHasContent>[0][] }
    expect(() => rowHasContent(out.rows[0])).not.toThrow()
    expect(rowHasContent(out.rows[0])).toBe(false)
  })

  it("셀 안의 배열에 문자열 아닌 원소가 있으면 걸러 낸다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [{ key: "skills", label: "역량", blockType: "tags" }],
      rows: [{ id: "r1", cells: { skills: ["협업", { broken: true }] } }],
    }) as unknown as { rows: { cells: { skills: unknown } }[] }
    expect(out.rows[0].cells.skills).toEqual(["협업"])
  })

  /** 열 정의는 `key` 만이 아니라 **렌더러가 읽는 필드 전부**가 성해야 한다. */
  it("열 정의의 라벨·선택지가 깨져 있으면 그것도 맞춘다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [
        { key: "item", label: { broken: true }, blockType: "text" },
        { key: "sel", label: "선택", blockType: "checklist", options: ["정상", { broken: true }] },
      ],
      rows: [],
    }) as unknown as { columns: { key: string; label: unknown; options?: unknown }[] }
    expect(typeof out.columns[0].label).toBe("string")
    expect(out.columns[1].options).toEqual(["정상"])
  })

  /** 열 `key` 가 겹치면 둘이 같은 셀을 가리키고, 하나를 지우면 둘 다 사라진다. */
  it("열 key 가 중복이면 뒤엣것을 갈아 준다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [
        { key: "item", label: "A", blockType: "text" },
        { key: "item", label: "B", blockType: "text" },
      ],
      rows: [],
    }) as unknown as { columns: { key: string }[] }
    expect(new Set(out.columns.map(c => c.key)).size).toBe(2)
  })

  /**
   * ⚠️ 열 `key` 를 갈면 **그 열이 가리키던 셀도 같이 옮겨야** 한다. 이름표만 바꾸면 값은
   * 옛 이름 아래 남고 렌더러는 새 이름으로 찾아 — 저장된 값이 화면에서 사라진다.
   */
  it("열 key 를 갈면 그 열이 쓰던 셀도 함께 옮긴다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [{ key: 5, label: "숫자키", blockType: "text" }],
      rows: [{ id: "r1", cells: { "5": "저장된 값" } }],
    }) as unknown as { columns: { key: string }[]; rows: { cells: Record<string, unknown> }[] }
    const key = out.columns[0].key
    expect(out.rows[0].cells[key]).toBe("저장된 값")
  })

  /**
   * ⚠️ 중복 key 를 갈 때는 **앞엣것이 그 이름을 지킨다** — 셀도 앞 열에 남아야 한다.
   * 옛→새 표를 그대로 적용하면 하나뿐인 값이 **뒤 열로 옮겨가** 소유자가 바뀐다.
   */
  it("중복 열 key 를 갈아도 셀은 이름을 지킨 앞 열에 남는다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [
        { key: "item", label: "A", blockType: "text" },
        { key: "item", label: "B", blockType: "text" },
      ],
      rows: [{ id: "r1", cells: { item: "저장된 값" } }],
    }) as unknown as { columns: { key: string }[]; rows: { cells: Record<string, unknown> }[] }
    expect(out.columns[0].key).toBe("item")
    expect(out.rows[0].cells.item).toBe("저장된 값")
  })

  /** 깨진 key 가 여럿이어도 셀 소유권은 **첫 열**에 남아야 한다(뒤엣것이 표를 덮어쓰면 안 된다). */
  it("깨진 열 key 가 중복이어도 셀은 첫 열에 남는다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [
        { key: 5, label: "A", blockType: "text" },
        { key: 5, label: "B", blockType: "text" },
      ],
      rows: [{ id: "r1", cells: { "5": "저장된 값" } }],
    }) as unknown as { columns: { key: string }[]; rows: { cells: Record<string, unknown> }[] }
    expect(out.rows[0].cells[out.columns[0].key]).toBe("저장된 값")
  })

  /**
   * ⚠️ 열이 **이 코드가 모르는 유형**이면 그 칸의 값도 모르는 게 당연하다 — 빈 문자열로 갈면
   * 열었다 저장하는 것만으로 새 스키마가 쓴 잎 값이 사라진다. 그리는 컨트롤도 없으니 안전하다.
   */
  it("모르는 유형의 열에 실린 불투명 셀은 그대로 지킨다", () => {
    const cell = { type: "rating-v3", value: 5 }
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [{ key: "score", label: "평점", blockType: "rating-v3" }],
      // ⚠️ `id` 를 일부러 비워 **보정 경로를 지나게** 한다. 온전한 값으로 쓰면 fast-path 로
      //    빠져 `repairCell` 에 닿지도 않고 통과한다(실제로 그렇게 썼다가 잡았다).
      rows: [{ cells: { score: cell } }],
    }) as unknown as { rows: Parameters<typeof rowHasContent>[0][] }
    expect((out.rows[0] as unknown as { cells: Record<string, unknown> }).cells.score).toEqual(cell)
    // 그 행은 "비어 있음"이 아니어야 한다 — 비었다고 보면 버림 판정에서 사라진다.
    expect(rowHasContent(out.rows[0])).toBe(true)
  })

  it("부가 항목 key 가 성했더라도 서로 겹치면 갈아 준다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [
        {
          id: "r1",
          cells: {},
          extraFields: [
            { key: "k", label: "A", blockType: "text", value: "가" },
            { key: "k", label: "B", blockType: "text", value: "나" },
          ],
        },
      ],
    }) as unknown as { rows: { extraFields: { key: string }[] }[] }
    expect(new Set(out.rows[0].extraFields.map(f => f.key)).size).toBe(2)
  })

  it("행 부가 항목의 key 가 겹치면 결정적으로 갈아 준다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [
        {
          id: "r1",
          cells: {},
          extraFields: [
            { label: "A", blockType: "text", value: "가" },
            { label: "B", blockType: "text", value: "나" },
          ],
        },
      ],
    }) as unknown as { rows: { extraFields: { key: string }[] }[] }
    const keys = out.rows[0].extraFields.map(f => f.key)
    expect(new Set(keys).size).toBe(2)
  })

  /** 숫자 id 로 이어진 링크는 **양쪽을 같은 방식으로** 다뤄야 살아남는다. */
  it("숫자 행 id 와 그걸 가리키는 링크를 함께 문자열로 맞춘다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [
        { id: 5, cells: { a: "대상" } },
        { id: 6, cells: { a: "출처" }, linkedProjectRowId: 5 },
      ],
    }) as unknown as { rows: { id: string; linkedProjectRowId?: string }[] }
    expect(out.rows[1].linkedProjectRowId).toBe(out.rows[0].id)
  })

  /** 폴백 값을 만들 때 쓰는 선택지 목록도 저장분이다 — 위생을 거치지 않으면 그대로 실린다. */
  it("폴백 값을 만들 때도 선택지 목록을 걸러 낸다", () => {
    const out = normalizeBlockValue("checklist", null, {
      options: ["정상", { broken: true }] as unknown as string[],
    }) as unknown as { options: unknown[] }
    expect(out.options).toEqual(["정상"])
  })

  /** `RowExtraField.value` 는 문자열·문자열 배열만이다 — 파일 셀 객체는 그대로 그려지면 죽는다. */
  it("행 부가 항목에 파일 셀 객체가 들어 있으면 글자로 바꾼다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [
        {
          id: "r1",
          cells: {},
          extraFields: [
            {
              key: "k",
              label: "증빙",
              blockType: "text",
              value: { type: "file", fileId: "f1", fileName: "증빙.pdf" },
            },
          ],
        },
      ],
    }) as unknown as { rows: { extraFields: { value: unknown }[] }[] }
    const value = out.rows[0].extraFields[0].value
    expect(typeof value === "string" || Array.isArray(value)).toBe(true)
  })

  /** 행 부가 항목도 `value` 만이 아니라 라벨까지 — 편집 모드가 `label.trim()` 을 부른다. */
  it("행 부가 항목의 라벨이 깨져 있으면 그것도 맞춘다", () => {
    const out = normalizeBlockValue("repeatable-cell", {
      type: "repeatable-cell",
      columns: [],
      rows: [
        {
          id: "r1",
          cells: {},
          extraFields: [{ key: "k", label: { broken: true }, blockType: "text", value: "x" }],
        },
      ],
    }) as unknown as { rows: { extraFields: { label: unknown; value: unknown }[] }[] }
    expect(typeof out.rows[0].extraFields[0].label).toBe("string")
    expect(out.rows[0].extraFields[0].value).toBe("x") // 값은 그대로
  })

  it("되살릴 선택지 목록 자체가 깨져 있으면 그것도 걸러 낸다", () => {
    const out = normalizeBlockValue(
      "checklist",
      { type: "checklist", checked: [] },
      { options: ["정상", { broken: true }] as unknown as string[] },
    ) as unknown as { options: unknown[] }
    expect(out.options).toEqual(["정상"])
  })
})

/**
 * 블록이 선언한 타입과 값이 든 타입이 **둘 다 아는 타입인데 서로 다를 때**, 렌더러는
 * `block.type` 으로 컨트롤을 고르므로 값이 그 모양이 아니면 그 자리에서 죽는다.
 */
/**
 * 값(`block.value`)만이 아니라 **블록 자신의 필드**도 저장 JSONB 에서 온다 — `block.options` 는
 * `SingleSelectBlock`·`FileBlock` 이 직접 읽고, `children`·`id` 는 목록·핸들러가 직접 쓴다.
 */
describe("normalizeBlock/Blocks — 블록 자신의 필드 (FRT-200)", () => {
  it("블록 층위 options 가 깨져 있으면 블록에서도 맞춘다", () => {
    const normalized = normalizeBlock({
      id: "b1",
      type: "single-select",
      label: "칸",
      options: ["정상", { broken: true }] as unknown as string[],
      value: { type: "single-select", options: [], selected: "" },
    })
    expect(normalized.options).toEqual(["정상"])

    const notArray = normalizeBlock({
      id: "b2",
      type: "single-select",
      label: "칸",
      options: { broken: true } as unknown as string[],
      value: { type: "single-select", options: [], selected: "" },
    })
    expect(Array.isArray(notArray.options)).toBe(true)
  })

  /** `TextBlock:17` 은 `block.label` 을 React 자식으로 그대로 그린다 — 객체면 그 자리에서 죽는다. */
  it("블록 층위 표시 문자열이 깨져 있으면 블록에서도 맞춘다", () => {
    const normalized = normalizeBlock({
      id: "b1",
      type: "text",
      label: { broken: true } as unknown as string,
      placeholder: { broken: true } as unknown as string,
      guide: { broken: true } as unknown as string,
      value: { type: "text", text: "값" },
    })
    expect(typeof normalized.label).toBe("string")
    expect(normalized.placeholder === undefined || typeof normalized.placeholder === "string").toBe(true)
    expect(normalized.guide === undefined || typeof normalized.guide === "string").toBe(true)
  })

  /**
   * ⚠️ `null` 은 "빈 목록"이 아니라 **정의가 없다**는 뜻이다. `[]` 로 굳히면 나중 템플릿 복원이
   * "사용자가 다 지웠다"로 읽어(빈 배열은 truthy) 증빙 드롭다운이 통째로 사라진다.
   */
  it("options 가 null 이면 빈 배열로 굳히지 않는다 (복원 여지를 남긴다)", () => {
    const normalized = normalizeBlock({
      id: "b1",
      type: "file",
      label: "증빙",
      options: null as unknown as string[],
      value: { type: "file", fileName: "", description: "", evidenceType: "" },
    })
    expect(Array.isArray(normalized.options)).toBe(false)
  })

  it("children 이 배열이 아니거나 원소가 깨져 있어도 죽지 않는다", () => {
    const group = {
      id: "g1",
      type: "group",
      label: "섹션",
      value: { type: "group" },
      children: { broken: true },
    } as unknown as Block
    expect(() => normalizeBlock(group)).not.toThrow()

    const withNull = {
      id: "g2",
      type: "group",
      label: "섹션",
      value: { type: "group" },
      children: [null, { id: "c1", type: "text", label: "칸", value: { type: "text", text: "값" } }],
    } as unknown as Block
    expect(() => normalizeBlock(withNull)).not.toThrow()
    expect(normalizeBlock(withNull).children).toHaveLength(1)
  })

  /** 블록 id 는 목록의 수정·삭제 핸들러가 블록을 찾는 열쇠다 — 겹치면 둘이 함께 바뀐다. */
  it("블록 id 가 없거나 겹치면 결정적으로 갈아 준다", () => {
    const out = normalizeBlocks([
      { id: "b1", type: "text", label: "A", value: { type: "text", text: "가" } },
      { id: "b1", type: "text", label: "B", value: { type: "text", text: "나" } },
      { type: "text", label: "C", value: { type: "text", text: "다" } } as unknown as Block,
    ])
    expect(new Set(out.map(b => b.id)).size).toBe(3)
    expect(out.map(b => (b.value as { text: string }).text)).toEqual(["가", "나", "다"])
  })
})

describe("normalizeBlock — 타입 불일치 (FRT-200)", () => {
  /**
   * ⚠️ **저장과 표시는 다른 질문이다.** 모르는 판별자는 저장 경로에선 그대로 지켜야 하지만
   * (구 프론트가 새 스키마 값을 굳히면 안 된다), 그리려면 컨트롤이 읽을 모양이 필요하다.
   * 그래서 갈아 끼우는 건 **렌더 관문에서만** 한다 — 그 결과는 저장되지 않는다.
   */
  it("모르는 판별자는 보정에선 지키고, 렌더 관문에서만 그릴 모양으로 바꾼다", () => {
    const block: Block = {
      id: "b1",
      type: "text",
      label: "칸",
      value: { type: "brand-new-in-v3", text: "새 스키마" } as unknown as BlockValue,
    }
    expect(normalizeBlock(block).value).toBe(block.value) // 저장 경로: 그대로
    expect(normalizeBlockForRender(block).value.type).toBe("text") // 표시 경로: 그릴 모양
  })

  it("블록 타입과 값 타입이 어긋나면 블록 타입의 모양으로 맞춘다", () => {
    const normalized = normalizeBlock({
      id: "b1",
      type: "repeatable-cell",
      label: "성과",
      value: { type: "text", text: "엉뚱한 값" } as unknown as BlockValue,
    })
    const value = normalized.value as unknown as { type: string; columns: unknown[]; rows: unknown[] }
    expect(value.type).toBe("repeatable-cell")
    expect(Array.isArray(value.columns)).toBe(true)
    expect(Array.isArray(value.rows)).toBe(true)
  })
})

/**
 * "그릴 게 없다"와 "버려도 된다"는 **다른 질문이다** (FRT-200 리뷰). 모르는 타입은 그릴 수는
 * 없지만, 버리면 저장 왕복에서 그 키가 통째로 사라진다 — 새 스키마가 쓴 값을 구 프론트가 지운다.
 */
describe("isBlockDiscardable — 모르는 타입 (FRT-200)", () => {
  const blockWith = (value: unknown): Block =>
    ({ id: "b1", type: "text", label: "칸", value }) as unknown as Block

  it("이 코드가 모르는 type 의 값은 버리지 않는다", () => {
    const block = blockWith({ type: "brand-new-in-v3", payload: "미래 스키마" })
    expect(isBlockEmpty(block)).toBe(true) // 그릴 것은 없다
    expect(isBlockDiscardable(block)).toBe(false) // 그렇다고 버려도 되는 건 아니다
  })

  it("아는 타입의 빈 값은 종전대로 버린다", () => {
    expect(isBlockDiscardable(blockWith({ type: "text", text: "" }))).toBe(true)
    expect(isBlockDiscardable(blockWith({ type: "text", text: "값" }))).toBe(false)
  })

  /** 값에 판별자가 없어도 **블록 타입 자체가 미지**면 그건 새 스키마의 흔적이다 — 버리면 안 된다. */
  it("블록 타입이 미지이고 값이 불투명하면 버리지 않는다", () => {
    const block = {
      id: "b1",
      type: "brand-new-in-v3",
      label: "새 칸",
      value: { payload: "미래 스키마" },
    } as unknown as Block
    expect(isBlockDiscardable(block)).toBe(false)
  })

  /** 그룹은 자식이 정보다 — 모르는 타입의 자식을 담은 섹션을 버리면 그 값이 통째로 사라진다. */
  it("모르는 타입의 자식을 담은 group 은 버리지 않는다", () => {
    const group: Block = {
      id: "g1",
      type: "group",
      label: "사용자 섹션",
      value: { type: "group" },
      children: [
        { id: "c1", type: "text", label: "빈 칸", value: { type: "text", text: "" } },
        blockWith({ type: "brand-new-in-v3", payload: "미래 스키마" }),
      ],
    }
    expect(isBlockEmpty(group)).toBe(true) // 그릴 것은 없다
    expect(isBlockDiscardable(group)).toBe(false) // 그렇다고 섹션째 지우면 안 된다
  })
})

describe("행·셀 판정 — 손상된 값 (FRT-200)", () => {
  /**
   * ⚠️ 이 판정은 **보정 전 원본**에도 돈다 — `orphanFieldsToBlocks` 가 소비 안 된 필드 값을
   * 날것으로 `isBlockDiscardable` 에 넘긴다. 여기서 던지면 정규화가 손쓸 새도 없이 화면이 죽는다.
   */
  it("부가 항목이 배열이 아니거나 원소가 깨져 있어도 던지지 않는다", () => {
    const notArray = { id: "r1", cells: {}, extraFields: { broken: true } }
    const withNull = { id: "r2", cells: {}, extraFields: [null] }
    type Row = Parameters<typeof rowHasContent>[0]
    expect(() => rowHasContent(notArray as unknown as Row)).not.toThrow()
    expect(() => rowHasContent(withNull as unknown as Row)).not.toThrow()
    expect(rowHasContent(withNull as unknown as Row)).toBe(false)
  })

  it("cells 가 없는 행도 죽지 않는다", () => {
    expect(() => rowHasContent({ id: "r1" } as unknown as Parameters<typeof rowHasContent>[0])).not.toThrow()
    expect(rowHasContent({ id: "r1" } as unknown as Parameters<typeof rowHasContent>[0])).toBe(false)
  })

  it("null 셀은 빈 셀로 본다", () => {
    expect(() => cellFilled(null as unknown as CellValue)).not.toThrow()
    expect(cellFilled(null as unknown as CellValue)).toBe(false)
    expect(cellText(null as unknown as CellValue)).toBe("")
  })

  /**
   * 셀 **안쪽**도 깨진다. `isFileCellValue` 는 `type` 만 보고 통과시키므로 `fileId` 가 없으면
   * 그 다음 줄 `cell.fileId.trim()` 에서 죽는다 — 블록 층위만 막고 셀 층위를 빠뜨린 자리다.
   */
  it("파일 셀의 fileId·fileName 이 결측이어도 죽지 않는다", () => {
    const brokenId = { type: "file", fileId: null, fileName: "보고서.pdf" } as unknown as CellValue
    expect(() => cellFilled(brokenId)).not.toThrow()
    expect(cellFilled(brokenId)).toBe(false)
    expect(() => cellText(brokenId)).not.toThrow()
    expect(cellText(brokenId)).toBe("")

    const brokenName = { type: "file", fileId: "f-1" } as unknown as CellValue
    expect(cellFilled(brokenName)).toBe(true)
    // 파일명이 없어도 첨부했다는 사실은 남긴다(기존 대체 문구 규칙과 같은 기준).
    expect(cellText(brokenName)).toBe("첨부파일")
  })

  it("파일 셀이 깨진 행도 판정이 죽지 않는다", () => {
    const row = {
      id: "r1",
      cells: { 결과물: { type: "file", fileId: null, fileName: "x" } },
    } as unknown as Parameters<typeof rowHasContent>[0]
    expect(() => rowHasContent(row)).not.toThrow()
    expect(rowHasContent(row)).toBe(false)
  })
})

describe("normalizeBlock — 템플릿 선택지 되살리기 (FRT-200)", () => {
  /**
   * `options` 는 사용자가 고른 값이 아니라 **템플릿이 주는 선택지**다. 결측이라고 `[]` 로 두면
   * `ChecklistBlock` 은 `val.options` 를 그대로 그리므로(형제 `SingleSelectBlock` 과 달리
   * `block.options` 폴백이 없다) 체크박스가 하나도 없는 칸이 되어, 이미 고른 값을 **끌 수도
   * 없다.** 블록이 선택지를 알고 있으면 그것으로 되살린다.
   */
  it("checklist 선택지가 결측이면 블록이 아는 선택지로 되살리고 고른 값은 지킨다", () => {
    const block = createChecklistField("분위기", ["뿌듯함", "아쉬움"])
    const normalized = normalizeBlock({
      ...block,
      value: { type: "checklist", checked: ["뿌듯함"] } as unknown as BlockValue,
    })
    expect(normalized.value).toMatchObject({
      type: "checklist",
      options: ["뿌듯함", "아쉬움"],
      checked: ["뿌듯함"],
    })
  })

  it("single-select 도 같은 기준으로 선택지를 되살린다", () => {
    const block = createSelectField("근무 형태", ["정규직", "인턴"])
    const normalized = normalizeBlock({
      ...block,
      value: { type: "single-select", selected: "인턴" } as unknown as BlockValue,
    })
    expect(normalized.value).toMatchObject({
      type: "single-select",
      options: ["정규직", "인턴"],
      selected: "인턴",
    })
  })

  it("블록도 선택지를 모르면 빈 목록으로 둔다 — 없는 선택지를 지어내지 않는다", () => {
    const normalized = normalizeBlock({
      id: "b1",
      type: "checklist",
      label: "선택지 없는 칸",
      value: { type: "checklist", checked: ["직접 쓴 값"] } as unknown as BlockValue,
    })
    expect(normalized.value).toMatchObject({ options: [], checked: ["직접 쓴 값"] })
  })
})
