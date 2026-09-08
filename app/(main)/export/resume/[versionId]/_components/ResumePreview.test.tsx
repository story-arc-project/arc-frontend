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
  it("국문 이력서는 국문 제목을 쓴다", () => {
    render(<ResumePreview resume={base()} />);
    expect(screen.getByText("학력")).toBeInTheDocument();
    expect(screen.getByText("경력")).toBeInTheDocument();
    expect(screen.getByText("어학")).toBeInTheDocument();
    expect(screen.getByText("기술 및 역량")).toBeInTheDocument();
  });

  it("영문 이력서는 영문 제목을 쓰고 국문 제목이 새지 않는다", () => {
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

  it("진행 중인 기간의 종료 자리도 언어를 따른다", () => {
    // 제목만 영문화하면 기간 오른쪽에 "2020-06 – 현재" 가 남아 영문 CV 에 한국어가 박힌다.
    const ongoing = {
      경력: [career(1, "BCG", { 퇴사년월: null, 재직중: true })],
      대외활동: [
        {
          id: 1,
          활동명: "Teach for Korea",
          기관: null,
          기간_시작: "2021-03",
          기간_종료: null,
          기간_원문: null,
          진행중: true,
          역할: null,
          활동내용: ["Mentoring"],
          성과: [],
        },
      ],
    };

    render(<ResumePreview resume={base(ongoing)} />);
    expect(screen.getAllByText(/– 현재$/)).toHaveLength(2);
    cleanup();

    render(
      <ResumePreview
        resume={base({
          ...ongoing,
          meta: {
            language: "en",
            format: "western_resume",
            generated_at: "2026-07-31",
            source_chars: 100,
          },
        })}
      />,
    );
    expect(screen.getAllByText(/– Present$/)).toHaveLength(2);
    expect(screen.queryByText(/현재/)).not.toBeInTheDocument();
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

/**
 * FRT-157 — 백엔드가 항목형 배열을 빠뜨리면 미리보기가 통째로 죽던 문제.
 *
 * 정규화(`normalizeResumeVersion`)가 실사용 경로를 막지만, 화면도 스스로 버텨야 한다 —
 * 정규화를 거치지 않은 값이 흘러들 자리가 생겨도 사용자가 백지를 보면 안 된다.
 * 그래서 여기서는 **정규화를 일부러 우회해** 원시 결측치를 그대로 꽂는다.
 */
describe("ResumePreview — 배열 필드 결측 방어 (FRT-157)", () => {
  const 결측 = undefined as never;

  it("성과가 없어도 나머지를 그대로 그린다 — 화면이 백지가 되지 않는다", () => {
    render(
      <ResumePreview
        resume={base({
          대외활동: [
            {
              id: 1,
              활동명: "부스트캠프",
              기관: null,
              기간_시작: null,
              기간_종료: null,
              기간_원문: null,
              진행중: false,
              역할: null,
              활동내용: ["데이터 라벨링 가이드 작성"],
              성과: 결측,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("부스트캠프")).toBeInTheDocument();
    expect(screen.getByText("데이터 라벨링 가이드 작성")).toBeInTheDocument();
    // 성과가 없으면 라벨도 남지 않는다 — 파일 내보내기와 같은 규칙.
    expect(screen.queryByText("성과")).not.toBeInTheDocument();
  });

  it("불릿 배열 자체가 없어도 죽지 않는다 — 공통 헬퍼가 막는다", () => {
    render(
      <ResumePreview
        resume={base({
          경력: [career(1, "BCG", { 담당업무: 결측, 성과: 결측 })],
        })}
      />,
    );

    expect(screen.getByText("BCG")).toBeInTheDocument();
  });

  it("기술및역량의 한 갈래만 없어도 나머지 갈래를 그린다", () => {
    render(
      <ResumePreview
        resume={base({ 기술및역량: { 기술스택: ["Python"], 툴: 결측, 소프트스킬: 결측 } })}
      />,
    );

    expect(screen.getByText("Python")).toBeInTheDocument();
  });

  it("프로젝트의 사용기술이 없어도 프로젝트명은 보인다", () => {
    render(
      <ResumePreview
        resume={base({
          프로젝트: [
            {
              id: 1,
              프로젝트명: "ARC",
              소속기관: null,
              기간_시작: null,
              기간_종료: null,
              기간_원문: null,
              역할: null,
              사용기술: 결측,
              내용: 결측,
              성과: 결측,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("ARC")).toBeInTheDocument();
  });

  // 대조군 — 값이 있으면 예전처럼 그대로 그린다.
  it("성과가 있으면 라벨과 함께 그린다", () => {
    render(
      <ResumePreview
        resume={base({ 경력: [career(1, "BCG", { 성과: ["IAA 0.61 → 0.78"] })] })}
      />,
    );

    expect(screen.getByText("성과")).toBeInTheDocument();
    expect(screen.getByText("IAA 0.61 → 0.78")).toBeInTheDocument();
  });
});

/**
 * FRT-163 — 배열이 있긴 한데 공백뿐인 경우.
 *
 * 결측(FRT-157)과 달리 `["", "  "]` 는 length 가 0 이 아니라서, 길이만 세는 조건은
 * 통과하지만 `compactStrings` 를 쓰는 렌더러는 아무것도 안 그린다 — 라벨만 덩그러니
 * 남는 빈 섹션이 된다. 항목 단위 필터(`visibleUsableExperiences`)도 회사명 같은 다른
 * 필드가 채워져 있으면 걸러주지 않으므로, 방어선은 라벨 조건 그 자체뿐이다.
 *
 * `ResumePreview` 는 정규화를 거치지 않고 prop 을 그대로 하위에 넘기므로, 여기서는
 * 정규화를 지나지 않은 값이 흘러든 상황을 그대로 재현한다.
 *
 * '성과' 라벨은 경력·대외활동·프로젝트가 함께 쓰는 문자열이라 queryAllByText 로 센다.
 */
describe("ResumePreview — 공백뿐인 배열 (FRT-163)", () => {
  const 공백뿐 = ["", "  "];

  it("경력의 성과가 공백뿐이면 '성과' 라벨도 남지 않는다", () => {
    render(
      <ResumePreview
        resume={base({ 경력: [career(1, "BCG", { 성과: 공백뿐 })] })}
      />,
    );

    // 다른 필드가 채워져 있어 항목 자체는 걸러지지 않는다 — 그래서 라벨 조건이 유일한 방어선.
    expect(screen.getByText("BCG")).toBeInTheDocument();
    expect(screen.queryAllByText("성과")).toHaveLength(0);
  });

  it("대외활동의 성과가 공백뿐일 때도 같은 규칙을 쓴다", () => {
    render(
      <ResumePreview
        resume={base({
          대외활동: [
            {
              id: 1,
              활동명: "부스트캠프",
              기관: null,
              기간_시작: null,
              기간_종료: null,
              기간_원문: null,
              진행중: false,
              역할: null,
              활동내용: ["데이터 라벨링 가이드 작성"],
              성과: 공백뿐,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("부스트캠프")).toBeInTheDocument();
    expect(screen.queryAllByText("성과")).toHaveLength(0);
  });

  it("담당업무가 공백뿐이면 빈 불릿 목록을 그리지 않는다", () => {
    const { container } = render(
      <ResumePreview
        resume={base({
          경력: [career(1, "BCG", { 담당업무: 공백뿐, 성과: 공백뿐 })],
        })}
      />,
    );

    expect(screen.getByText("BCG")).toBeInTheDocument();
    // 빈 <li> 가 남으면 미리보기에 정체불명의 불릿 점이 찍힌다.
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});
