// ─────────────────────────────────────────────────────────────
// E2E API stub fixtures (FRT-28)
//
// `(main)` 스모크가 의존하는 백엔드 **데이터 엔드포인트**의 결정론적 응답 모음.
// `stub-api.ts` 의 `page.route` 핸들러가 이 fixture 들을 그대로 fulfill 한다.
//
// 설계 원칙
// - 실제 `lib/api/*-api.ts` 가 기대하는 **응답 봉투(envelope)** 를 그대로 맞춘다.
//   · 대부분: `{ status, message, data }` (ApiSuccessResponse<T>)
//   · 예외: `GET /analysis/status/:id` 는 봉투 없이 raw `{ status }` 를 반환한다.
// - scenario("data" | "empty") 로 **loading → data / empty** 기본 상태를 커버한다.
//   목록(list) 은 scenario 를 따르고, 상세(detail)·status 는 항상 채워진 값을 반환한다
//   (진입 화면 스모크의 빈 상태 관심사는 목록에 있으므로).
// - 모든 값은 고정값(시간 포함)이라 네트워크·시계 의존 없이 재현 가능하다.
//
// 인증(`/auth/me`)은 FRT-24(`NEXT_PUBLIC_E2E_AUTH`) 소관이라 여기서 다루지 않는다.
// ─────────────────────────────────────────────────────────────

import type { ApiSuccessResponse } from "@/types/api";
import type { Experience, ExperienceListData } from "@/types/experience";
import type { LibraryDTO } from "@/lib/utils/library-mapper";
import type { PresetDTO } from "@/lib/utils/preset-mapper";
import type {
  AnalysisSnapshot,
  AnalysisStatus,
  BookmarkedSnapshot,
} from "@/types/analysis";
import type { ResumeVersion } from "@/types/resume";

export type StubScenario = "data" | "empty";

/** ApiSuccessResponse 봉투로 감싼다(stub-api 의 변이 응답도 이 단일 출처를 쓴다). */
export function success<T>(data: T): ApiSuccessResponse<T> {
  return { status: "success", message: "ok", data };
}

export const E2E_USER_ID = "e2e-user";

// ─── Experiences ────────────────────────────────────────────

function experience(
  id: string,
  type: string,
  content: Record<string, unknown>,
  importance: number | null,
  createdAt: string,
): Experience {
  return {
    id,
    user_id: E2E_USER_ID,
    type,
    importance,
    content,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const EXPERIENCE_1 = experience(
  "exp-e2e-1",
  "club",
  {
    title: "교내 개발 동아리 운영진",
    summary: "12명 규모 동아리의 세미나 기획과 신입 온보딩을 주도했다.",
    status: "complete",
    tags: ["리더십", "기획"],
    coreBlocks: [],
    extensionBlocks: [],
    customBlocks: [],
  },
  4,
  "2026-01-15T09:00:00.000Z",
);

const EXPERIENCE_2 = experience(
  "exp-e2e-2",
  "team-project",
  {
    title: "캡스톤 팀 프로젝트",
    summary: "4인 팀에서 백엔드 API 설계를 맡아 발표까지 마쳤다.",
    status: "draft",
    tags: ["협업", "백엔드"],
    coreBlocks: [],
    extensionBlocks: [],
    customBlocks: [],
  },
  3,
  "2026-02-20T09:00:00.000Z",
);

export function experienceList(
  scenario: StubScenario,
): ApiSuccessResponse<ExperienceListData> {
  if (scenario === "empty") return success({ count: 0, contents: [] });
  const contents = [EXPERIENCE_1, EXPERIENCE_2];
  return success({ count: contents.length, contents });
}

export function experienceDetail(): ApiSuccessResponse<Experience> {
  // 상세는 존재 여부가 관심사이므로 scenario 무관하게 단일 항목을 반환한다.
  return success(EXPERIENCE_1);
}

// ─── Libraries ──────────────────────────────────────────────

interface LibraryListData {
  count: number;
  contents: { system: LibraryDTO[]; custom: LibraryDTO[] };
}

const SYSTEM_LIBRARIES: LibraryDTO[] = [
  { id: "lib-sys-recent", name: "최근 추가", color: null, icon: null, is_system: true, filter: null },
  { id: "lib-sys-important", name: "중요", color: null, icon: null, is_system: true, filter: null },
];

const CUSTOM_LIBRARIES: LibraryDTO[] = [
  { id: "lib-custom-1", name: "백엔드 역량", color: "#5E6AD2", icon: null, is_system: false, filter: null },
];

export function libraryList(
  scenario: StubScenario,
): ApiSuccessResponse<LibraryListData> {
  if (scenario === "empty") {
    return success({ count: 0, contents: { system: [], custom: [] } });
  }
  const count = SYSTEM_LIBRARIES.length + CUSTOM_LIBRARIES.length;
  return success({ count, contents: { system: SYSTEM_LIBRARIES, custom: CUSTOM_LIBRARIES } });
}

export function libraryExperiences(
  scenario: StubScenario,
): ApiSuccessResponse<ExperienceListData> {
  if (scenario === "empty") return success({ count: 0, contents: [] });
  const contents = [EXPERIENCE_1];
  return success({ count: contents.length, contents });
}

// ─── Presets ────────────────────────────────────────────────
// `/archive` 진입 화면이 usePresets 로 호출한다. 응답: { data: { count, contents } }.

interface PresetListData {
  count: number;
  contents: PresetDTO[];
}

const PRESETS: PresetDTO[] = [
  {
    id: "preset-e2e-1",
    user_id: E2E_USER_ID,
    name: "프로젝트 회고 템플릿",
    description: "프로젝트 경험을 빠르게 기록하는 프리셋.",
    blocks: [],
    is_favorite: true,
    created_at: "2026-01-10T09:00:00.000Z",
    updated_at: "2026-01-10T09:00:00.000Z",
  },
];

export function presetList(
  scenario: StubScenario,
): ApiSuccessResponse<PresetListData> {
  if (scenario === "empty") return success({ count: 0, contents: [] });
  return success({ count: PRESETS.length, contents: PRESETS });
}

// ─── Analysis: lists ────────────────────────────────────────
// 목록 응답의 data 는 배열이다 (analysis-api 의 unwrapList 가 배열을 수용).
// mapSnapshot 은 camelCase(createdAt) 를 그대로 읽으므로 프론트 타입과 동일하게 둔다.

function snapshot(
  partial: Partial<AnalysisSnapshot> & Pick<AnalysisSnapshot, "id" | "type" | "title">,
): AnalysisSnapshot {
  return {
    status: "completed",
    createdAt: "2026-03-01T09:00:00.000Z",
    experienceCount: 1,
    isBookmarked: false,
    ...partial,
  };
}

const INDIVIDUAL_SNAPSHOTS: AnalysisSnapshot[] = [
  snapshot({
    id: "ind-1",
    type: "individual",
    title: "교내 개발 동아리 운영진 분석",
    selectedExperienceIds: ["exp-e2e-1"],
  }),
];

const COMPREHENSIVE_SNAPSHOTS: AnalysisSnapshot[] = [
  snapshot({
    id: "comp-1",
    type: "comprehensive",
    title: "전체 경험 종합 분석",
    experienceCount: 2,
    selectedExperienceIds: ["exp-e2e-1", "exp-e2e-2"],
  }),
];

const KEYWORD_SNAPSHOTS: AnalysisSnapshot[] = [
  snapshot({
    id: "kw-1",
    type: "keyword",
    title: "리더십 키워드 분석",
    selectedKeywords: ["리더십"],
  }),
];

export function individualList(
  scenario: StubScenario,
): ApiSuccessResponse<AnalysisSnapshot[]> {
  return success(scenario === "empty" ? [] : INDIVIDUAL_SNAPSHOTS);
}

export function comprehensiveList(
  scenario: StubScenario,
): ApiSuccessResponse<AnalysisSnapshot[]> {
  return success(scenario === "empty" ? [] : COMPREHENSIVE_SNAPSHOTS);
}

export function keywordList(
  scenario: StubScenario,
): ApiSuccessResponse<AnalysisSnapshot[]> {
  return success(scenario === "empty" ? [] : KEYWORD_SNAPSHOTS);
}

export function bookmarkList(
  scenario: StubScenario,
): ApiSuccessResponse<BookmarkedSnapshot[]> {
  if (scenario === "empty") return success([]);
  const bookmark: BookmarkedSnapshot = {
    ...INDIVIDUAL_SNAPSHOTS[0],
    isBookmarked: true,
    bookmarkedAt: "2026-03-02T09:00:00.000Z",
  };
  return success([bookmark]);
}

// ─── Analysis: status ───────────────────────────────────────
// 주의: 이 엔드포인트만 봉투 없이 raw `{ status }` 를 반환한다 (analysis-api 참고).

export function analysisStatus(): { status: AnalysisStatus } {
  return { status: "completed" };
}

// ─── Analysis: details ──────────────────────────────────────
// 상세 응답은 백엔드 raw 형태(매퍼가 방어적으로 흡수)를 모사한다.
// 진입 스모크(FRT-30 1차)는 상세 라우트를 제외하지만, FRT-28 범위상 형태를 제공한다.

export function individualDetail(): ApiSuccessResponse<Record<string, unknown>> {
  return success({
    id: "ind-1",
    status: "completed",
    experience_id: "exp-e2e-1",
    result: {
      itemName: "교내 개발 동아리 운영진",
      itemType: "club",
      briefSummary: "리더십과 기획 역량이 드러나는 경험.",
      deepAnalysis: {
        careerValue: "조직 운영 경험으로 협업 직무에 강점.",
        marketValue: "신입 기준 평균 이상.",
      },
      // FRT-271: 아래 세 갈래는 백엔드가 두는 자리와 표기를 그대로 흉내 낸다 —
      // applicable_roles 는 deep_analysis 밖 최상위, 강점은 item_strengths,
      // 한계는 item_diagnosis 안이다. 픽스처가 프런트 타입을 따라가면 계약 회귀를 못 잡는다.
      applicable_roles: ["PM", "기획자"],
      item_strengths: {
        has_genuine_strengths: true,
        one_line_strength_verdict: "운영을 맡아 이탈률을 낮춘 것이 핵심이다.",
        no_strength_reason: null,
        summarized_strengths: ["온보딩 체계를 새로 세운 경험"],
        strengths: [
          {
            id: 1,
            category: "경험_깊이",
            strength_level: "moderate",
            title: "온보딩 설계",
            analysis: "멘토링 프로그램을 신설해 신입 이탈을 줄였다.",
            evidence: "이탈률 30% 감소",
            career_impact: "조직을 굴러가게 만든 경험으로 읽힌다.",
            leverage_action: "프로그램 운영 절차를 한 장으로 정리하라.",
            showcase_example: null,
          },
        ],
        strongest_asset: "이탈률을 30% 낮춘 온보딩 개선",
        positioning_tip: "숫자를 먼저 말하고 과정을 뒤에 붙이세요.",
      },
      starFormat: {
        title: "동아리 운영",
        situation: "신입 이탈률이 높았다.",
        task: "온보딩 체계 개선이 필요했다.",
        action: "멘토링 프로그램을 신설했다.",
        result: "이탈률을 30% 낮췄다.",
      },
      itemDiagnosis: {
        oneLineVerdict: "근거가 비교적 충분한 경험.",
        limitations: ["정량 성과 부족"],
        weaknesses: [],
        missingElements: ["정량 지표"],
        rewriteSuggestion: "성과를 수치로 보강하세요.",
      },
      synergy_recommendations: [
        {
          priority: 1,
          category: "자격증",
          name: "정보처리기사",
          reason: "SW 직무 지원 시 서류 기본 요건을 채운다.",
          expected_effect: "서류 통과율 상승",
          estimated_duration: "3~6개월",
        },
      ],
      // v1.2: 실재성 검증에서 걸러낸 추천. 화면은 개수만 알린다.
      removed_recommendations: [
        {
          name: "사회분석사",
          category: "자격증",
          removed_reason: "실재하지 않는 자격증명",
        },
      ],
      // v1.2: action_plan 각 칸이 문자열 → { 기간, 마감일, 내용 } 객체.
      // 백엔드 normalize_time_fields() 가 절대 날짜를 덧씌운 형태를 그대로 흉내 낸다.
      action_plan: {
        단기: {
          기간: "2026-09-01 ~ 2026-12-01",
          마감일: "2026-12-01",
          내용: "운영 성과를 이탈률·참여율 같은 수치로 정리해 기록에 추가하세요.",
        },
        중기: {
          기간: "2026-12-01 ~ 2027-09-01",
          마감일: "2027-09-01",
          내용: "온보딩 설계 경험을 실제 팀 프로젝트 한 건에 적용해 재현되는지 확인하세요.",
        },
        장기: {
          기간: "2027-09-01 ~ 2029-09-01",
          마감일: "2029-09-01",
          내용: "조직 운영 사례를 묶어 리더십 포트폴리오로 정리하세요.",
        },
      },
      missingInfoWarning: "",
    },
  });
}

export function comprehensiveDetail(): ApiSuccessResponse<Record<string, unknown>> {
  return success({
    id: "comp-1",
    status: "completed",
    user_school: "ARC 대학교",
    user_department: "컴퓨터공학과",
    brief_summary: "협업과 기획 역량이 고르게 분포한다.",
    detailed_summary: "동아리 운영과 팀 프로젝트에서 일관된 주도성이 보인다.",
    keyword_clustering: {
      personality_tendency: ["주도적", "협력적"],
      core_competency: ["기획", "백엔드"],
      job_industry: ["IT 서비스"],
    },
    experience_insights: {
      motivation: "문제 해결에 대한 흥미.",
      learning_points: "협업 과정에서의 조율 역량.",
    },
    synergy_combinations: [],
    additional_recommendations: {
      certifications: [
        {
          name: "정보처리기사",
          reason: "SW 직무 기본 자격",
          expected_effect: "서류 통과 향상",
          estimated_duration: "3~6개월",
          url: null,
          issuer: "한국산업인력공단",
        },
      ],
      clubs_and_societies: [],
      projects_and_contests: [
        {
          name: "교내 해커톤",
          organizer: "ARC 대학교",
          reason: "실전 경험 보강",
          expected_effect: "협업 이력 확보",
          url: null,
          deadline: null,
          is_regular: true,
        },
      ],
    },
    resume_star_format: [],
    action_plan: {
      short_term: "정량 성과 정리",
      mid_term: "대외 활동 확장",
      long_term: "직무 포트폴리오 완성",
    },
    strength_diagnosis: {
      one_line_verdict: "협업·기획 축이 고르게 잡힌 포트폴리오.",
      strengths: [
        {
          id: 1,
          category: "직무_연관성",
          level: "strong",
          title: "협업 주도성",
          diagnosis: "동아리 운영에서 일관된 주도성이 확인됨.",
          evidence: "동아리 운영 이력",
          impact: "팀 직무 적합성 어필 가능",
          leverage_action: "운영 성과를 수치로 정리하세요.",
        },
      ],
      no_strength_diagnosis: {
        has_issue: false,
        reason: "",
        improvement_direction: "",
      },
      standout_experience_types: ["동아리 운영"],
      content_quality_highlights: [],
      competitor_advantage: "기획·백엔드 균형이 또렷함.",
    },
    critical_diagnosis: {
      one_line_verdict: "방향성은 뚜렷하나 정량 근거 보강 필요.",
      weaknesses: [],
      missing_experience_types: ["수상"],
      content_quality_issues: [],
      competitor_gap: "정량 성과에서 평균과 격차.",
    },
    verified_jobs: [],
    expired_jobs: [],
    missing_info_warning: "",
    schema_version: "comprehensive/2.0",
  });
}

export function keywordDetail(): ApiSuccessResponse<Record<string, unknown>> {
  return success({
    id: "kw-1",
    status: "completed",
    analysis_date: "2026-03-01T09:00:00.000Z",
    keywords: ["리더십"],
    target_scenario: "IT 기획 직무 지원",
    keyword_definitions: [
      {
        keyword: "리더십",
        definition: "구성원을 목표로 이끄는 역량.",
        synonyms: ["주도성"],
        compliance_criteria: ["조직 운영 경험"],
      },
    ],
    selection_criteria: {
      summary: "동아리 운영 경험을 중심으로 선정.",
      criteria: ["조직 규모", "역할"],
    },
    coverage: [
      { keyword: "리더십", related_count: 1, total_count: 2, coverage_percent: 50 },
    ],
    matched_experiences: [],
    storylines: [],
    improvement_guide: {
      information_enhancement: ["정량 성과를 추가하세요."],
      experience_expansion: [],
      keyword_specific_recommendations: [],
    },
  });
}

// ─── Resume (Export) ────────────────────────────────────────
// 목록(`GET /export/resume`)의 data 는 백엔드 계약대로 { count, contents } 래퍼다.

export interface ResumeListEnvelope {
  count: number;
  contents: { id: string; created_at: string; updated_at: string }[];
}

export function resumeList(
  scenario: StubScenario,
): ApiSuccessResponse<ResumeListEnvelope> {
  if (scenario === "empty") return success({ count: 0, contents: [] });
  const contents = [
    {
      id: "resume-e2e-1",
      created_at: "2026-03-10T09:00:00.000Z",
      updated_at: "2026-03-10T09:00:00.000Z",
    },
  ];
  return success({ count: contents.length, contents });
}

const RESUME_VERSION: ResumeVersion = {
  version_id: "resume-e2e-1",
  meta: {
    language: "ko",
    format: "json",
    generated_at: "2026-03-10T09:00:00.000Z",
    source_chars: 1200,
  },
  인적사항: {
    이름: "김아크",
    영문명: null,
    생년월일: null,
    이메일: "arc@example.com",
    전화번호: null,
    주소: null,
    링크: [],
  },
  학력: [
    {
      id: 1,
      학교명: "ARC 대학교",
      학과: "컴퓨터공학과",
      전공구분: "주전공",
      학위: "학사",
      입학년월: "2022-03",
      졸업년월: null,
      졸업구분: "재학중",
      학점: null,
      만점: null,
      비고: null,
    },
  ],
  경력: [],
  자격증: [],
  어학: [],
  대외활동: [],
  프로젝트: [],
  수상: [],
  기술및역량: { 기술스택: ["TypeScript"], 툴: [], 소프트스킬: ["협업"] },
  동아리_학회: [],
  연계성: [],
  자기소개_요약: "협업과 기획에서 주도성을 보여온 지원자입니다.",
  파싱경고: [],
};

export function resumeDetail(): ApiSuccessResponse<ResumeVersion> {
  return success(RESUME_VERSION);
}
