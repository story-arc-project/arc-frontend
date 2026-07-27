import { describe, it, expect } from "vitest";
import { normalizeCoverLetter } from "./cover-letter-normalize";
import {
  hasUngroundedAnswer,
  isAllGrounded,
  isEmptyCoverLetter,
} from "@/types/cover-letter";

describe("normalizeCoverLetter", () => {
  it("정상 응답을 그대로 통과시킨다", () => {
    const res = normalizeCoverLetter({
      answers: [
        {
          question: "지원 동기",
          cover_letter: "본문입니다.",
          grounding: { grounded: true, unsupported_claims: [], notes: "통과" },
          writing_guide: "가이드",
        },
      ],
      company_research: "미션 요약",
      action_plan: "액션",
      meta: { job_label: "데이터 분석", region: "KR", all_grounded: true },
    });

    expect(res.answers[0].writing_guide).toBe("가이드");
    expect(res.company_research).toBe("미션 요약");
    expect(res.meta?.job_label).toBe("데이터 분석");
    expect(res.meta?.region).toBe("KR");
  });

  it("조건부 빈 문자열 필드는 키를 비워 화면이 섹션째 숨기게 한다", () => {
    const res = normalizeCoverLetter({
      answers: [
        {
          question: "Q",
          cover_letter: "본문",
          grounding: { grounded: true, unsupported_claims: [], notes: "" },
          writing_guide: "",
        },
      ],
      company_research: "",
      action_plan: "   ",
    });

    expect(res.answers[0].writing_guide).toBeUndefined();
    expect(res.company_research).toBeUndefined();
    expect(res.action_plan).toBeUndefined();
  });

  it("문항이 비면 '(자유 형식)'으로 채운다 — 빈 제목은 문항이 사라진 것처럼 보인다", () => {
    const res = normalizeCoverLetter({
      answers: [
        {
          question: "  ",
          cover_letter: "본문",
          grounding: { grounded: true, unsupported_claims: [], notes: "" },
        },
      ],
    });
    expect(res.answers[0].question).toBe("(자유 형식)");
  });

  it("answers 가 배열이 아니면 빈 목록으로 떨어진다(크래시 금지)", () => {
    expect(normalizeCoverLetter({ answers: null }).answers).toEqual([]);
    expect(normalizeCoverLetter(null).answers).toEqual([]);
    expect(normalizeCoverLetter("문자열").answers).toEqual([]);
  });

  it("본문도 문항도 없는 원소는 빈 카드를 만들지 않고 버린다", () => {
    const res = normalizeCoverLetter({
      answers: [null, {}, { question: "", cover_letter: "" }, { cover_letter: "살아남음" }],
    });
    expect(res.answers).toHaveLength(1);
    expect(res.answers[0].cover_letter).toBe("살아남음");
  });

  // ⚠️ 여기가 이 기능의 핵심 안전장치다 — 못 읽은 grounding 을 "통과"로 뭉개면
  // 근거 없는 초안이 "확인 완료"로 보인다.
  describe("grounding 은 읽을 수 없으면 경고 쪽으로 떨어진다", () => {
    it.each([
      ["부재", undefined],
      ["null", null],
      ["배열", []],
      ["문자열", "ok"],
      ["grounded 가 boolean 이 아님", { grounded: "true", unsupported_claims: [] }],
    ])("%s → grounded=false", (_label, grounding) => {
      const res = normalizeCoverLetter({
        answers: [{ question: "Q", cover_letter: "본문", grounding }],
      });
      expect(res.answers[0].grounding.grounded).toBe(false);
      expect(res.answers[0].grounding.unsupported_claims).toEqual([]);
    });

    // grounded 와 claims 는 검증 결과의 두 축이다. 한쪽만 읽고 통과를 살리면 **읽지도 못한
    // 검증이 "확인 완료"로 표시된다** — asStringArray 가 빈 배열을 만들어 "지적 사항 없음"과
    // 구분되지 않기 때문이다(codex P1).
    it.each([
      ["null", null],
      ["부재", undefined],
      ["객체", { 0: "주장" }],
      ["문자열", "주장 하나"],
    ])("grounded=true 인데 unsupported_claims 가 %s 이면 통과로 보지 않는다", (_l, claims) => {
      const res = normalizeCoverLetter({
        answers: [
          {
            question: "Q",
            cover_letter: "본문",
            grounding: { grounded: true, unsupported_claims: claims, notes: "" },
          },
        ],
      });
      expect(res.answers[0].grounding.grounded).toBe(false);
    });

    it("두 축을 모두 읽을 수 있으면 통과를 그대로 살린다", () => {
      const res = normalizeCoverLetter({
        answers: [
          {
            question: "Q",
            cover_letter: "본문",
            grounding: { grounded: true, unsupported_claims: [], notes: "통과" },
          },
        ],
      });
      expect(res.answers[0].grounding.grounded).toBe(true);
    });

    it("claims 의 비문자열·빈 문자열 원소는 걸러낸다", () => {
      const res = normalizeCoverLetter({
        answers: [
          {
            question: "Q",
            cover_letter: "본문",
            grounding: { grounded: false, unsupported_claims: ["진짜 주장", "", 42, null] },
          },
        ],
      });
      expect(res.answers[0].grounding.unsupported_claims).toEqual(["진짜 주장"]);
    });
  });

  describe("meta", () => {
    it("all_grounded 가 boolean 이 아니면 싣지 않는다(추측 금지)", () => {
      const res = normalizeCoverLetter({
        answers: [],
        meta: { all_grounded: "yes", job_label: "라벨" },
      });
      expect(res.meta?.all_grounded).toBeUndefined();
      expect(res.meta?.job_label).toBe("라벨");
    });

    it("meta 가 통째로 없거나 읽을 게 없으면 undefined", () => {
      expect(normalizeCoverLetter({ answers: [] }).meta).toBeUndefined();
      expect(normalizeCoverLetter({ answers: [], meta: {} }).meta).toBeUndefined();
      expect(normalizeCoverLetter({ answers: [], meta: [] }).meta).toBeUndefined();
    });

    it("알 수 없는 region 은 버린다", () => {
      expect(normalizeCoverLetter({ answers: [], meta: { region: "JP" } }).meta).toBeUndefined();
    });
  });
});

describe("isAllGrounded", () => {
  const grounded = {
    question: "Q",
    cover_letter: "본문",
    grounding: { grounded: true, unsupported_claims: [], notes: "" },
  };

  it("meta.all_grounded 가 정본이다", () => {
    expect(isAllGrounded({ answers: [grounded], meta: { all_grounded: false } })).toBe(false);
  });

  it("meta 가 없으면 answers 에서 파생한다", () => {
    expect(isAllGrounded({ answers: [grounded] })).toBe(true);
    expect(
      isAllGrounded({
        answers: [
          grounded,
          { ...grounded, grounding: { grounded: true, unsupported_claims: ["의심"], notes: "" } },
        ],
      }),
    ).toBe(false);
  });

  // 판단 근거가 없을 때 낙관하면 이 기능이 막으려던 실패가 그대로 일어난다.
  it("answers 가 비면 false — 판단 근거가 없으면 경고 쪽으로", () => {
    expect(isAllGrounded({ answers: [] })).toBe(false);
  });
});

describe("hasUngroundedAnswer / isEmptyCoverLetter", () => {
  it("grounded=false 면 claims 가 비어 있어도 경고다(파싱 실패 케이스)", () => {
    expect(
      hasUngroundedAnswer({
        answers: [
          {
            question: "Q",
            cover_letter: "본문",
            grounding: { grounded: false, unsupported_claims: [], notes: "파싱 실패" },
          },
        ],
      }),
    ).toBe(true);
  });

  it("본문이 전부 공백이면 빈 자소서다", () => {
    const g = { grounded: true, unsupported_claims: [], notes: "" };
    expect(isEmptyCoverLetter({ answers: [{ question: "Q", cover_letter: "  ", grounding: g }] })).toBe(true);
    expect(isEmptyCoverLetter({ answers: [{ question: "Q", cover_letter: "본문", grounding: g }] })).toBe(false);
  });
});
