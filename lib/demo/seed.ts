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
    type: "personal-project",
    importance: 5,
    title: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측 프로젝트",
    summary:
      "Gemma-2 LLM을 활용해 비정형 뉴스 데이터를 정량적 투자 지표로 변환하고, SMA 기술 지표와 결합한 하이브리드 매매 전략을 연구·구현했어요.",
    tags: ["AI트레이딩", "LLM", "NLP", "백테스팅", "개인프로젝트"],
    status: "complete",
    createdAt: "2026-05-01T09:00:00Z",
    updatedAt: "2026-05-08T14:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-2",
    type: "team-project",
    importance: 4,
    title: "공공 데이터 포털 API 활용 버스 실시간 도착 정보 앱 개발",
    summary:
      "공공 데이터 포털 버스도착정보 API를 연동해 즐겨찾기 정류장의 실시간 도착 정보를 제공하는 Android 앱을 팀 프로젝트로 설계·구현했어요.",
    tags: ["Android", "팀프로젝트", "공공API", "모바일앱", "캡스톤"],
    status: "complete",
    createdAt: "2025-06-10T10:00:00Z",
    updatedAt: "2025-06-15T18:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-3",
    type: "extracurricular",
    importance: 4,
    title: "네이버 부스트캠프 AI Tech 6기 수료",
    summary:
      "딥러닝 이론부터 팀 프로젝트까지 약 5개월간 집중 수료한 AI 교육 과정으로, Wrap-up 프로젝트로 재활용 쓰레기 분류 Object Detection 모델(mAP 0.68)을 개발했어요.",
    tags: ["부스트캠프", "딥러닝", "ComputerVision", "ObjectDetection", "교육프로그램"],
    status: "complete",
    createdAt: "2025-11-10T12:00:00Z",
    updatedAt: "2025-11-15T11:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-4",
    type: "career",
    importance: 3,
    title: "학부 연구생 활동 — 자연어처리 연구실 (NLP Lab)",
    summary:
      "NLP 연구실 학부 인턴으로 참여해 한국어 혐오 표현 레이블링 가이드라인을 작성하고, KLUE-BERT 기반 이진 분류 파인튜닝 실험 파이프라인을 구성했어요.",
    tags: ["학부연구생", "NLP", "BERT", "혐오표현탐지", "연구실인턴"],
    status: "complete",
    createdAt: "2026-02-05T09:00:00Z",
    updatedAt: "2026-02-10T15:00:00Z",
  }),
  makeExperience({
    id: "exp-v2-5",
    type: "personal-project",
    importance: 3,
    title: "SQL 및 Tableau 활용 이커머스 매출 데이터 분석",
    summary:
      "Kaggle의 Brazilian E-Commerce(Olist) 데이터셋을 PostgreSQL로 분석하고 Tableau Public에 인터랙티브 대시보드를 배포한 포트폴리오 프로젝트예요.",
    tags: ["데이터분석", "SQL", "Tableau", "이커머스", "포트폴리오"],
    status: "complete",
    createdAt: "2026-01-15T11:00:00Z",
    updatedAt: "2026-01-20T18:00:00Z",
  }),
];

export const seedLibraries: LibraryDTO[] = [
  {
    id: "demo-lib-ai",
    name: "AI/ML 프로젝트",
    color: "#8B5CF6",
    icon: undefined,
    is_system: false,
    filter: null,
  },
  {
    id: "demo-lib-dev",
    name: "개발 & 교육",
    color: "#3B82F6",
    icon: undefined,
    is_system: false,
    filter: null,
  },
];

// 라이브러리별 멤버십 초기 상태
export const seedLibraryMembership: Record<string, string[]> = {
  "demo-lib-ai": ["exp-v2-1", "exp-v2-4", "exp-v2-5"],
  "demo-lib-dev": ["exp-v2-2", "exp-v2-3"],
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
    interest: ["AI/ML", "데이터분석", "백엔드"],
  },
  onboarded: true,
};

const DEMO_RESUME_ID = "demo-resume-1";

export const seedResume: ResumeVersion = {
  version_id: DEMO_RESUME_ID,
  meta: {
    language: "ko",
    format: "json",
    generated_at: "2026-05-08T15:00:00Z",
    source_chars: 5120,
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
      졸업년월: "2026-08",
      졸업구분: "졸업예정",
      학점: 3.72,
      만점: 4.5,
      비고: null,
    },
  ],
  경력: [
    {
      id: 1,
      회사명: "한양대학교 자연어처리 연구실",
      부서: "NLP Lab",
      직위: "학부 연구생",
      고용형태: "인턴",
      입사년월: "2025-09",
      퇴사년월: "2026-02",
      재직중: false,
      담당업무: [
        "한국어 혐오 표현 레이블링 가이드라인 작성 및 데이터 품질 관리",
        "KLUE-BERT 기반 이진 분류 파인튜닝 실험 파이프라인 구성",
        "Cohen's Kappa를 활용한 레이블러 간 일치도(IAA) 측정 스크립트 작성",
      ],
      성과: [
        "모호한 경계 사례 가이드라인 보완으로 IAA 0.61 → 0.78 개선",
        "random seed 고정 및 JSON 설정 파일 기반 실험 재현성 확보",
      ],
    },
  ],
  자격증: [
    {
      id: 1,
      자격증명: "SQLD",
      발급기관: "한국데이터산업진흥원",
      취득년월: "2025-04",
      자격구분: "자격증",
    },
  ],
  어학: [
    {
      id: 1,
      언어: "영어",
      시험명: "TOEIC",
      점수등급: "875",
      취득년월: "2024-09",
    },
  ],
  대외활동: [
    {
      id: 1,
      활동명: "네이버 부스트캠프 AI Tech 6기",
      기관: "네이버 커넥트재단",
      기간_시작: "2025-07-01",
      기간_종료: "2025-11-30",
      기간_원문: "2025.07 - 2025.11",
      진행중: false,
      역할: "CV 트랙 수강생",
      활동내용: [
        "PyTorch 기반 딥러닝 모델 학습 파이프라인 구축 실습",
        "YOLOv8, Faster R-CNN 등 Object Detection 모델 비교 실험",
        "Wandb를 활용한 실험 추적 및 하이퍼파라미터 관리",
      ],
      성과: [
        "재활용 쓰레기 분류 Object Detection 모델 mAP 0.68 달성",
        "WBF(Weighted Boxes Fusion) 앙상블로 단일 모델 대비 mAP 4%p 향상",
      ],
    },
  ],
  프로젝트: [
    {
      id: 1,
      프로젝트명: "LLM 활용 뉴스 감성 분석 기반 하이브리드 주가 예측",
      소속기관: "개인 프로젝트",
      기간_시작: "2026-02",
      기간_종료: "2026-05",
      기간_원문: "2026.02 - 2026.05",
      역할: "기획·개발 전담",
      사용기술: ["Python", "Gemma-2-2b-it", "Transformers", "yfinance", "Pandas", "Matplotlib"],
      내용: [
        "Google News RSS 연동 및 날짜별 뉴스 수집 파이프라인 구축",
        "Gemma-2-2b-it 모델로 뉴스 헤드라인 감성 수치화(Sentiment Scoring)",
        "SMA(20/60) 기술 지표와 뉴스 점수를 결합한 매수 신호 생성",
        "사용자 정의 리스크 관리(손절 3%, 익절 10%) 자동 시뮬레이션",
      ],
      성과: [
        "전략 수익률 vs 시장 수익률 비교 백테스팅 구현 및 시각화",
        "AI 환각 방지를 위한 max_new_tokens=10 결정론적 추론 적용",
      ],
    },
    {
      id: 2,
      프로젝트명: "공공 데이터 포털 API 활용 버스 실시간 도착 정보 앱",
      소속기관: "한양대학교 모바일 소프트웨어 설계 수업 팀 프로젝트",
      기간_시작: "2025-03",
      기간_종료: "2025-06",
      기간_원문: "2025.03 - 2025.06",
      역할: "Android 개발 (팀 프로젝트)",
      사용기술: ["Android", "Java", "Retrofit2", "Room DB", "공공 데이터 포털 API"],
      내용: [
        "공공 데이터 포털 버스도착정보 Open API 연동 및 파싱",
        "정류장 검색 및 즐겨찾기 저장/불러오기 (Room DB 활용)",
        "실시간 도착 정보 자동 갱신 (30초 폴링) 및 알림 기능 구현",
      ],
      성과: [
        "즐겨찾기 정류장만 선택적 폴링으로 불필요한 API 호출 최소화",
        "GitHub Flow 브랜치 전략 적용, 기능별 PR 리뷰 프로세스 운영",
      ],
    },
    {
      id: 3,
      프로젝트명: "이커머스 매출 데이터 분석 및 시각화",
      소속기관: "개인 프로젝트",
      기간_시작: "2025-12",
      기간_종료: "2026-01",
      기간_원문: "2025.12 - 2026.01",
      역할: "데이터 분석 및 시각화 전담",
      사용기술: ["PostgreSQL", "SQL", "Tableau Public", "Python", "Pandas"],
      내용: [
        "다중 테이블 JOIN 및 윈도우 함수를 활용한 고객 LTV·재구매율 계산",
        "배송 지연 일수와 리뷰 점수 간 상관관계 분석 쿼리 작성",
        "월별·카테고리별 매출 추이 집계 및 YoY 성장률 계산",
      ],
      성과: [
        "Tableau Public 대시보드 배포 (필터, 툴팁, KPI 카드 포함)",
        "분석 결과 기반 3가지 비즈니스 개선 제언 문서화",
      ],
    },
  ],
  수상: [],
  기술및역량: {
    기술스택: ["Python", "PyTorch", "SQL", "Java", "Android"],
    툴: ["Git", "Wandb", "Tableau", "Jupyter", "Google Colab"],
    소프트스킬: ["문제 해결", "데이터 기반 의사결정", "자기주도성"],
  },
  동아리_학회: [],
  연계성: [],
  자기소개_요약:
    "AI/ML과 데이터 분석을 두 축으로 성장해온 학생입니다. 실험 재현성과 정량적 검증에 집중하며, 공학적 분석으로 실세계 문제를 해결하는 일에 가장 큰 동기를 느낍니다.",
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
