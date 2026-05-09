// 데모 모드 시드 데이터.
// - 새로고침 시 모듈이 다시 평가되어 자연스럽게 초기화된다.
// - 분석 결과는 기존 lib/api/mocks/analysis.ts 를 그대로 재사용한다.
// - 시드는 실제 화면이 렌더하는 필드만 채운다.

import type { Experience } from "@/types/experience";
import type { LibraryDTO } from "@/lib/utils/library-mapper";
import type { ResumeVersion } from "@/types/resume";
import type { AuthUser } from "@/types/auth";

const DEMO_USER_ID = "demo-user";

function makeExperience(args: {
  id: string;
  type: string;
  importance: number | null;
  title: string;
  summary: string;
  tags: string[];
  status: "draft" | "complete";
  createdAt: string;
  updatedAt: string;
}): Experience {
  return {
    id: args.id,
    user_id: DEMO_USER_ID,
    type: args.type,
    importance: args.importance,
    content: {
      title: args.title,
      summary: args.summary,
      status: args.status,
      tags: args.tags,
      coreBlocks: [],
      extensionBlocks: [],
      customBlocks: [],
    },
    created_at: args.createdAt,
    updated_at: args.updatedAt,
  };
}

export const seedExperiences: Experience[] = [
  makeExperience({
    id: "exp-v2-1",
    type: "career",
    importance: 5,
    title: "카카오 프론트엔드 인턴십",
    summary:
      "6개월간 카카오에서 프론트엔드 인턴으로 근무하며 신규 기능 개발과 성능 최적화를 주도했어요.",
    tags: ["인턴십", "프론트엔드", "성능 최적화"],
    status: "complete",
    createdAt: "2026-04-01T09:00:00Z",
    updatedAt: "2026-04-09T14:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-2",
    type: "team-project",
    importance: 4,
    title: "캡스톤 디자인 프로젝트",
    summary:
      "6인 팀 리더로서 서비스 기획부터 프로토타입까지 총괄하며 학과 우수상을 수상했어요.",
    tags: ["팀프로젝트", "리더십", "기획"],
    status: "complete",
    createdAt: "2026-03-15T10:00:00Z",
    updatedAt: "2026-04-02T18:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-3",
    type: "extracurricular",
    importance: 3,
    title: "데이터 분석 대외활동",
    summary:
      "공공 데이터를 활용해 SQL/Python 기반 분석 리포트를 작성하고 발표했어요.",
    tags: ["대외활동", "데이터 분석"],
    status: "complete",
    createdAt: "2026-02-20T12:00:00Z",
    updatedAt: "2026-03-05T11:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-4",
    type: "award",
    importance: 4,
    title: "교내 창업 경진대회 금상",
    summary: "교내 창업지원단 주최 경진대회에서 비즈니스 모델 기획으로 금상을 수상했어요.",
    tags: ["수상", "창업"],
    status: "complete",
    createdAt: "2026-01-10T09:00:00Z",
    updatedAt: "2026-01-15T15:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-5",
    type: "personal-project",
    importance: 3,
    title: "UX 리서치 프로젝트",
    summary: "12명 사용자 인터뷰를 통해 채용 앱의 핵심 페인 포인트 5가지를 도출했어요.",
    tags: ["UX", "리서치"],
    status: "complete",
    createdAt: "2025-12-01T11:00:00Z",
    updatedAt: "2025-12-20T18:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-6",
    type: "club",
    importance: 2,
    title: "동아리 운영 경험",
    summary: "30인 규모 동아리 운영진으로 활동하며 정기 세미나를 기획했어요.",
    tags: ["동아리", "운영"],
    status: "draft",
    createdAt: "2025-09-01T09:00:00Z",
    updatedAt: "2025-09-01T09:00:00Z",
  }),
];

export const seedLibraries: LibraryDTO[] = [
  {
    id: "demo-lib-job",
    name: "취업 준비",
    color: "#22C55E",
    icon: undefined,
    is_system: false,
    filter: null,
  },
  {
    id: "demo-lib-univ",
    name: "대학 활동",
    color: "#3B82F6",
    icon: undefined,
    is_system: false,
    filter: null,
  },
];

// 라이브러리별 멤버십 초기 상태
export const seedLibraryMembership: Record<string, string[]> = {
  "demo-lib-job": ["exp-v2-1", "exp-v2-4", "exp-v2-5"],
  "demo-lib-univ": ["exp-v2-2", "exp-v2-3", "exp-v2-6"],
};

export const seedDemoUser: AuthUser = {
  account: {
    email: "demo@story-arc.org",
    has_password: true,
    email_verified: true,
    connected_oauth: [],
  },
  profile: {
    name: "데모 사용자",
    birth: "2002-03-15",
    phone: "",
    education: "재학",
    school: "한양대학교",
    department: "컴퓨터소프트웨어학부",
    worry: [],
    interest: ["프론트엔드", "UX"],
  },
  onboarded: true,
};

const DEMO_RESUME_ID = "demo-resume-1";

export const seedResume: ResumeVersion = {
  version_id: DEMO_RESUME_ID,
  meta: {
    language: "ko",
    format: "json",
    generated_at: "2026-04-09T15:00:00Z",
    source_chars: 4820,
  },
  인적사항: {
    이름: "데모 사용자",
    영문명: "Demo User",
    생년월일: "2002-03-15",
    이메일: "demo@story-arc.org",
    전화번호: null,
    주소: null,
    링크: [
      { label: "GitHub", url: "https://github.com/demo" },
      { label: "Portfolio", url: "https://demo.story-arc.org" },
    ],
  },
  학력: [
    {
      id: 1,
      학교명: "한양대학교",
      학과: "컴퓨터소프트웨어학부",
      전공구분: "주전공",
      학위: "학사",
      입학년월: "2021-03",
      졸업년월: "2026-02",
      졸업구분: "졸업예정",
      학점: 3.85,
      만점: 4.5,
      비고: null,
    },
  ],
  경력: [
    {
      id: 1,
      회사명: "카카오",
      부서: "프론트엔드 개발팀",
      직위: "인턴",
      고용형태: "인턴",
      입사년월: "2024-07",
      퇴사년월: "2024-12",
      재직중: false,
      담당업무: [
        "주요 페이지 성능 최적화 작업 주도",
        "공통 컴포넌트 라이브러리 설계 참여",
      ],
      성과: [
        "주요 페이지 LCP 40% 개선, 이탈률 15% 감소",
        "팀 코드 리뷰 만족도 향상 및 후속 기능 개발 시간 30% 단축",
      ],
    },
  ],
  자격증: [
    {
      id: 1,
      자격증명: "SQLD",
      발급기관: "한국데이터산업진흥원",
      취득년월: "2024-04",
      자격구분: "자격증",
    },
  ],
  어학: [
    {
      id: 1,
      언어: "영어",
      시험명: "TOEIC",
      점수등급: "920",
      취득년월: "2025-09",
    },
  ],
  대외활동: [
    {
      id: 1,
      활동명: "데이터 분석 대외활동",
      기관: "공공데이터활용센터",
      기간_시작: "2026-02-20",
      기간_종료: "2026-03-05",
      기간_원문: "2026.02 - 2026.03",
      진행중: false,
      역할: "데이터 분석 트랙",
      활동내용: ["공공 데이터를 활용해 SQL/Python 기반 분석 리포트 작성"],
      성과: ["트랙 발표회 우수 발표상"],
    },
  ],
  프로젝트: [
    {
      id: 1,
      프로젝트명: "캡스톤 디자인 프로젝트",
      소속기관: "한양대학교",
      기간_시작: "2024-03",
      기간_종료: "2024-06",
      기간_원문: "2024.03 - 2024.06",
      역할: "팀장",
      사용기술: ["React", "Next.js", "TypeScript"],
      내용: [
        "6인 팀의 리더로 서비스 기획·디자인·개발 일정 총괄",
        "주간 회의 운영 및 직군 간 의견 조율",
      ],
      성과: ["학과 발표 우수상 수상"],
    },
    {
      id: 2,
      프로젝트명: "UX 리서치 프로젝트",
      소속기관: "개인 프로젝트",
      기간_시작: "2025-12",
      기간_종료: "2025-12",
      기간_원문: "2025.12",
      역할: "리서처",
      사용기술: ["Figma", "Notion"],
      내용: ["사용자 12명 인터뷰 및 어피니티 다이어그램 작성"],
      성과: ["채용 앱의 핵심 페인 포인트 5가지 도출"],
    },
  ],
  수상: [
    {
      id: 1,
      수상명: "교내 창업 경진대회 금상",
      수여기관: "한양대학교 창업지원단",
      수상년월: "2026-01",
      내용: "비즈니스 모델 기획 부문",
    },
  ],
  기술및역량: {
    기술스택: ["React", "Next.js", "TypeScript", "Node.js"],
    툴: ["Git", "Figma", "Notion"],
    소프트스킬: ["커뮤니케이션", "리더십", "문제 해결"],
  },
  동아리_학회: [
    {
      id: 1,
      단체명: "GDSC",
      구분: "동아리",
      기간_원문: "2023.09 - 2024.06",
      역할: "운영진",
      활동내용: ["프론트엔드 트랙 정기 세미나 기획 및 운영"],
    },
  ],
  연계성: [],
  자기소개_요약:
    "프론트엔드와 UX를 두 축으로 성장해온 학생입니다. 측정 가능한 성과를 만드는 일에 집중하며, 팀과의 협업 안에서 가설 검증과 실행을 반복합니다.",
  파싱경고: [],
};

export const seedResumeListItem = {
  version_id: DEMO_RESUME_ID,
  language: "ko" as const,
  generated_at: seedResume.meta.generated_at,
  summary_preview:
    seedResume.자기소개_요약 && seedResume.자기소개_요약.length > 50
      ? `${seedResume.자기소개_요약.slice(0, 50)}…`
      : seedResume.자기소개_요약,
};

export const DEMO_RESUME_VERSION_ID = DEMO_RESUME_ID;
