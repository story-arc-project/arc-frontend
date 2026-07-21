import { describe, it, expect } from "vitest";

import { buildResumeDocument } from "@/lib/export/resume-document";
import { seedResume } from "@/lib/demo/seed";
import type { ResumeVersion } from "@/types/resume";

function emptyResume(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "json",
      generated_at: "2026-07-21T00:00:00Z",
      source_chars: 0,
    },
    인적사항: {
      이름: null,
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: [],
    },
    학력: [],
    경력: [],
    자격증: [],
    어학: [],
    대외활동: [],
    프로젝트: [],
    수상: [],
    기술및역량: { 기술스택: [], 툴: [], 소프트스킬: [] },
    동아리_학회: [],
    연계성: [],
    자기소개_요약: null,
    파싱경고: [],
    ...overrides,
  };
}

function sectionTitles(resume: ResumeVersion): string[] {
  return buildResumeDocument(resume).sections.map((s) => s.title);
}

describe("buildResumeDocument — 헤더", () => {
  it("연락처는 값이 있는 것만 모은다", () => {
    const doc = buildResumeDocument(
      emptyResume({
        인적사항: {
          이름: "김서윤",
          영문명: "Seo-yun Kim",
          생년월일: "2002-03-15",
          이메일: "a@b.com",
          전화번호: null,
          주소: "   ",
          링크: [],
        },
      }),
    );

    expect(doc.header.name).toBe("김서윤");
    expect(doc.header.subName).toBe("Seo-yun Kim");
    expect(doc.header.birth).toBe("2002-03-15");
    expect(doc.header.contacts).toEqual(["a@b.com"]);
  });

  it("url 이 빈 링크는 버린다", () => {
    const doc = buildResumeDocument(
      emptyResume({
        인적사항: {
          ...emptyResume().인적사항,
          링크: [
            { label: "GitHub", url: "https://github.com/demo" },
            { label: "빈 링크", url: "  " },
          ],
        },
      }),
    );

    expect(doc.header.links).toEqual([
      { label: "GitHub", url: "https://github.com/demo" },
    ]);
  });

  it("language 를 그대로 전달한다", () => {
    expect(buildResumeDocument(emptyResume()).language).toBe("ko");
  });
});

describe("buildResumeDocument — 섹션 선별", () => {
  it("내용이 없으면 섹션을 만들지 않는다", () => {
    expect(sectionTitles(emptyResume())).toEqual([]);
  });

  it("항목이 전부 비어 있으면 섹션을 만들지 않는다", () => {
    const titles = sectionTitles(
      emptyResume({
        수상: [
          { id: 1, 수상명: null, 수여기관: null, 수상년월: null, 내용: null },
        ],
      }),
    );
    expect(titles).toEqual([]);
  });

  it("미리보기와 같은 순서로 섹션을 배치한다", () => {
    // 모든 섹션을 최소한으로 채워 순서만 본다(seedResume 은 일부 섹션이 비어 있다).
    const full = emptyResume({
      자기소개_요약: "요약",
      학력: [
        {
          id: 1,
          학교명: "학교",
          학과: null,
          전공구분: null,
          학위: null,
          입학년월: null,
          졸업년월: null,
          졸업구분: null,
          학점: null,
          만점: null,
          비고: null,
        },
      ],
      경력: [
        {
          id: 1,
          회사명: "회사",
          부서: null,
          직위: null,
          고용형태: null,
          입사년월: null,
          퇴사년월: null,
          재직중: false,
          담당업무: [],
          성과: [],
        },
      ],
      프로젝트: [
        {
          id: 1,
          프로젝트명: "프로젝트",
          소속기관: null,
          기간_시작: null,
          기간_종료: null,
          기간_원문: null,
          역할: null,
          사용기술: [],
          내용: [],
          성과: [],
        },
      ],
      대외활동: [
        {
          id: 1,
          활동명: "활동",
          기관: null,
          기간_시작: null,
          기간_종료: null,
          기간_원문: null,
          진행중: false,
          역할: null,
          활동내용: [],
          성과: [],
        },
      ],
      동아리_학회: [
        {
          id: 1,
          단체명: "학회",
          구분: null,
          기간_원문: null,
          역할: null,
          활동내용: [],
        },
      ],
      수상: [
        { id: 1, 수상명: "수상", 수여기관: null, 수상년월: null, 내용: null },
      ],
      자격증: [
        {
          id: 1,
          자격증명: "자격증",
          발급기관: null,
          취득년월: null,
          자격구분: null,
        },
      ],
      어학: [
        {
          id: 1,
          언어: "영어",
          시험명: null,
          점수등급: null,
          취득년월: null,
        },
      ],
      기술및역량: { 기술스택: ["Python"], 툴: [], 소프트스킬: [] },
    });

    expect(sectionTitles(full)).toEqual([
      "자기소개",
      "학력",
      "경력",
      "프로젝트",
      "대외활동",
      "동아리 · 학회",
      "수상",
      "자격증",
      "어학",
      "기술 및 역량",
    ]);
  });

  it("연계성·파싱경고는 문서에 넣지 않는다", () => {
    const doc = buildResumeDocument(
      emptyResume({
        연계성: [{ 항목ids: [1, 2], 연결점: "머신러닝" }],
        파싱경고: ["경력 기간을 해석하지 못했어요"],
      }),
    );
    expect(doc.sections).toEqual([]);
    expect(JSON.stringify(doc)).not.toContain("머신러닝");
    expect(JSON.stringify(doc)).not.toContain("해석하지 못했어요");
  });
});

describe("buildResumeDocument — 경력", () => {
  const career = {
    id: 1,
    회사명: "ARC",
    부서: "NLP Lab",
    직위: "연구생",
    고용형태: "인턴" as const,
    입사년월: "2025-09",
    퇴사년월: "2026-02",
    재직중: false,
    담당업무: ["데이터 품질 관리", "  "],
    성과: ["IAA 0.61 → 0.78"],
  };

  it("부제는 부서·직위·고용형태를 가운뎃점으로 잇는다", () => {
    const [entry] = buildResumeDocument(emptyResume({ 경력: [career] }))
      .sections[0].entries;

    expect(entry.title).toBe("ARC");
    expect(entry.subtitle).toBe("NLP Lab · 연구생 · 인턴");
    expect(entry.meta).toBe("2025-09 – 2026-02");
  });

  it("담당업무와 성과를 각각의 불릿 묶음으로 나누고 빈 줄은 버린다", () => {
    const [entry] = buildResumeDocument(emptyResume({ 경력: [career] }))
      .sections[0].entries;

    expect(entry.bulletGroups).toEqual([
      { items: ["데이터 품질 관리"] },
      { label: "성과", items: ["IAA 0.61 → 0.78"] },
    ]);
  });

  it("재직중이면 종료 시점을 '현재'로 표기한다", () => {
    const [entry] = buildResumeDocument(
      emptyResume({
        경력: [{ ...career, 퇴사년월: null, 재직중: true }],
      }),
    ).sections[0].entries;

    expect(entry.meta).toBe("2025-09 – 현재");
  });
});

describe("buildResumeDocument — 학력", () => {
  const edu = {
    id: 1,
    학교명: "한양대학교",
    학과: "컴퓨터소프트웨어학부",
    전공구분: "주전공" as const,
    학위: "학사" as const,
    입학년월: "2021-03",
    졸업년월: "2026-08",
    졸업구분: "졸업예정" as const,
    학점: 3.72,
    만점: 4.5,
    비고: null,
  };

  it("학점은 만점과 함께 표기한다", () => {
    const [entry] = buildResumeDocument(emptyResume({ 학력: [edu] }))
      .sections[0].entries;

    expect(entry.subtitle).toBe("컴퓨터소프트웨어학부 · 주전공 · 학사 · 졸업예정");
    expect(entry.detail).toBe("3.72 / 4.5");
    expect(entry.meta).toBe("2021-03 – 2026-08");
  });

  it("만점이 없으면 학점만 적는다", () => {
    const [entry] = buildResumeDocument(
      emptyResume({ 학력: [{ ...edu, 만점: null, 비고: "편입" }] }),
    ).sections[0].entries;

    expect(entry.detail).toBe("3.72  ·  편입");
  });

  it("졸업년월이 없고 재학이면 '재학'으로 닫는다", () => {
    const [entry] = buildResumeDocument(
      emptyResume({
        학력: [{ ...edu, 졸업년월: null, 졸업구분: "재학" }],
      }),
    ).sections[0].entries;

    expect(entry.meta).toBe("2021-03 – 재학");
  });
});

describe("buildResumeDocument — 프로젝트", () => {
  it("사용 기술을 라벨 붙은 주석 줄로 붙인다", () => {
    const [entry] = buildResumeDocument(
      emptyResume({
        프로젝트: [
          {
            id: 1,
            프로젝트명: "ARC",
            소속기관: "한양대",
            기간_시작: null,
            기간_종료: null,
            기간_원문: "2025.07 - 2025.11",
            역할: "PM",
            사용기술: ["Next.js", "  ", "FastAPI"],
            내용: ["요구사항 정리"],
            성과: [],
          },
        ],
      }),
    ).sections[0].entries;

    expect(entry.subtitle).toBe("한양대 · PM");
    expect(entry.meta).toBe("2025.07 - 2025.11");
    expect(entry.notes).toEqual([
      { label: "사용 기술", text: "Next.js, FastAPI" },
    ]);
    expect(entry.bulletGroups).toEqual([{ items: ["요구사항 정리"] }]);
  });
});

describe("buildResumeDocument — 나머지 섹션", () => {
  it("동아리·학회는 기간 원문을 그대로 쓴다", () => {
    const [entry] = buildResumeDocument(
      emptyResume({
        동아리_학회: [
          {
            id: 1,
            단체명: "ARC",
            구분: "학회",
            기간_원문: "2024.03 - 2025.02",
            역할: "회장",
            활동내용: ["세미나 운영"],
          },
        ],
      }),
    ).sections[0].entries;

    expect(entry.title).toBe("ARC");
    expect(entry.subtitle).toBe("학회 · 회장");
    expect(entry.meta).toBe("2024.03 - 2025.02");
  });

  it("어학은 시험명·점수를 부제로 모은다", () => {
    const [entry] = buildResumeDocument(
      emptyResume({
        어학: [
          {
            id: 1,
            언어: "영어",
            시험명: "TOEIC",
            점수등급: "875",
            취득년월: "2024-09",
          },
        ],
      }),
    ).sections[0].entries;

    expect(entry.title).toBe("영어");
    expect(entry.subtitle).toBe("TOEIC · 875");
    expect(entry.meta).toBe("2024-09");
  });

  it("자기소개는 문단 한 덩어리로 담는다", () => {
    const doc = buildResumeDocument(
      emptyResume({ 자기소개_요약: "데이터로 문제를 푸는 사람입니다." }),
    );

    expect(doc.sections[0].title).toBe("자기소개");
    expect(doc.sections[0].entries[0].text).toBe(
      "데이터로 문제를 푸는 사람입니다.",
    );
  });

  it("기술 및 역량은 채워진 묶음만 한 줄씩 만든다", () => {
    const doc = buildResumeDocument(
      emptyResume({
        기술및역량: {
          기술스택: ["Python", "TypeScript"],
          툴: [],
          소프트스킬: ["협업", " "],
        },
      }),
    );

    expect(doc.sections[0].entries).toEqual([
      { title: "기술 스택", text: "Python, TypeScript" },
      { title: "소프트 스킬", text: "협업" },
    ]);
  });
});

describe("buildResumeDocument — 실제 데이터", () => {
  it("데모 레쥬메의 모든 섹션이 항목을 갖는다", () => {
    const doc = buildResumeDocument(seedResume);

    expect(doc.sections.length).toBeGreaterThan(0);
    for (const section of doc.sections) {
      expect(section.entries.length).toBeGreaterThan(0);
    }
    expect(doc.header.name).toBe("김서윤");
  });
});
