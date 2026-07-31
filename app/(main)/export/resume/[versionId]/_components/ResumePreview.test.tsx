import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ResumePreview } from "./ResumePreview";
import type { Career, ResumeVersion } from "@/types/resume";

/**
 * FRT-207 / FRT-147 — 미리보기가 실제로 그리는 것을 검증한다.
 *
 * 같은 내용의 Storybook 스토리(`ResumePreview.stories.tsx`)도 있지만, 이 저장소의
 * Storybook 테스트 러너는 `components/**` 만 훑어서 `app/` 아래 스토리는 실행되지 않는다
 * (기존 InputViewShell·SectionNav 스토리도 같은 상태). CI 에서 실제로 도는 회귀 그물은
 * 이쪽이다.
 */

afterEach(cleanup);

function career(
  id: number,
  회사명: string,
  overrides: Partial<Career> = {},
): Career {
  return {
    id,
    회사명,
    부서: null,
    직위: null,
    고용형태: null,
    입사년월: "2020-06",
    퇴사년월: "2020-08",
    재직중: false,
    담당업무: ["업무"],
    성과: [],
    ...overrides,
  };
}

function base(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "korean_resume",
      generated_at: "2026-07-31",
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
    학력: [
      {
        id: 1,
        학교명: "서울대학교",
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
    경력: [career(1, "BCG")],
    자격증: [],
    어학: [{ id: 1, 언어: "영어", 시험명: "TOEFL", 점수등급: "115", 취득년월: null }],
    대외활동: [],
    프로젝트: [],
    수상: [],
    기술및역량: { 기술스택: ["Python"], 툴: [], 소프트스킬: [] },
    동아리_학회: [],
    연계성: [],
    자기소개_요약: null,
    파싱경고: [],
    ...overrides,
  };
}

describe("ResumePreview — 섹션 라벨 (FRT-147)", () => {
  it("국문 레쥬메는 국문 제목을 쓴다", () => {
    render(<ResumePreview resume={base()} />);
    expect(screen.getByText("학력")).toBeInTheDocument();
    expect(screen.getByText("경력")).toBeInTheDocument();
    expect(screen.getByText("어학")).toBeInTheDocument();
    expect(screen.getByText("기술 및 역량")).toBeInTheDocument();
  });

  it("영문 레쥬메는 영문 제목을 쓰고 국문 제목이 새지 않는다", () => {
    render(
      <ResumePreview
        resume={base({
          meta: {
            language: "en",
            format: "western_resume",
            generated_at: "2026-07-31",
            source_chars: 100,
          },
          논문: [
            { id: 1, 제목: "Urban mobility", 게재처: "KGS", 발표년월: null, 내용: null },
          ],
          기타정보: { 병역: "Completed", 관심사: ["Drawing"] },
        })}
      />,
    );

    expect(screen.getByText("Education")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("Publications")).toBeInTheDocument();
    expect(screen.getByText("Additional Information")).toBeInTheDocument();
    expect(screen.queryByText("학력")).not.toBeInTheDocument();
    expect(screen.queryByText("경력")).not.toBeInTheDocument();
  });

  it("논문·기타정보는 값이 없으면 아예 그리지 않는다", () => {
    render(<ResumePreview resume={base()} />);
    expect(screen.queryByText("논문")).not.toBeInTheDocument();
    expect(screen.queryByText("기타정보")).not.toBeInTheDocument();
  });
});

describe("ResumePreview — 1쪽 표시 필터 (FRT-207)", () => {
  it("표시 필드가 없으면 전부 그린다 (백엔드 미구현 상태)", () => {
    render(
      <ResumePreview
        resume={base({ 경력: [career(1, "첫째"), career(2, "둘째"), career(3, "셋째")] })}
      />,
    );
    expect(screen.getByText("첫째")).toBeInTheDocument();
    expect(screen.getByText("둘째")).toBeInTheDocument();
    expect(screen.getByText("셋째")).toBeInTheDocument();
  });

  it("표시=false 는 빼고 표시순위 오름차순으로 그린다", () => {
    const { container } = render(
      <ResumePreview
        resume={base({
          경력: [
            career(1, "나중", { 표시: true, 표시순위: 2 }),
            career(2, "보류", { 표시: false, 표시순위: null }),
            career(3, "먼저", { 표시: true, 표시순위: 1 }),
          ],
        })}
      />,
    );

    expect(screen.queryByText("보류")).not.toBeInTheDocument();
    const rendered = container.textContent ?? "";
    expect(rendered.indexOf("먼저")).toBeLessThan(rendered.indexOf("나중"));
  });
});

describe("ResumePreview — 어학 능통도 (FRT-207)", () => {
  it("능통도가 없으면 현행 표기 그대로다", () => {
    render(<ResumePreview resume={base()} />);
    expect(screen.getByText(/TOEFL · 115/)).toBeInTheDocument();
  });

  it("능통도가 있으면 '능통 (TOEFL 115)' 로 붙는다", () => {
    render(
      <ResumePreview
        resume={base({
          어학: [
            {
              id: 1,
              언어: "영어",
              능통도: "능통",
              시험명: "TOEFL",
              점수등급: "115",
              취득년월: null,
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/능통 \(TOEFL 115\)/)).toBeInTheDocument();
  });
});
