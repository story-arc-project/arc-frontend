import { describe, it, expect } from "vitest"
import { humanizeRawFieldNotation } from "@/lib/utils/humanize-raw-field"

/**
 * FRT-316 회귀 그물.
 *
 * 사용자가 실제로 본 두 문자열(노션 피드백 스크린샷)을 그대로 못 박는다.
 * 이 값들은 백엔드가 경험 content(schema v2)를 `json.dumps` 로 통째 덤프해 LLM 에 넣고,
 * 프롬프트가 "입력 텍스트에서 직접 인용하라"고 지시해서 생긴 것이다(BAC-66).
 */
describe("humanizeRawFieldNotation — 사용자가 실제로 본 문자열", () => {
  it("content 최상위 tags 배열 표기를 사람이 읽는 문장으로 되돌린다", () => {
    const raw = 'tags: ["미술사", "소논문", "17세기 스페인 회화", "무리요"]'
    expect(humanizeRawFieldNotation(raw)).toBe("태그: 미술사, 소논문, 17세기 스페인 회화, 무리요")
  })

  it("fields 안정키(`sectionId.라벨`)와 기간 객체 표기를 되돌린다", () => {
    const raw = 'research-paper.연구 기간: {"start": "2024-10", "end": "2024-12"}'
    expect(humanizeRawFieldNotation(raw)).toBe("연구 기간: 2024-10 ~ 2024-12")
  })
})

/**
 * ⚠️ 이 함수는 **분석 본문 전체**를 지나간다(`asString`). 그래서 "무엇을 바꾸는가"보다
 * "무엇을 절대 건드리지 않는가"가 더 중요하다 — 정상 문장을 훼손하면 값 유실이다.
 */
describe("humanizeRawFieldNotation — 건드리면 안 되는 것", () => {
  it("콜론이 있어도 JSON 리터럴이 아니면 원문 그대로다", () => {
    const raw = "근거: 지원 직무와의 연결고리가 드러나지 않습니다."
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })

  it("URL 의 `https:` 를 필드 표기로 오인하지 않는다", () => {
    const raw = "참고: https://example.com/report 를 확인하세요."
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })

  it("서술 문장 안에 필드명이 언급된 경우도 그대로 둔다", () => {
    const raw = "tags 필드에 직무 관련 키워드가 없습니다."
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })

  it("JSON 파싱에 실패하면 원문을 보존한다 — 지어내지 않는다", () => {
    const raw = 'tags: ["미술사", "소논문'
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })

  it("빈 문자열·공백은 그대로 통과한다", () => {
    expect(humanizeRawFieldNotation("")).toBe("")
    expect(humanizeRawFieldNotation("   ")).toBe("   ")
  })

  it("일반 산문은 여러 줄이어도 그대로다", () => {
    const raw = "미술사 연구는 특정 분야 외의\n일반적인 산업 직무와 연결고리가 약합니다."
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })
})

describe("humanizeRawFieldNotation — 값 모양별 렌더", () => {
  it("문자열 배열은 쉼표로 잇는다", () => {
    expect(humanizeRawFieldNotation('skills: ["Python", "PyTorch"]')).toBe("skills: Python, PyTorch")
  })

  it("빈 배열은 값이 없으므로 원문을 유지한다", () => {
    const raw = "tags: []"
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })

  it("BlockValue 의 내부 태그(`type`)는 화면에 내보내지 않는다", () => {
    const raw = 'core.한 줄 요약: {"type": "text", "text": "17세기 스페인 회화를 분석했다"}'
    expect(humanizeRawFieldNotation(raw)).toBe("한 줄 요약: 17세기 스페인 회화를 분석했다")
  })

  it("진행 중인 기간(`isCurrent`)은 '현재'로 읽는다", () => {
    const raw = 'core.기간: {"type": "period", "start": "2024-10", "end": "", "isCurrent": true}'
    expect(humanizeRawFieldNotation(raw)).toBe("기간: 2024-10 ~ 현재")
  })

  it("끝만 있는 기간도 읽을 수 있게 낸다", () => {
    expect(humanizeRawFieldNotation('core.기간: {"end": "2024-12"}')).toBe("기간: ~ 2024-12")
  })

  it("태그 블록 값은 태그 목록만 낸다", () => {
    const raw = 'core.성과: {"type": "tags", "tags": ["장려상", "우수리포트"]}'
    expect(humanizeRawFieldNotation(raw)).toBe("성과: 장려상, 우수리포트")
  })

  it("체크리스트는 선택된 것만 낸다 — 선택지 목록은 값이 아니다", () => {
    const raw = 'core.역할: {"type": "checklist", "options": ["기획", "개발", "디자인"], "checked": ["기획"]}'
    expect(humanizeRawFieldNotation(raw)).toBe("역할: 기획")
  })

  it("대표 키가 없는 객체는 남은 항목을 라벨과 함께 낸다", () => {
    const raw = 'core.링크: {"url": "https://a.b", "title": "발표자료"}'
    expect(humanizeRawFieldNotation(raw)).toBe("링크: https://a.b")
  })

  it("표(행 배열)는 행마다 셀을 이어 낸다", () => {
    const raw = 'core.수상: [{"대회": "공모전", "성과": "장려상"}, {"대회": "학회", "성과": "발표"}]'
    expect(humanizeRawFieldNotation(raw)).toBe("수상: 대회: 공모전, 성과: 장려상 / 대회: 학회, 성과: 발표")
  })

  it("모든 값이 비어 있으면 지어내지 않고 원문을 남긴다", () => {
    const raw = 'core.기간: {"type": "period", "start": "", "end": "", "isCurrent": false}'
    expect(humanizeRawFieldNotation(raw)).toBe(raw)
  })
})

describe("humanizeRawFieldNotation — 문장 안에 섞여 온 경우", () => {
  it("여러 줄 중 표기가 있는 줄만 바꾸고 나머지 줄은 보존한다", () => {
    const raw = [
      "이 경험의 태그 구성이 직무와 어긋납니다.",
      'tags: ["미술사", "소논문"]',
      "따라서 연결고리를 보강해야 합니다.",
    ].join("\n")
    expect(humanizeRawFieldNotation(raw)).toBe(
      [
        "이 경험의 태그 구성이 직무와 어긋납니다.",
        "태그: 미술사, 소논문",
        "따라서 연결고리를 보강해야 합니다.",
      ].join("\n"),
    )
  })

  it("줄 앞뒤 여백이 있어도 표기를 알아본다", () => {
    expect(humanizeRawFieldNotation('  tags: ["미술사"]  ')).toBe("태그: 미술사")
  })
})
