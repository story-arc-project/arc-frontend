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
  isBlockEmpty,
  validateRequiredBlocks,
} from "@/lib/utils/block-utils"
import type { FileCellValue } from "@/types/archive"

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
