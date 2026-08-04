import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, within } from "storybook/test";

import { ResumePreview } from "./ResumePreview";
import type { Career, ResumeVersion } from "@/types/resume";

function base(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "korean_resume",
      generated_at: "2026-07-31",
      source_chars: 1200,
    },
    인적사항: {
      이름: "김현주",
      영문명: "HyunJu Kim",
      생년월일: null,
      이메일: "k.hyunju@example.com",
      전화번호: "010-0000-2162",
      주소: "서울 관악구",
      링크: [],
    },
    학력: [
      {
        id: 1,
        학교명: "서울대학교",
        학과: "지리교육",
        전공구분: "주전공",
        학위: "학사",
        입학년월: "2014-03",
        졸업년월: "2021-02",
        졸업구분: "졸업",
        학점: 3.65,
        만점: 4.3,
        비고: null,
      },
    ],
    경력: [career(1, "Boston Consulting Group", "Research Analyst")],
    자격증: [],
    어학: [
      { id: 1, 언어: "영어", 시험명: "TOEFL", 점수등급: "115", 취득년월: "2026-05" },
    ],
    대외활동: [],
    프로젝트: [],
    수상: [],
    기술및역량: { 기술스택: ["Python", "SQL"], 툴: [], 소프트스킬: [] },
    동아리_학회: [],
    연계성: [],
    자기소개_요약: null,
    파싱경고: [],
    ...overrides,
  };
}

function career(id: number, 회사명: string, 직위: string, display?: Partial<Career>): Career {
  return {
    id,
    회사명,
    부서: null,
    직위,
    고용형태: null,
    입사년월: "2020-06",
    퇴사년월: "2020-08",
    재직중: false,
    담당업무: ["신규 헬스케어 앱 매출 추정치 도출"],
    성과: [],
    ...display,
  };
}

const meta = {
  title: "Export/ResumePreview",
  component: ResumePreview,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ResumePreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Korean: Story = {
  args: { resume: base() },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("학력")).toBeInTheDocument();
    await expect(c.getByText("어학")).toBeInTheDocument();
    await expect(c.getByText("기술 및 역량")).toBeInTheDocument();
  },
};

/** FRT-147 — 영문 응답이 경계에서 매핑돼 들어온 상태. 섹션 제목만 영문으로 갈린다. */
export const English: Story = {
  args: {
    resume: base({
      meta: {
        language: "en",
        format: "western_resume",
        generated_at: "2026-07-31",
        source_chars: 1200,
      },
      학력: [
        {
          id: 1,
          학교명: "Seoul National University",
          학과: "Geography Education",
          전공구분: null,
          학위: "Bachelor",
          입학년월: "2014-03",
          졸업년월: "2021-02",
          졸업구분: "Graduated",
          학점: 3.65,
          만점: 4.3,
          비고: null,
        },
      ],
      논문: [
        { id: 1, 제목: "Urban mobility", 게재처: "KGS", 발표년월: "2021-05", 내용: null },
      ],
      기타정보: { 병역: "Completed", 관심사: ["Drawing", "Snowboarding"] },
    }),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Education")).toBeInTheDocument();
    await expect(c.getByText("Work Experience")).toBeInTheDocument();
    await expect(c.getByText("Publications")).toBeInTheDocument();
    await expect(c.getByText("Additional Information")).toBeInTheDocument();
    // 영문 원문을 국문 enum 으로 번역하지 않는다.
    await expect(c.getByText(/Bachelor/)).toBeInTheDocument();
    // 국문 제목이 새면 안 된다.
    await expect(c.queryByText("학력")).not.toBeInTheDocument();
  },
};

/** FRT-207 — 표시=false 인 경험은 1쪽 예산에서 빠져 렌더되지 않는다. */
export const OnePageFiltered: Story = {
  args: {
    resume: base({
      경력: [
        career(1, "실린 경력 (순위 2)", "Analyst", { 표시: true, 표시순위: 2 }),
        career(2, "보류된 경력", "Intern", { 표시: false, 표시순위: null }),
        career(3, "실린 경력 (순위 1)", "Consultant", { 표시: true, 표시순위: 1 }),
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("실린 경력 (순위 1)")).toBeInTheDocument();
    await expect(c.queryByText("보류된 경력")).not.toBeInTheDocument();
    // 표시순위 오름차순이라 1번이 2번보다 위에 온다.
    const rendered = canvasElement.textContent ?? "";
    await expect(rendered.indexOf("순위 1")).toBeLessThan(rendered.indexOf("순위 2"));
  },
};

/** FRT-207 — 능통도가 있으면 "능통 (TOEFL 115)" 로 붙는다. */
export const LanguageProficiency: Story = {
  args: {
    resume: base({
      어학: [
        { id: 1, 언어: "한국어", 능통도: "원어민", 시험명: null, 점수등급: null, 취득년월: null },
        { id: 2, 언어: "영어", 능통도: "능통", 시험명: "TOEFL", 점수등급: "115", 취득년월: "2026-05" },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(/능통 \(TOEFL 115\)/)).toBeInTheDocument();
    await expect(c.getByText(/원어민/)).toBeInTheDocument();
  },
};
