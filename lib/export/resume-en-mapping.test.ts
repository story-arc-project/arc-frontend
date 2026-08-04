import { describe, it, expect } from "vitest";

import { mapEnglishResume } from "@/lib/export/resume-en-mapping";
import { visibleExperiences } from "@/lib/export/resume-visibility";

/** arc-backend `ai_analyst/src/ai/resume.py` 의 `_SYS_EN` 스키마 그대로. */
function enPayload(overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      language: "en",
      format: "western_resume",
      generated_at: "2026-07-31",
      source_chars: 4210,
    },
    contact: {
      name: "HyunJu Kim",
      name_ko: "김현주",
      email: "k.hyunju@example.com",
      phone: "010-0000-2162",
      location: "Seoul, Korea",
      linkedin: "https://linkedin.com/in/hyunju",
      github: "https://github.com/hyunju",
      portfolio: null,
      other_links: ["https://hyunju.dev"],
    },
    summary: "Analyst with consulting experience.",
    education: [
      {
        id: 1,
        institution: "Seoul National University",
        degree: "Bachelor",
        field_of_study: "Geography Education",
        minor: "Business Administration",
        start_date: "2014-03",
        end_date: "2021-02",
        status: "Graduated",
        gpa: 3.65,
        gpa_scale: 4.3,
        honors: "Dean's List",
        relevant_coursework: ["Corporate Finance"],
        notes: null,
      },
    ],
    work_experience: [
      {
        id: 1,
        company: "Boston Consulting Group",
        title: "Research Analyst",
        employment_type: "Internship",
        start_date: "2020-06",
        end_date: "2020-08",
        is_current: false,
        location: "Seoul",
        responsibilities: ["Market sizing for a healthcare app"],
        achievements: ["Adopted in the interim readout"],
      },
    ],
    projects: [
      {
        id: 1,
        name: "Churn model",
        organization: "SNU Lab",
        start_date: "2021-03",
        end_date: "2021-08",
        role: "Lead",
        tech_stack: ["Python", "SQL"],
        description: ["Built a churn prediction pipeline"],
        outcomes: ["AUC 0.82"],
      },
    ],
    skills: {
      technical: ["Python", "SQL"],
      tools: ["Excel"],
      languages: ["Korean (Native)", "English (TOEFL 115)"],
      soft_skills: ["Facilitation"],
    },
    certifications: [
      { id: 1, name: "ADsP", issuer: "K-DATA", date: "2021-09", type: "National" },
    ],
    awards: [
      { id: 1, title: "Best Team", issuer: "MCSA", date: "2020-06", description: null },
    ],
    activities: [
      {
        id: 1,
        organization: "MCSA",
        type: "Society",
        role: "Team Lead",
        start_date: "2019-09",
        end_date: "2020-06",
        date_raw: "2019.09 - 2020.06",
        is_ongoing: false,
        description: ["Standardized weekly workplans"],
        achievements: ["Presented to the CEO"],
      },
    ],
    publications: [
      { id: 1, title: "Urban mobility", venue: "KGS", date: "2021-05", description: null },
    ],
    connections: [{ item_ids: [1, 2], note: "Both used SQL" }],
    parse_warnings: [],
    ...overrides,
  };
}

describe("mapEnglishResume", () => {
  it("EN 응답의 모든 섹션이 내부 형태로 채워진다", () => {
    const mapped = mapEnglishResume(enPayload());
    expect(mapped).not.toBeNull();
    if (!mapped) return;

    // 이 단정이 FRT-147 의 본체다 — 지금은 이 키들이 전부 undefined 라 빈 화면이 뜬다.
    expect(mapped.인적사항.이름).toBe("HyunJu Kim");
    expect(mapped.인적사항.영문명).toBe("김현주");
    expect(mapped.인적사항.이메일).toBe("k.hyunju@example.com");
    expect(mapped.인적사항.주소).toBe("Seoul, Korea");
    expect(mapped.자기소개_요약).toBe("Analyst with consulting experience.");
    expect(mapped.학력).toHaveLength(1);
    expect(mapped.경력).toHaveLength(1);
    expect(mapped.프로젝트).toHaveLength(1);
    expect(mapped.대외활동).toHaveLength(1);
    expect(mapped.자격증).toHaveLength(1);
    expect(mapped.수상).toHaveLength(1);
    expect(mapped.논문).toHaveLength(1);
    expect(mapped.기술및역량.기술스택).toEqual(["Python", "SQL"]);
    expect(mapped.연계성).toHaveLength(1);
  });

  it("영문 원문을 국문 enum 으로 번역하지 않는다", () => {
    // 영문 CV 에 "학사"·"정규직"이 찍히면 그 자체가 결함이다.
    const mapped = mapEnglishResume(enPayload());
    expect(mapped?.학력[0].학위).toBe("Bachelor");
    expect(mapped?.학력[0].졸업구분).toBe("Graduated");
    expect(mapped?.경력[0].고용형태).toBe("Internship");
    expect(mapped?.자격증[0].자격구분).toBe("National");
  });

  it("contact 의 링크 3종과 other_links 를 모두 링크로 모은다", () => {
    const mapped = mapEnglishResume(enPayload());
    expect(mapped?.인적사항.링크.map((l) => l.url)).toEqual([
      "https://linkedin.com/in/hyunju",
      "https://github.com/hyunju",
      "https://hyunju.dev",
    ]);
    // portfolio 는 null 이라 빈 행으로 남으면 안 된다.
    expect(mapped?.인적사항.링크).toHaveLength(3);
  });

  it("현행 백엔드의 skills.languages(문자열 배열)를 어학으로 승격한다", () => {
    const mapped = mapEnglishResume(enPayload());
    expect(mapped?.어학).toEqual([
      { id: 1, 언어: "Korean (Native)", 능통도: null, 시험명: null, 점수등급: null, 취득년월: null },
      { id: 2, 언어: "English (TOEFL 115)", 능통도: null, 시험명: null, 점수등급: null, 취득년월: null },
    ]);
    // 어학으로 옮긴 뒤에도 기술 목록에 언어가 섞이면 안 된다.
    expect(mapped?.기술및역량).toEqual({
      기술스택: ["Python", "SQL"],
      툴: ["Excel"],
      소프트스킬: ["Facilitation"],
    });
  });

  it("rev.5 최상위 languages[] 가 오면 그쪽을 쓰고 능통도를 싣는다", () => {
    const mapped = mapEnglishResume(
      enPayload({
        languages: [
          { language: "English", proficiency: "Fluent", test: "TOEFL", score: "115", date: "2026-05" },
        ],
      }),
    );
    expect(mapped?.어학).toEqual([
      { id: 1, 언어: "English", 능통도: "Fluent", 시험명: "TOEFL", 점수등급: "115", 취득년월: "2026-05" },
    ]);
  });

  it("rev.5 additional_info 를 기타정보로 옮긴다", () => {
    const mapped = mapEnglishResume(
      enPayload({ additional_info: { military: "Completed", interests: ["Drawing"] } }),
    );
    expect(mapped?.기타정보).toEqual({ 병역: "Completed", 관심사: ["Drawing"] });
  });

  it("rev.5 display/display_rank 를 표시/표시순위로 옮긴다", () => {
    const payload = enPayload();
    const mapped = mapEnglishResume({
      ...payload,
      work_experience: [{ ...payload.work_experience[0], display: false, display_rank: null }],
      projects: [{ ...payload.projects[0], display: true, display_rank: 2 }],
    });
    expect(mapped?.경력[0].표시).toBe(false);
    expect(mapped?.프로젝트[0].표시).toBe(true);
    expect(mapped?.프로젝트[0].표시순위).toBe(2);
  });

  it("display 가 null 이면 태그되지 않은 것으로 둔다 — false 로 바꾸면 경험이 사라진다", () => {
    // optional 을 null 로 직렬화하는 건 흔한 모양이다. 이걸 false 로 읽으면 "명시적으로
    // 뺀 경험"이 되어 미리보기·PDF·Word 에서 통째로 없어진다(표시 규칙은 명시적 false 만
    // 숨긴다). 태그가 없어야 `visibleExperiences` 의 하위호환 분기를 타 전부 그려진다.
    const payload = enPayload();
    const mapped = mapEnglishResume({
      ...payload,
      work_experience: [
        { ...payload.work_experience[0], display: null, display_rank: null },
      ],
    });

    expect(mapped?.경력[0]).not.toHaveProperty("표시");
    expect(visibleExperiences(mapped?.경력)).toHaveLength(1);
  });

  it("동아리_학회는 빈 배열이다 — 영문은 activities 로 흡수된다", () => {
    expect(mapEnglishResume(enPayload())?.동아리_학회).toEqual([]);
  });

  it("멱등하다 — 매핑 결과를 다시 넣어도 그대로다", () => {
    // localStorage draft 도 이 경계를 통과한다. meta.language 로 분기했다면 두 번째 호출이
    // contact 를 못 찾아 전 섹션을 날렸을 것이다.
    const once = mapEnglishResume(enPayload());
    expect(once).not.toBeNull();
    expect(mapEnglishResume(once)).toBeNull();
  });

  it("국문 응답에는 손대지 않는다", () => {
    const ko = {
      meta: { language: "ko", format: "korean_resume", generated_at: "2026-07-31", source_chars: 10 },
      인적사항: { 이름: "김상협", 링크: [] },
      학력: [{ id: 1, 학교명: "서울대학교" }],
    };
    expect(mapEnglishResume(ko)).toBeNull();
  });

  it("EN 키가 하나만 있어도 EN 으로 판정한다", () => {
    expect(mapEnglishResume({ work_experience: [] })).not.toBeNull();
    expect(mapEnglishResume({ contact: {} })).not.toBeNull();
  });

  it("섹션이 통째로 빠져도 던지지 않고 빈 값으로 채운다", () => {
    const mapped = mapEnglishResume({ contact: {} });
    expect(mapped?.학력).toEqual([]);
    expect(mapped?.경력).toEqual([]);
    expect(mapped?.어학).toEqual([]);
    expect(mapped?.기술및역량).toEqual({ 기술스택: [], 툴: [], 소프트스킬: [] });
    expect(mapped?.파싱경고).toEqual([]);
    expect(mapped?.인적사항.이름).toBeNull();
  });

  it("타입이 어긋난 값을 흘려보내지 않는다", () => {
    const mapped = mapEnglishResume({
      contact: { name: 42, other_links: "not-an-array" },
      education: "not-an-array",
      work_experience: [{ id: "x", company: null, responsibilities: [1, "ok", null] }],
    });
    expect(mapped?.인적사항.이름).toBeNull();
    expect(mapped?.인적사항.링크).toEqual([]);
    expect(mapped?.학력).toEqual([]);
    expect(mapped?.경력[0].담당업무).toEqual(["ok"]);
    expect(mapped?.경력[0].id).toBe(1);
  });

  it("객체가 아닌 입력은 null 이다", () => {
    expect(mapEnglishResume(null)).toBeNull();
    expect(mapEnglishResume("resume")).toBeNull();
    expect(mapEnglishResume([])).toBeNull();
  });

  it("meta 를 보존하고 language 를 en 으로 남긴다", () => {
    const mapped = mapEnglishResume(enPayload());
    expect(mapped?.meta.language).toBe("en");
    expect(mapped?.meta.generated_at).toBe("2026-07-31");
    expect(mapped?.meta.source_chars).toBe(4210);
  });
});
