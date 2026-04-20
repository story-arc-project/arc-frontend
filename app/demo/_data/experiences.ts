import type { Block, ExperienceV2, ExperienceTypeId, ImportanceLevel } from "@/types/archive";

interface ExperienceSeed {
  id: string;
  typeId: ExperienceTypeId;
  title: string;
  summary: string;
  importance: ImportanceLevel;
  period: { start: string; end: string; isCurrent?: boolean };
  role: string;
  achievement: string;
  tags: string[];
  extension: {
    background?: string;
    action?: string;
    result?: string;
    lesson?: string;
    skills?: string[];
    team?: string;
  };
  createdAt: string;
  updatedAt: string;
}

function textBlock(id: string, label: string, text: string, placeholder?: string, required?: boolean): Block {
  return {
    id,
    type: "text",
    label,
    required,
    placeholder,
    value: { type: "text", text },
  };
}

function textareaBlock(id: string, label: string, text: string, placeholder?: string): Block {
  return {
    id,
    type: "textarea",
    label,
    placeholder,
    value: { type: "textarea", text },
  };
}

function periodBlock(id: string, label: string, start: string, end: string, isCurrent = false): Block {
  return {
    id,
    type: "period",
    label,
    required: true,
    value: { type: "period", start, end, isCurrent },
  };
}

function tagsBlock(id: string, label: string, tags: string[]): Block {
  return {
    id,
    type: "tags",
    label,
    value: { type: "tags", tags },
  };
}

function fileBlock(id: string, label: string, fileName = ""): Block {
  return {
    id,
    type: "file",
    label,
    value: { type: "file", fileName, description: "", evidenceType: "" },
  };
}

function buildExperience(seed: ExperienceSeed): ExperienceV2 {
  const coreBlocks: Block[] = [
    textBlock(`${seed.id}-title`, "경험명", seed.title, "경험의 이름을 입력하세요", true),
    periodBlock(`${seed.id}-period`, "기간", seed.period.start, seed.period.end, seed.period.isCurrent),
    textBlock(`${seed.id}-summary`, "한 줄 요약", seed.summary, "이 경험을 한 줄로 요약해주세요"),
    textareaBlock(`${seed.id}-role`, "내 역할/기여도", seed.role, "내가 맡은 역할과 기여한 부분을 작성해주세요"),
    textareaBlock(`${seed.id}-achievement`, "핵심 성과", seed.achievement, "주요 성과나 결과를 작성해주세요"),
    fileBlock(`${seed.id}-evidence`, "증빙 자료"),
  ];

  const ext: Block[] = [];
  if (seed.extension.background) {
    ext.push(textareaBlock(`${seed.id}-bg`, "배경/목표", seed.extension.background, "이 경험의 배경이나 목표를 설명해주세요"));
  }
  if (seed.extension.action) {
    ext.push(textareaBlock(`${seed.id}-act`, "내가 한 행동", seed.extension.action, "구체적으로 어떤 행동을 했는지 작성해주세요"));
  }
  if (seed.extension.result) {
    ext.push(textareaBlock(`${seed.id}-res`, "결과/성과", seed.extension.result, "어떤 결과를 얻었는지 작성해주세요"));
  }
  if (seed.extension.lesson) {
    ext.push(textareaBlock(`${seed.id}-les`, "배운 점", seed.extension.lesson, "이 경험에서 배운 점을 작성해주세요"));
  }
  if (seed.extension.skills && seed.extension.skills.length > 0) {
    ext.push(tagsBlock(`${seed.id}-skills`, "사용한 스킬", seed.extension.skills));
  }
  if (seed.extension.team) {
    ext.push(textBlock(`${seed.id}-team`, "협업/팀", seed.extension.team));
  }

  return {
    id: seed.id,
    userId: "demo-user",
    typeId: seed.typeId,
    title: seed.title,
    summary: seed.summary,
    status: "complete",
    tags: seed.tags,
    importance: seed.importance,
    coreBlocks,
    extensionBlocks: ext,
    customBlocks: [],
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
  };
}

const seeds: ExperienceSeed[] = [
  {
    id: "exp-1",
    typeId: "career",
    title: "오늘의 집 마케팅 인턴",
    summary: "인테리어 플랫폼의 퍼포먼스 마케팅 팀에서 GA4 기반 캠페인 분석·실행",
    importance: 5,
    period: { start: "2025-09-01", end: "2025-11-30" },
    role: "퍼포먼스 마케팅팀 인턴으로서 신규 고객 대상 메타·구글 광고 캠페인 4건을 운영하고, GA4 데이터로 세그먼트별 CAC를 주간으로 리포트했습니다.",
    achievement: "A/B 소재 실험을 통해 메인 캠페인 CTR을 2.1% → 3.4%로 개선했고, CAC를 평균 18% 절감. 주차별 마케팅 위클리 리포트 템플릿을 구축해 팀에 인수인계했습니다.",
    tags: ["퍼포먼스마케팅", "GA4", "캠페인분석", "인턴"],
    extension: {
      background: "성장기 소비자 유입이 둔화되는 상황에서, 데이터 기반으로 캠페인 효율을 끌어올리는 것이 팀의 3분기 KR이었습니다.",
      action: "주간 단위로 캠페인별 UTM 체계를 정리하고, 저효율 크리에이티브를 식별해 라이터·디자이너에게 근거 있는 피드백을 전달했습니다.",
      result: "CTR 1.3%p 상승, CAC 18% 절감. 정규직 전환 제안(TO 사정으로 불발)을 받음.",
      lesson: "가설 검증 주기를 짧게 가져가는 것이 장기 효율을 만든다는 걸 체감했습니다. 특히 디자이너와 숫자로 이야기하는 습관이 협업 품질을 바꿨습니다.",
      skills: ["GA4", "Meta Ads", "Google Ads", "Looker Studio", "SQL 기초"],
      team: "퍼포먼스 마케팅팀 6명 (PM 1 · 마케터 3 · 디자이너 2)",
    },
    createdAt: "2025-09-02T09:00:00Z",
    updatedAt: "2025-12-04T17:30:00Z",
  },
  {
    id: "exp-2",
    typeId: "club",
    title: "교내 창업동아리 '브랜드랩' 운영진",
    summary: "경영·디자인·공학 18명 운영진을 이끌며 시즌 프로젝트를 기획·운영",
    importance: 4,
    period: { start: "2024-03-01", end: "2025-02-28" },
    role: "운영진 부대표로서 주간 전체 회의 진행, 신규 단원 온보딩, 학기 단위 프로젝트 주제 선정과 리소스 배분을 담당했습니다.",
    achievement: "2개 학기 동안 팀 프로젝트 12개를 런칭. 외부 파트너사 3곳(스타트업)과 실전 브리프 연결. 동아리 지원 인원이 전년 대비 1.6배 증가했습니다.",
    tags: ["리더십", "동아리", "운영", "브랜딩"],
    extension: {
      background: "학기마다 방향성이 흩어져 결과물이 쌓이지 않는 것이 고질적 문제였고, 운영 구조를 갈아야 했습니다.",
      action: "학기 전 OKR을 운영진과 함께 정의하고, 주간 진척 회고를 격주로 운영했습니다. 신입 단원에게는 3주 버디 프로그램을 신설했습니다.",
      result: "프로젝트 완주율 55% → 83%. 기업 파트너 3곳과의 브리프 협업이 모두 데모데이까지 완주되었습니다.",
      lesson: "리더십은 통제가 아니라 구조 설계라는 것을 배웠습니다. 개인을 관리하기보다 주간 리듬을 만드는 것이 효과가 컸습니다.",
      skills: ["프로젝트 매니징", "퍼실리테이션", "OKR"],
      team: "운영진 8명 · 단원 18명",
    },
    createdAt: "2024-03-10T10:00:00Z",
    updatedAt: "2025-02-28T18:00:00Z",
  },
  {
    id: "exp-3",
    typeId: "award",
    title: "유한킴벌리 대학생 마케팅 공모전 2위",
    summary: "Z세대 생리대 리브랜딩 전략으로 전국 298팀 중 2위 수상",
    importance: 4,
    period: { start: "2025-04-01", end: "2025-06-30" },
    role: "4인 팀의 전략 리더로서 시장/경쟁사/소비자 조사 총괄, 최종 프레젠테이션 발표자 역할을 맡았습니다.",
    achievement: "서베이(N=412) + FGI(n=8)로 도출한 인사이트를 기반으로 '매일이 다르니까' 캠페인 컨셉을 제안, 최종 심사에서 2위(특별상·상금 300만원) 수상.",
    tags: ["공모전", "브랜딩", "Z세대", "수상"],
    extension: {
      background: "해당 제품군은 가격 경쟁이 심화되고 있고, 브랜드 충성도보다 편의성에 소비가 기울고 있다는 문제 인식에서 출발.",
      action: "시장 데스크 리서치 → 타겟 서베이 설계·집행 → FGI 진행 → 인사이트 정리 → 컨셉 및 IMC 플랜 제안 순으로 진행했습니다.",
      result: "2위 수상. 유한킴벌리 브랜드 매니저 멘토링 세션에 초청받아 현업 피드백을 받음.",
      lesson: "사용자 목소리를 숫자 없이 쓰면 설득이 안 된다는 것을 배웠습니다. 정성 인사이트와 정량 근거를 함께 엮는 구조가 필요합니다.",
      skills: ["소비자 조사", "브랜드 전략", "프레젠테이션", "FGI"],
      team: "4인 팀 (경영 2 · 디자인 1 · 심리 1)",
    },
    createdAt: "2025-04-05T09:00:00Z",
    updatedAt: "2025-07-02T15:00:00Z",
  },
  {
    id: "exp-4",
    typeId: "education",
    title: "네이버 부스트캠프 마케팅 데이터 분석 트랙 수료",
    summary: "8주 과정에서 SQL · GA4 · Looker Studio 실전 과제 수행",
    importance: 3,
    period: { start: "2025-01-06", end: "2025-02-28" },
    role: "수강생으로서 8주간 주 20시간 과제·프로젝트 참여. 최종 팀 프로젝트 리드 분석가 역할.",
    achievement: "커머스 가상 데이터셋(5만 행)으로 코호트 리텐션 분석 대시보드 구축, 수료 평가 상위 12% 달성.",
    tags: ["SQL", "GA4", "부트캠프", "데이터분석"],
    extension: {
      action: "주차별 라이브 세션 + 자율 미션을 병행하고, 주말마다 스터디 팀원들과 과제 리뷰를 진행했습니다.",
      result: "우수 수료 뱃지 획득. 과제 중 작성한 코호트 분석 노트가 네이버 부스트캠프 블로그에 예시로 소개됨.",
      lesson: "'데이터를 볼 줄 안다'는 것은 쿼리를 짠다는 뜻이 아니라, 의사결정에 쓸 수 있게 가공한다는 뜻임을 다시 배웠습니다.",
      skills: ["SQL", "GA4", "Looker Studio", "Python(pandas)"],
    },
    createdAt: "2025-01-06T09:00:00Z",
    updatedAt: "2025-02-28T18:00:00Z",
  },
  {
    id: "exp-5",
    typeId: "personal-project",
    title: "개인 브랜드 블로그 'minji.log' 운영",
    summary: "마케팅 케이스 스터디 연재 28편, 2년간 누적 방문 8.2만",
    importance: 3,
    period: { start: "2023-09-01", end: "2026-04-18", isCurrent: true },
    role: "기획·취재·집필·디자인·유통까지 1인 운영. SEO 키워드 연구 기반 주 1~2회 발행.",
    achievement: "누적 방문 82,400회, 상위 트래픽 글 3편의 평균 체류시간 4분 20초. 국내 브랜드 PR팀에서 콘텐츠 인용 요청 2건을 받음.",
    tags: ["콘텐츠", "브랜딩", "SEO", "개인프로젝트"],
    extension: {
      background: "공부한 케이스를 휘발시키지 않기 위해 시작했고, 생각을 공개적으로 쓰면서 구조화하는 훈련을 의도했습니다.",
      action: "월간 에디토리얼 캘린더 운영, 네이버·구글 검색 키워드를 매주 점검, 상위 노출 글은 2~3개월 후 업데이트 편집.",
      result: "월평균 방문 3,800회. 2025년 기준 상위 유입 키워드 12개가 검색 3페이지 내 안착.",
      lesson: "지속 가능한 생산 리듬이 콘텐츠 품질보다 더 중요한 변수라는 걸 배웠습니다.",
      skills: ["콘텐츠 기획", "SEO", "Notion", "Figma"],
    },
    createdAt: "2023-09-04T10:00:00Z",
    updatedAt: "2026-04-18T10:00:00Z",
  },
  {
    id: "exp-6",
    typeId: "certification",
    title: "Google Analytics 개인 자격증 (GAIQ)",
    summary: "GA4 중심의 측정 설계·리포팅 자격 취득",
    importance: 3,
    period: { start: "2025-03-15", end: "2025-03-20" },
    role: "단독 준비 · 시험 응시",
    achievement: "GAIQ 자격증 취득 (유효기간 1년). 부스트캠프 학습 내용을 시험 대비로 정리하면서 체계적으로 복습.",
    tags: ["자격증", "GA4", "데이터분석"],
    extension: {
      lesson: "GA 이벤트 구조를 조직 관점에서 어떻게 설계해야 하는지를 정리할 수 있었습니다.",
      skills: ["GA4", "이벤트 태깅"],
    },
    createdAt: "2025-03-20T14:00:00Z",
    updatedAt: "2025-03-20T14:00:00Z",
  },
  {
    id: "exp-7",
    typeId: "volunteer",
    title: "종로구 소상공인 SNS 마케팅 봉사",
    summary: "동네 가게 6곳의 인스타그램 운영·컨설팅 봉사 프로젝트",
    importance: 3,
    period: { start: "2024-07-01", end: "2024-08-31" },
    role: "2인 팀으로 지역 소상공인 매장 6곳을 담당해 콘텐츠 기획·촬영·캡션·해시태그 전략을 제공했습니다.",
    achievement: "평균 팔로워 +142%, 일 평균 스토리 조회 수 +3배. 2개 매장에서 여름 한정 메뉴가 지역 매체에 소개되는 효과.",
    tags: ["봉사", "SNS마케팅", "지역", "실전"],
    extension: {
      action: "매장별 포지셔닝 진단 → 주 3회 콘텐츠 제작 → 일 2회 스토리 업로드 → 주간 리포트 공유.",
      result: "팔로워 평균 1.4배 증가, 가맹주 재요청 4건.",
      lesson: "작은 예산에서도 맥락에 맞는 콘텐츠는 전환을 만든다는 걸 현장에서 배웠습니다.",
      skills: ["인스타그램", "콘텐츠 제작", "Figma"],
    },
    createdAt: "2024-07-05T09:00:00Z",
    updatedAt: "2024-09-01T18:00:00Z",
  },
  {
    id: "exp-8",
    typeId: "language",
    title: "TOEIC 920점 · 교환학생 준비",
    summary: "2026년 가을 미국 교환학생 지원을 위한 어학 준비",
    importance: 2,
    period: { start: "2025-05-01", end: "2025-10-20" },
    role: "단독 학습, 주 3회 스터디 그룹 운영 리더",
    achievement: "TOEIC 820 → 920점 (5개월). 교환학생 학과 선발에서 영어 트랙 합격.",
    tags: ["어학", "TOEIC", "교환학생"],
    extension: {
      lesson: "긴 목표를 작은 주간 루틴으로 쪼개야 유지된다는 것을 다시 체감.",
      skills: ["영어", "학습 설계"],
    },
    createdAt: "2025-05-03T09:00:00Z",
    updatedAt: "2025-10-22T20:00:00Z",
  },
  {
    id: "exp-9",
    typeId: "extracurricular",
    title: "경영대 학생회 홍보부 차장",
    summary: "학생회 SNS 운영·학과 행사 홍보 기획",
    importance: 2,
    period: { start: "2024-03-01", end: "2024-12-31" },
    role: "홍보부 차장으로 SNS 채널(IG·카카오) 운영 + 학과 공식 행사 4회 홍보 기획을 담당.",
    achievement: "학과 SNS 팔로워 2,100 → 3,400. MT·신입생 환영회 참여율 전년 대비 22%p 상승.",
    tags: ["학생회", "SNS", "홍보"],
    extension: {
      skills: ["SNS 운영", "포스터 디자인(Figma)"],
      team: "홍보부 5명",
    },
    createdAt: "2024-03-05T09:00:00Z",
    updatedAt: "2024-12-31T18:00:00Z",
  },
];

export const demoExperiences: ExperienceV2[] = seeds.map(buildExperience);

export const experienceById = (id: string): ExperienceV2 | undefined =>
  demoExperiences.find((e) => e.id === id);
