/**
 * AI 분석 본문에 섞여 들어온 **저장 필드 표기**를 사람이 읽는 문장으로 되돌린다 (FRT-316).
 *
 * ## 왜 필요한가
 *
 * 근본 원인은 프론트가 아니라 백엔드다(BAC-66). 백엔드는 경험 content(schema v2)를
 * 사람이 읽는 텍스트로 렌더링하지 않고 `json.dumps` 로 통째 덤프해 LLM 에 넣는데,
 * 프롬프트는 "입력 텍스트에서 직접 인용하라"고 지시한다. 그래서 LLM 이 인용할 수 있는
 * 것은 JSON 조각뿐이고, `근거` 자리에 아래 같은 문자열이 그대로 온다:
 *
 *   tags: ["미술사", "소논문", "17세기 스페인 회화", "무리요"]
 *   research-paper.연구 기간: {"start": "2024-10", "end": "2024-12"}
 *
 * 두 형태 모두 저장 구조와 정확히 대응한다 — `tags` 는 content 최상위 키,
 * `research-paper.연구 기간` 은 `fields` 의 안정키 `${sectionId}.${label}` 이다.
 * 안정키의 `.` 뒤가 이미 사람이 읽는 라벨이라, 라벨 사전 없이도 대부분 복원된다.
 *
 * ## 설계 원칙 — 바꾸는 것보다 안 건드리는 것이 중요하다
 *
 * 이 함수는 분석 본문 **전체**를 지나간다. 그래서 판정을 좁게 잡는다:
 * **값이 JSON 리터럴(`[...]` / `{...}`)이고 파싱에 성공한 줄만** 손댄다.
 * 콜론이 들어간 정상 문장(`근거: 연결고리가 약합니다`)이나 URL 은 값이 리터럴이 아니므로
 * 애초에 걸리지 않는다. 파싱에 실패하거나 읽어낼 값이 없으면 **원문을 그대로 남긴다** —
 * 읽기 어려운 것보다 나쁜 것은 없는 내용을 지어내는 것이다.
 *
 * ⚠️ LLM 이 값을 그대로 복사하지 않고 재구성한 흔적이 있다(실제 저장값에 있는 `type`·
 * `isCurrent` 가 인용문에는 빠져 있었다). 따라서 BlockValue 스키마를 전제하지 않고,
 * 있으면 활용하되 없어도 동작하는 관대한 파싱으로 둔다.
 */

/** content 최상위 키는 안정키와 달리 라벨을 안 달고 오므로 이것만 사전을 둔다. */
const TOP_LEVEL_LABELS: Record<string, string> = {
  tags: "태그",
  title: "제목",
  summary: "한 줄 요약",
  status: "상태",
}

/**
 * BlockValue 에서 "그 블록의 값"에 해당하는 키. 앞에 있는 것이 우선한다.
 * 예: checklist 는 `options`(선택지 목록)가 아니라 `checked`(고른 것)가 값이다.
 */
const PRIMARY_VALUE_KEYS = [
  "text",
  "tags",
  "checked",
  "selected",
  "date",
  "url",
  "fileName",
  "rows",
  "items",
] as const

/**
 * 값이 아니라 렌더 힌트·내부 태그인 키 — 화면에 내보내지 않는다.
 *
 * ⚠️ 여기 넣어도 되는 것은 **사용자가 쓴 값이 아닌 것**뿐이다. 입력 컨트롤이 있는 키를
 * 넣으면 근거에서 조용히 사라진다 — `linkType`·`evidenceType` 이 그렇게 들어와 있었다
 * (`LinkBlock.tsx` · `FileBlock.tsx` 둘 다 사용자가 고르는 select 다).
 * 그리고 이 집합은 **BlockValue 층위에서만** 뜻이 있다. 행의 `cells` 안쪽은 템플릿이 정한
 * 사용자 컬럼이라 이름이 겹쳐도(`type` 컬럼을 둔 템플릿이 4종) 값이다.
 */
const INTERNAL_KEYS = new Set([
  "type",
  "isCurrent",
  "options",
  "fileId",
  "mimeType",
  "size",
  "variant",
  "blockType",
  "key",
  "id",
  "required",
  "placeholder",
  "guide",
  "columns",
  "schema_version",
  "template_version",
])

/**
 * 기간을 이루는 키. **이 키가 있다고 그 객체가 기간인 것은 아니다** — repeatable-cell 의
 * 행(`createRoleHistory` 는 `start`·`end`·`role` 3열)은 기간 키를 포함한 셀 묶음이다.
 * 기간으로 읽되 형제 셀은 남긴다.
 */
const PERIOD_KEYS = new Set(["start", "end"])

/** 값을 감싸기만 하는 키 — 라벨로 내보내지 않고 안쪽을 그대로 편다(행의 `cells`). */
const WRAPPER_KEYS = new Set(["cells"])

/** `<키>: <JSON 리터럴>` 로만 이루어진 줄. 값이 리터럴이 아니면 걸리지 않는다. */
const FIELD_LINE = /^\s*([^\s:][^:]*?)\s*:\s*(\[[\s\S]*\]|\{[\s\S]*\})\s*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * 안정키 `${sectionId}.${label}` 의 라벨 조각을 취한다. 최상위 키는 사전으로 옮긴다.
 *
 * **첫 점**에서 가른다. sectionId 는 점 없는 케밥 슬러그지만(`templates-v2.ts`) 라벨에는
 * 점이 올 수 있어서, 마지막 점에서 가르면 라벨이 잘린다(`평점(4.5 만점)` → `5 만점)`).
 */
function labelOf(rawKey: string): string {
  const trimmed = rawKey.trim()
  const dot = trimmed.indexOf(".")
  const tail = dot >= 0 ? trimmed.slice(dot + 1) : trimmed
  return TOP_LEVEL_LABELS[tail] ?? tail
}

/** 기간 객체(`start`/`end`)를 `시작 ~ 종료` 로. 진행 중이면 종료를 '현재'로 읽는다. */
function renderPeriod(value: Record<string, unknown>): string {
  const start = renderValue(value.start)
  const end = value.isCurrent === true ? "현재" : renderValue(value.end)
  if (!start && !end) return ""
  return `${start} ~ ${end}`.trim()
}

/**
 * 남은 항목을 라벨과 함께 낸다(표의 행 등). `skip` 은 이미 다른 방식으로 낸 키다.
 * `isCells` 면 내부 키 필터를 끈다 — 셀 키는 템플릿이 정한 사용자 컬럼이다.
 */
function renderEntries(
  value: Record<string, unknown>,
  skip?: ReadonlySet<string>,
  isCells = false,
): string {
  return Object.entries(value)
    .filter(([key]) => !skip?.has(key) && (isCells || !INTERNAL_KEYS.has(key)))
    .map(([key, entry]) => {
      // `cells` 는 값을 감싸기만 하는 껍데기다. 안쪽은 BlockValue 가 아니라 행의 셀이므로
      // 대표 키·내부 키 규칙을 적용하지 않고 편다.
      if (WRAPPER_KEYS.has(key) && isRecord(entry)) return renderObject(entry, true)
      const rendered = renderValue(entry)
      return rendered ? `${labelOf(key)}: ${rendered}` : ""
    })
    .filter(Boolean)
    .join(", ")
}

function renderObject(value: Record<string, unknown>, isCells = false): string {
  // 기간으로 읽되 **형제 값은 버리지 않는다** — 조용히 사라지는 값이 읽기 어려운 값보다 나쁘다.
  if ("start" in value || "end" in value) {
    const rest = renderEntries(value, PERIOD_KEYS, isCells)
    return [renderPeriod(value), rest].filter(Boolean).join(", ")
  }

  // 대표 키는 "무엇이 이 블록의 값인가"를 고르는 장치지 형제를 버리는 장치가 아니다.
  // `LinkBlockValue`·`FileBlockValue` 는 대표 키 옆에 사용자가 쓴 값을 더 담는다.
  if (!isCells) {
    for (const key of PRIMARY_VALUE_KEYS) {
      if (!(key in value)) continue
      const primary = renderValue(value[key])
      if (!primary) continue
      return [primary, renderEntries(value, new Set([key]))].filter(Boolean).join(", ")
    }
  }

  return renderEntries(value, undefined, isCells)
}

function renderArray(value: unknown[]): string {
  const parts = value.map(renderValue).filter(Boolean)
  if (parts.length === 0) return ""
  // 원소가 객체(표의 행)면 항목 구분자가 겹치므로 행 사이를 다른 기호로 가른다.
  const separator = value.some(isRecord) ? " / " : ", "
  return parts.join(separator)
}

function renderValue(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return renderArray(value)
  if (isRecord(value)) return renderObject(value)
  return ""
}

function humanizeLine(line: string): string {
  const match = FIELD_LINE.exec(line)
  if (!match) return line

  const [, rawKey, rawValue] = match
  let parsed: unknown
  try {
    parsed = JSON.parse(rawValue)
  } catch {
    return line // 인용이 잘려 왔을 수 있다 — 못 읽으면 원문이 정답이다.
  }

  const rendered = renderValue(parsed)
  if (!rendered) return line // 읽어낼 값이 없으면 지어내지 않는다.

  return `${labelOf(rawKey)}: ${rendered}`
}

export function humanizeRawFieldNotation(text: string): string {
  // 리터럴이 없으면 손댈 줄도 없다 — 대부분의 문장이 여기서 빠진다.
  if (!text.includes(":")) return text
  if (!text.includes("[") && !text.includes("{")) return text
  return text.split("\n").map(humanizeLine).join("\n")
}
