import { describe, expect, it } from "vitest";

import { normalizeResumeVersion } from "./resume-normalize";
import type {
  Activity,
  Career,
  Club,
  Project,
  ResumeVersion,
  Skills,
} from "@/types/resume";

/**
 * FRT-157 — 백엔드가 항목형 배열(성과·활동내용·담당업무 …)을 빠뜨리면 화면이 죽는다.
 *
 * `types/resume.ts` 는 이 필드들을 필수 `string[]` 로 선언하지만 그 선언은 런타임 보증이
 * 아니다(`unwrapResumeVersion` 이 무검증 캐스팅을 한다). 그래서 "타입상 불가능한 값"을
 * 일부러 넣어 검증한다 — 실제 백엔드가 내는 모양이기 때문이다.
 */
const missing = undefined as never;
const nulled = null as never;

function career(overrides: Partial<Career> = {}): Career {
  return {
    id: 1,
    회사명: "BCG",
    부서: null,
    직위: null,
    고용형태: null,
    입사년월: "2020-06",
    퇴사년월: "2020-08",
    재직중: false,
    담당업무: ["업무"],
    성과: ["성과"],
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 1,
    활동명: "부스트캠프",
    기관: null,
    기간_시작: null,
    기간_종료: null,
    기간_원문: null,
    진행중: false,
    역할: null,
    활동내용: ["활동"],
    성과: ["성과"],
    ...overrides,
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    프로젝트명: "ARC",
    소속기관: null,
    기간_시작: null,
    기간_종료: null,
    기간_원문: null,
    역할: null,
    사용기술: ["TypeScript"],
    내용: ["내용"],
    성과: ["성과"],
    ...overrides,
  };
}

function club(overrides: Partial<Club> = {}): Club {
  return {
    id: 1,
    단체명: "학회",
    구분: null,
    역할: null,
    기간_원문: null,
    활동내용: ["활동"],
    ...overrides,
  };
}

function base(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "korean_resume",
      generated_at: "2026-08-05",
      source_chars: 100,
    },
    인적사항: {
      이름: "김현주",
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: [],
    },
    학력: [],
    경력: [career()],
    자격증: [],
    어학: [],
    대외활동: [activity()],
    프로젝트: [project()],
    수상: [],
    기술및역량: { 기술스택: ["Python"], 툴: [], 소프트스킬: [] },
    동아리_학회: [club()],
    연계성: [],
    자기소개_요약: null,
    파싱경고: [],
    ...overrides,
  };
}

describe("normalizeResumeVersion — 항목형 배열 결측 방어 (FRT-157)", () => {
  it("대외활동.성과가 없으면 빈 배열로 채운다 — 이슈가 보고한 크래시", () => {
    const result = normalizeResumeVersion(
      base({ 대외활동: [activity({ 성과: missing })] }),
    );

    expect(result.대외활동[0].성과).toEqual([]);
  });

  it("성과가 null 로 와도 빈 배열이다 — undefined 만 거르면 무너진다", () => {
    const result = normalizeResumeVersion(
      base({ 대외활동: [activity({ 성과: nulled })] }),
    );

    expect(result.대외활동[0].성과).toEqual([]);
  });

  it("같은 결함이 있는 형제 섹션도 함께 채운다 (경력·프로젝트·동아리)", () => {
    const result = normalizeResumeVersion(
      base({
        경력: [career({ 담당업무: missing, 성과: nulled })],
        프로젝트: [project({ 사용기술: missing, 내용: nulled, 성과: missing })],
        동아리_학회: [club({ 활동내용: missing })],
      }),
    );

    expect(result.경력[0]).toMatchObject({ 담당업무: [], 성과: [] });
    expect(result.프로젝트[0]).toMatchObject({ 사용기술: [], 내용: [], 성과: [] });
    expect(result.동아리_학회[0].활동내용).toEqual([]);
  });

  it("섹션 배열 자체가 없어도 빈 배열로 통과한다", () => {
    const result = normalizeResumeVersion(
      base({ 대외활동: missing, 경력: nulled }),
    );

    expect(result.대외활동).toEqual([]);
    expect(result.경력).toEqual([]);
  });

  it("기술및역량이 통째로 없으면 세 갈래를 모두 빈 배열로 만든다", () => {
    const result = normalizeResumeVersion(base({ 기술및역량: missing }));

    expect(result.기술및역량).toEqual({ 기술스택: [], 툴: [], 소프트스킬: [] });
  });

  it("파싱경고가 없어도 배너가 죽지 않게 채운다 — 부실한 응답일수록 이 배너가 필요하다", () => {
    const result = normalizeResumeVersion(base({ 파싱경고: missing }));

    expect(result.파싱경고).toEqual([]);
  });

  it("기타정보가 있으면 관심사를 채우고, 없으면 키를 만들지 않는다", () => {
    const 있음 = normalizeResumeVersion(
      base({ 기타정보: { 병역: "군필", 관심사: missing } }),
    );
    const 없음 = normalizeResumeVersion(base());

    expect(있음.기타정보?.관심사).toEqual([]);
    // 같은 섹션의 스칼라는 건드리지 않는다.
    expect(있음.기타정보?.병역).toBe("군필");
    // 부재와 빈 값은 다르다 — 없던 섹션을 지어내면 화면에 없던 자리가 생긴다.
    expect("기타정보" in 없음).toBe(false);
  });

  it("공백뿐인 항목은 버린다 — 파일 내보내기와 같은 규칙을 화면도 쓰게 한다", () => {
    const result = normalizeResumeVersion(
      base({ 대외활동: [activity({ 성과: ["  ", "실적", ""] })] }),
    );

    expect(result.대외활동[0].성과).toEqual(["실적"]);
  });

  // ─── 대조군: 정상 데이터가 손상되지 않는다 ───────────────────────

  it("값이 있으면 그대로 보존한다", () => {
    const result = normalizeResumeVersion(
      base({ 대외활동: [activity({ 활동명: "부스트캠프", 성과: ["IAA 0.61 → 0.78"] })] }),
    );

    expect(result.대외활동[0].성과).toEqual(["IAA 0.61 → 0.78"]);
    expect(result.대외활동[0].활동명).toBe("부스트캠프");
  });

  it("배열 밖의 필드는 건드리지 않는다", () => {
    const input = base();
    const result = normalizeResumeVersion(input);

    expect(result.경력[0].회사명).toBe("BCG");
    expect(result.경력[0].입사년월).toBe("2020-06");
    expect(result.경력[0].재직중).toBe(false);
    expect(result.meta).toEqual(input.meta);
  });

  it("두 번 통과시켜도 값이 같다 — draft 왕복이 안전해야 한다", () => {
    const input = base({
      대외활동: [activity({ 성과: missing })],
      기술및역량: nulled as unknown as Skills,
    });

    const once = normalizeResumeVersion(input);
    const twice = normalizeResumeVersion(once);

    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
