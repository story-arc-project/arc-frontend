// 데모 모드 시드 데이터.
// - 새로고침 시 모듈이 다시 평가되어 자연스럽게 초기화된다.
// - 분석 결과는 기존 lib/api/mocks/analysis.ts 를 그대로 재사용한다.
// - 시드는 실제 화면이 렌더하는 필드만 채운다.

import type { Experience } from "@/types/experience";
import type { LibraryDTO } from "@/lib/utils/library-mapper";
import type { ResumeVersion } from "@/types/resume";
import type { AuthUser } from "@/types/auth";
import type { Block } from "@/types/archive";

const DEMO_USER_ID = "demo-user";

// ─── Block 생성 헬퍼 ────────────────────────────────────────
// 시드는 정적 ID를 사용하므로 uid() 대신 직접 ID를 지정한다.

function blk(id: string, type: Block["type"], label: string, value: Block["value"], opts?: {
  required?: boolean;
  collapsed?: boolean;
  placeholder?: string;
  options?: string[];
}): Block {
  return { id, type, label, value, ...opts };
}

// ─── 공통 core block 생성 ────────────────────────────────────

function makeCoreBlocks(prefix: string, data: {
  경험명: string;
  기간: { start: string; end: string };
  한줄요약: string;
  내역할: string;
  핵심성과: string;
}): Block[] {
  return [
    blk(`${prefix}-c1`, "text", "경험명", { type: "text", text: data.경험명 }, { required: true }),
    blk(`${prefix}-c2`, "period", "기간", { type: "period", start: data.기간.start, end: data.기간.end, isCurrent: false }, { required: true }),
    blk(`${prefix}-c3`, "text", "한 줄 요약", { type: "text", text: data.한줄요약 }),
    blk(`${prefix}-c4`, "textarea", "내 역할/기여도", { type: "textarea", text: data.내역할 }),
    blk(`${prefix}-c5`, "textarea", "핵심 성과", { type: "textarea", text: data.핵심성과 }),
  ];
}

// ─── 경험 1: LLM 주가 예측 (personal-project) ───────────────

const exp1CoreBlocks = makeCoreBlocks("e1", {
  경험명: "주식 가격 분석 및 예측 프로젝트",
  기간: { start: "2026-02-01", end: "2026-05-31" },
  한줄요약: "Gemma-2 LLM을 활용해 비정형 뉴스 데이터를 정량적 투자 지표로 변환하고, 이를 통한 개인 투자자의 수익률 개선 가능성을 연구한 프로젝트",
  내역할: "기획·데이터 수집·모델 통합·백테스팅 설계까지 전 과정 독립 수행",
  핵심성과: "전략 수익률 vs 시장 수익률 비교 백테스팅 구현 및 시각화 완성. yfinance Multi-index 업데이트 오류를 get_level_values(0) 평탄화 로직으로 해결. AI 환각 방지를 위한 max_new_tokens=10 결정론적 추론 설정 적용.",
});

const exp1ExtBlocks: Block[] = [
  // pp-info 섹션
  blk("e1-p1", "text", "프로젝트명", { type: "text", text: "주식 가격 분석 및 예측 프로젝트" }, { required: true }),
  blk("e1-p2", "period", "기간", { type: "period", start: "2026-02-01", end: "2026-05-31", isCurrent: false }, { required: true }),
  blk("e1-p3", "text", "한 줄 설명", { type: "text", text: "Gemma-2 LLM을 활용해 비정형 뉴스 데이터를 정량적 투자 지표로 변환하고, 이를 통한 개인 투자자의 수익률 개선 가능성을 연구한 프로젝트" }, { required: true }),
  blk("e1-p4", "textarea", "목표/만들고 싶었던 이유", {
    type: "textarea",
    text: "정보 과잉 시대에 개인(소액) 투자자들이 가장 민감하게 반응하는 뉴스 정보가 실제 주가와 어떤 상관관계를 갖는지 공학적으로 증명하고자 함. 감정적 매매를 배제하고 AI의 객관적 분석과 기술적 지표를 결합한 '데이터 중심 의사결정 모델' 구축이 목표임.",
  }),
  blk("e1-p5", "textarea", "대상 사용자/사용 상황", {
    type: "textarea",
    text: "뉴스 정보에 의존도가 높으나 객관적 판단 기준이 부족한 개인 투자자. 장 시작 전 최신 뉴스 심리를 파악하여 투자 전략을 수립하거나, 변동성 장세에서 알고리즘에 기반한 기계적 리스크 관리(손절/익절)가 필요한 상황.",
  }),
  blk("e1-p6", "checklist", "주요 기능", {
    type: "checklist",
    options: [
      "Google News RSS 연동 및 날짜별 정밀 뉴스 수집",
      "Gemma-2-2b-it 모델을 이용한 뉴스 헤드라인 감성 수치화 (Sentiment Scoring)",
      "SMA(20/60) 기술적 지표와 뉴스 점수를 결합한 매수 신호 생성",
      "사용자 정의 리스크 관리 (손절 3%, 익절 10%) 자동 시뮬레이션",
      "전략 수익률 대비 시장 수익률 비교 백테스팅 및 시각화",
    ],
    checked: [
      "Google News RSS 연동 및 날짜별 정밀 뉴스 수집",
      "Gemma-2-2b-it 모델을 이용한 뉴스 헤드라인 감성 수치화 (Sentiment Scoring)",
      "SMA(20/60) 기술적 지표와 뉴스 점수를 결합한 매수 신호 생성",
      "사용자 정의 리스크 관리 (손절 3%, 익절 10%) 자동 시뮬레이션",
      "전략 수익률 대비 시장 수익률 비교 백테스팅 및 시각화",
    ],
  }),
  blk("e1-p7", "tags", "기술/도구", {
    type: "tags",
    tags: ["Python", "Gemma-2-2b-it", "Transformers", "yfinance", "Pandas", "NumPy", "Matplotlib", "Google News API", "Sentiment Analysis", "Backtesting"],
  }),
  // pp-decisions 섹션
  blk("e1-d1", "repeatable-cell", "설계/결정", {
    type: "repeatable-cell",
    columns: [
      { key: "topic", label: "결정 주제", blockType: "text", required: true },
      { key: "alternatives", label: "대안 비교", blockType: "textarea" },
      { key: "reason", label: "선택 이유", blockType: "textarea" },
      { key: "result", label: "결과/배운 점", blockType: "textarea" },
    ],
    rows: [
      {
        id: "e1-d1-r1",
        cells: {
          topic: "데이터 무결성 확보",
          alternatives: "yfinance 업데이트 후 Multi-index 반환 문제 → 직접 처리 vs 라이브러리 교체",
          reason: "라이브러리 교체 시 의존성 증가 우려, get_level_values(0) 평탄화로 최소 변경 해결",
          result: "오류 없이 OHLCV 데이터 안정적 수집 가능",
        },
      },
      {
        id: "e1-d1-r2",
        cells: {
          topic: "AI 환각 방지",
          alternatives: "다양한 max_new_tokens 설정 실험 vs 결정론적 추론 파라미터 고정",
          reason: "감성 점수가 -1/0/1 세 값만 필요하므로 max_new_tokens=10, greedy decoding 고정이 적합",
          result: "감성 점수 일관성 확보, 재현 가능한 실험 결과 도출",
        },
      },
    ],
  }, { collapsed: true }),
  blk("e1-d2", "textarea", "성과", {
    type: "textarea",
    text: "전략 수익률 vs 시장 수익률 비교 백테스팅 구현 및 시각화 완성. 감성 분석 기반 신호가 SMA 단독 전략 대비 특정 구간에서 수익률 개선 확인.",
  }),
  blk("e1-d3", "textarea", "다음 개선 계획", {
    type: "textarea",
    text: "다양한 종목·기간으로 백테스팅 확장, Buy & Hold 전략 대비 비교 기준선 추가, 거래 비용·슬리피지 가정 명시",
  }),
];

// ─── 경험 2: 스마트 버스 알리미 앱 (team-project) ─────────────

const exp2CoreBlocks = makeCoreBlocks("e2", {
  경험명: "스마트 버스 알리미 앱",
  기간: { start: "2025-03-01", end: "2025-06-30" },
  한줄요약: "공공 데이터 포털의 버스도착정보 API를 연동하여 즐겨찾기 정류장의 실시간 도착 정보를 제공하는 Android 앱",
  내역할: "모바일 소프트웨어 설계 수업 팀 프로젝트. 공공 API 연동 및 Room DB 기반 즐겨찾기 저장/불러오기 기능 담당.",
  핵심성과: "즐겨찾기 정류장만 선택적으로 폴링하여 불필요한 API 호출 최소화. GitHub Flow 브랜치 전략 적용, 기능별 PR 리뷰 프로세스 운영.",
});

const exp2ExtBlocks: Block[] = [
  // tp-info 섹션
  blk("e2-t1", "text", "프로젝트명", { type: "text", text: "스마트 버스 알리미 앱" }, { required: true }),
  blk("e2-t2", "period", "기간", { type: "period", start: "2025-03-01", end: "2025-06-30", isCurrent: false }, { required: true }),
  blk("e2-t3", "textarea", "팀 구성", {
    type: "textarea",
    text: "Android 개발 4인 팀 (모바일 소프트웨어 설계 수업 팀 프로젝트)",
  }),
  blk("e2-t4", "textarea", "내 역할", {
    type: "textarea",
    text: "공공 데이터 포털 버스도착정보 API 연동 및 파싱, Room DB 기반 즐겨찾기 저장/불러오기 기능 개발 담당",
  }, { required: true }),
  blk("e2-t5", "textarea", "목표/문제 정의", {
    type: "textarea",
    text: "실제 공공 API를 연동하는 경험을 쌓고 사용자 친화적인 UI/UX를 직접 설계·구현하는 것이 목표. 정류장 즐겨찾기, 알림 기능 등 실사용 환경을 고려한 기능 설계에 집중함.",
  }),
  blk("e2-t6", "textarea", "협업 방식", {
    type: "textarea",
    text: "GitHub Flow 브랜치 전략을 적용하여 기능별 PR 리뷰 프로세스 운영",
  }),
  blk("e2-t7", "textarea", "역할 분담표", {
    type: "textarea",
    text: "공공 API 연동(본인), UI/레이아웃 설계(팀원 A), 알림 기능(팀원 B), Room DB & 검색(팀원 C)",
  }),
  // tp-tasks 섹션
  blk("e2-w1", "repeatable-cell", "작업 기록", {
    type: "repeatable-cell",
    columns: [
      { key: "task", label: "작업/이슈명", blockType: "text", required: true },
      { key: "period", label: "기간", blockType: "text" },
      { key: "work", label: "내가 한 일", blockType: "textarea", required: true },
      { key: "result", label: "결과", blockType: "textarea" },
    ],
    rows: [
      {
        id: "e2-w1-r1",
        cells: {
          task: "공공 데이터 포털 버스도착정보 API 연동",
          period: "2025.03 - 2025.04",
          work: "Retrofit2로 Open API 호출, JSON 파싱 로직 구현",
          result: "정류장 번호 입력 시 실시간 버스 도착 정보 수신 성공",
        },
      },
      {
        id: "e2-w1-r2",
        cells: {
          task: "즐겨찾기 저장/불러오기 기능",
          period: "2025.04",
          work: "Room DB Entity·DAO·Repository 설계 및 구현. 즐겨찾기 추가/삭제 UI 연동.",
          result: "앱 재시작 후에도 즐겨찾기 목록 영속성 유지",
        },
      },
      {
        id: "e2-w1-r3",
        cells: {
          task: "실시간 도착 정보 자동 갱신",
          period: "2025.05",
          work: "30초 폴링 로직 구현. 즐겨찾기 정류장만 선택적으로 폴링하여 불필요한 API 호출 최소화.",
          result: "API 호출 횟수 약 60% 절감",
        },
      },
      {
        id: "e2-w1-r4",
        cells: {
          task: "도착 임박 버스 알림 기능",
          period: "2025.05 - 2025.06",
          work: "Android Notification API 연동, 3분 이하 도착 시 알림 발송 로직 구현",
          result: "백그라운드 알림 정상 동작 확인",
        },
      },
    ],
  }),
  blk("e2-w2", "textarea", "회고 (잘된 점/아쉬운 점/다음엔)", {
    type: "textarea",
    text: "잘된 점: API 호출 제한 대응으로 즐겨찾기 정류장만 선택적 폴링한 점, GitHub Flow로 충돌 없이 협업 진행.\n아쉬운 점: 알림 정확도가 네트워크 상태에 따라 불안정했음.\n다음엔: WorkManager 도입으로 백그라운드 작업 안정성 개선 예정.",
  }),
];

// ─── 경험 3: 네이버 부스트캠프 AI Tech 6기 (extracurricular) ──

const exp3CoreBlocks = makeCoreBlocks("e3", {
  경험명: "네이버 부스트캠프 AI Tech 6기",
  기간: { start: "2025-07-01", end: "2025-11-30" },
  한줄요약: "딥러닝 이론부터 실습, 팀 프로젝트까지 약 5개월간 집중 수료한 AI 교육 과정으로, Wrap-up 프로젝트로 재활용 쓰레기 분류 Object Detection 모델을 개발",
  내역할: "CV 트랙 수강생. YOLOv8·Faster R-CNN 모델 실험, WBF(Weighted Boxes Fusion) 앙상블 전략 설계 담당.",
  핵심성과: "재활용 쓰레기 분류 Object Detection 모델 mAP 0.68 달성. WBF 앙상블 적용으로 단일 모델 대비 mAP 약 4%p 향상. 데이터 불균형 해소를 위한 Mosaic Augmentation 및 Oversampling 전략 적용.",
});

const exp3ExtBlocks: Block[] = [
  // extra-info 섹션
  blk("e3-i1", "text", "활동명", { type: "text", text: "네이버 부스트캠프 AI Tech 6기" }, { required: true }),
  blk("e3-i2", "text", "주최/기관명", { type: "text", text: "네이버 커넥트재단" }),
  blk("e3-i3", "period", "기간", { type: "period", start: "2025-07-01", end: "2025-11-30", isCurrent: false }, { required: true }),
  blk("e3-i4", "text", "직책/역할", { type: "text", text: "CV 트랙 수강생" }, { required: true }),
  blk("e3-i5", "textarea", "지원 동기", {
    type: "textarea",
    text: "학교 수업만으로는 부족한 실전형 AI 프로젝트 경험을 채우고, 현업 수준의 코드 리뷰 문화와 협업 프로세스를 익히는 것이 목표였음. 특히 CV 트랙을 선택하여 Object Detection, Segmentation 등 비전 태스크에 집중하고자 함.",
  }),
  // extra-detail 섹션
  blk("e3-d1", "textarea", "담당 업무/미션", {
    type: "textarea",
    text: "PyTorch 기반 딥러닝 모델 학습 파이프라인 구축 실습. Object Detection Wrap-up 프로젝트: 재활용 쓰레기 분류 모델 개발.",
  }),
  blk("e3-d2", "repeatable-cell", "내가 한 일", {
    type: "repeatable-cell",
    columns: [
      { key: "action", label: "행동", blockType: "textarea" },
    ],
    rows: [
      { id: "e3-d2-r1", cells: { action: "Faster R-CNN, YOLOv8 등 다양한 백본 모델 실험 및 성능 비교" } },
      { id: "e3-d2-r2", cells: { action: "Wandb를 활용한 실험 추적 및 하이퍼파라미터 관리" } },
      { id: "e3-d2-r3", cells: { action: "소수 클래스에 대한 Mosaic Augmentation 및 Oversampling 전략 적용으로 데이터 불균형 해소" } },
      { id: "e3-d2-r4", cells: { action: "WBF(Weighted Boxes Fusion) 앙상블 전략 설계 및 적용" } },
      { id: "e3-d2-r5", cells: { action: "주 1회 피어 코드 리뷰 및 멘토 세션 참여" } },
    ],
  }),
  blk("e3-d3", "textarea", "협업/커뮤니케이션 방식", {
    type: "textarea",
    text: "주 1회 피어 코드 리뷰 세션 및 멘토 피드백 세션 참여. 실험 결과 공유를 위한 Wandb 대시보드 팀 공유.",
  }),
  blk("e3-d4", "repeatable-cell", "결과/성과", {
    type: "repeatable-cell",
    columns: [
      { key: "type", label: "성과 유형", blockType: "text" },
      { key: "metric", label: "수치", blockType: "text" },
      { key: "description", label: "설명", blockType: "textarea" },
    ],
    rows: [
      {
        id: "e3-d4-r1",
        cells: {
          type: "모델 성능",
          metric: "mAP 0.68",
          description: "재활용 쓰레기 분류 Object Detection Wrap-up 프로젝트 최종 성능",
        },
      },
      {
        id: "e3-d4-r2",
        cells: {
          type: "앙상블 효과",
          metric: "+4%p",
          description: "WBF 앙상블 적용으로 단일 최고 모델 대비 mAP 약 4%p 향상",
        },
      },
    ],
  }),
];

// ─── 경험 4: NLP 연구실 학부 인턴 (career) ───────────────────

const exp4CoreBlocks = makeCoreBlocks("e4", {
  경험명: "학부 연구생 활동 — 자연어처리 연구실 (NLP Lab)",
  기간: { start: "2025-09-01", end: "2026-02-28" },
  한줄요약: "NLP 연구실 학부 인턴으로 참여하여 혐오 표현 레이블링 가이드라인 작성과 KLUE-BERT 기반 분류 모델 실험 파이프라인 구성을 보조",
  내역할: "SNS 크롤링 데이터 전처리, 혐오 표현 레이블링 가이드라인 작성, IAA 측정 스크립트 구현, KLUE-BERT 파인튜닝 실험 파이프라인 구성",
  핵심성과: "모호한 경계 사례에 대한 예시 기반 가이드라인 보완으로 IAA 0.61 → 0.78 개선. random seed 고정 및 실험 조건을 JSON 설정 파일로 관리하여 실험 재현성 확보.",
});

const exp4ExtBlocks: Block[] = [
  // career-info 섹션
  blk("e4-i1", "text", "회사명", { type: "text", text: "한양대학교 자연어처리 연구실 (NLP Lab)" }, { required: true }),
  blk("e4-i2", "period", "재직기간", { type: "period", start: "2025-09-01", end: "2026-02-28", isCurrent: false }, { required: true }),
  blk("e4-i3", "single-select", "고용 형태", { type: "single-select", options: ["인턴", "계약직", "정규직", "프리랜서"], selected: "인턴" }),
  blk("e4-i4", "text", "직책/직급", { type: "text", text: "학부 연구생" }, { required: true }),
  blk("e4-i5", "text", "직무(업무분야)", { type: "text", text: "자연어처리 연구 보조" }, { required: true }),
  blk("e4-i6", "textarea", "지원 동기", {
    type: "textarea",
    text: "연구 환경에서의 실험 설계 및 논문 작성 방식을 직접 경험하고, 학교 수업에서 배운 NLP 이론을 실제 연구 문제에 적용해 보는 것이 목표였음. 특히 데이터 품질이 모델 성능에 미치는 영향을 실무적으로 이해하고자 함.",
  }),
  blk("e4-i7", "text", "팀/조직", { type: "text", text: "교수 1인, 대학원생 3인, 학부 연구생 2인" }),
  // career-tasks 섹션
  blk("e4-w1", "repeatable-cell", "업무내용", {
    type: "repeatable-cell",
    columns: [
      { key: "project", label: "프로젝트/업무명", blockType: "text", required: true },
      { key: "period", label: "세부 기간", blockType: "text" },
      { key: "role", label: "역할", blockType: "text", required: true },
      { key: "detail", label: "업무내용 상세", blockType: "textarea" },
      { key: "tools", label: "활용 툴", blockType: "text" },
      { key: "metrics", label: "성과 지표", blockType: "textarea" },
    ],
    rows: [
      {
        id: "e4-w1-r1",
        cells: {
          project: "SNS 크롤링 데이터 전처리 및 레이블링 가이드라인 작성",
          period: "2025.09 - 2025.11",
          role: "데이터 전처리 및 가이드라인 작성",
          detail: "SNS 크롤링 데이터 정제. 혐오 표현 레이블링 가이드라인 초안 작성 및 모호한 경계 사례에 대한 예시 기반 보완.",
          tools: "Python, Pandas, Google Sheets",
          metrics: "IAA 0.61 → 0.78 개선 (Cohen's Kappa 기준)",
        },
      },
      {
        id: "e4-w1-r2",
        cells: {
          project: "IAA 측정 스크립트 구현",
          period: "2025.10",
          role: "스크립트 개발",
          detail: "Cohen's Kappa를 활용한 레이블러 간 일치도(IAA) 자동 측정 스크립트 작성. 레이블러 쌍별 IAA 계산 및 리포트 생성 기능 구현.",
          tools: "Python, scikit-learn",
          metrics: "측정 자동화로 주간 IAA 모니터링 체계 구축",
        },
      },
      {
        id: "e4-w1-r3",
        cells: {
          project: "KLUE-BERT 이진 분류 파인튜닝 실험 파이프라인",
          period: "2025.11 - 2026.02",
          role: "실험 환경 구성 및 파이프라인 구현",
          detail: "KLUE-BERT 기반 이진 분류 파인튜닝 실험 환경 구성. 학습/검증/테스트 데이터 분리 및 교차 검증 파이프라인 구현. random seed 고정 및 JSON 설정 파일 기반 실험 재현성 확보.",
          tools: "Python, HuggingFace Transformers, KLUE-BERT, scikit-learn, Linux CLI",
          metrics: "실험 재현성 확보, 주간 미팅 발표 자료 준비",
        },
      },
    ],
  }),
];

// ─── 경험 5: 이커머스 데이터 분석 (personal-project) ─────────

const exp5CoreBlocks = makeCoreBlocks("e5", {
  경험명: "이커머스 매출 데이터 분석 및 시각화",
  기간: { start: "2025-12-01", end: "2026-01-31" },
  한줄요약: "Kaggle의 Brazilian E-Commerce(Olist) 데이터셋을 PostgreSQL로 분석하고 Tableau Public에 인터랙티브 대시보드를 배포한 포트폴리오 프로젝트",
  내역할: "데이터 분석 질문 설정, SQL 쿼리 작성, Tableau 대시보드 설계 및 배포, 비즈니스 인사이트 도출 전 과정 독립 수행",
  핵심성과: "Tableau Public 대시보드 배포(필터, 툴팁, KPI 카드 포함). 분석 결과 기반 3가지 비즈니스 개선 제언 문서화. 결측치 비율이 높은 컬럼은 제거 대신 별도 세그먼트로 분리 분석하여 정보 손실 최소화.",
});

const exp5ExtBlocks: Block[] = [
  // pp-info 섹션
  blk("e5-p1", "text", "프로젝트명", { type: "text", text: "이커머스 매출 데이터 분석 및 시각화" }, { required: true }),
  blk("e5-p2", "period", "기간", { type: "period", start: "2025-12-01", end: "2026-01-31", isCurrent: false }, { required: true }),
  blk("e5-p3", "text", "한 줄 설명", { type: "text", text: "Kaggle의 Brazilian E-Commerce(Olist) 데이터셋을 PostgreSQL로 분석하고 Tableau Public에 인터랙티브 대시보드를 배포한 포트폴리오 프로젝트" }, { required: true }),
  blk("e5-p4", "textarea", "목표/만들고 싶었던 이유", {
    type: "textarea",
    text: "데이터 분석 직무에 관심을 갖고 SQL과 시각화 도구 실력을 포트폴리오로 증명하고자 함. 단순 집계를 넘어 코호트 분석, 재구매율, 지역별 매출 등 비즈니스 관점의 분석 질문을 스스로 설정하고 답을 도출하는 연습을 목표로 함.",
  }),
  blk("e5-p5", "textarea", "대상 사용자/사용 상황", {
    type: "textarea",
    text: "이커머스 운영 담당자 또는 마케터. 제품 카테고리별 수익 기여도, 배송 지연과 리뷰 점수 간 상관관계 등을 한눈에 파악해야 하는 상황.",
  }),
  blk("e5-p6", "checklist", "주요 기능", {
    type: "checklist",
    options: [
      "다중 테이블 JOIN 및 윈도우 함수를 활용한 고객 LTV·재구매율 계산",
      "배송 지연 일수와 리뷰 점수 간 상관관계 분석 쿼리 작성",
      "월별·카테고리별 매출 추이 집계 및 YoY 성장률 계산",
      "Tableau Public 대시보드 제작 및 배포 (필터, 툴팁, KPI 카드 포함)",
      "분석 결과를 기반으로 한 3가지 비즈니스 개선 제언 문서화",
    ],
    checked: [
      "다중 테이블 JOIN 및 윈도우 함수를 활용한 고객 LTV·재구매율 계산",
      "배송 지연 일수와 리뷰 점수 간 상관관계 분석 쿼리 작성",
      "월별·카테고리별 매출 추이 집계 및 YoY 성장률 계산",
      "Tableau Public 대시보드 제작 및 배포 (필터, 툴팁, KPI 카드 포함)",
      "분석 결과를 기반으로 한 3가지 비즈니스 개선 제언 문서화",
    ],
  }),
  blk("e5-p7", "tags", "기술/도구", {
    type: "tags",
    tags: ["PostgreSQL", "SQL", "Tableau Public", "Python", "Pandas", "Kaggle", "Excel"],
  }),
  // pp-decisions 섹션
  blk("e5-d1", "repeatable-cell", "설계/결정", {
    type: "repeatable-cell",
    columns: [
      { key: "topic", label: "결정 주제", blockType: "text", required: true },
      { key: "alternatives", label: "대안 비교", blockType: "textarea" },
      { key: "reason", label: "선택 이유", blockType: "textarea" },
      { key: "result", label: "결과/배운 점", blockType: "textarea" },
    ],
    rows: [
      {
        id: "e5-d1-r1",
        cells: {
          topic: "결측치 처리 방식",
          alternatives: "결측치 비율이 높은 컬럼 제거 vs 별도 세그먼트로 분리 분석",
          reason: "정보 손실을 최소화하고 결측치 자체가 인사이트가 될 수 있다고 판단",
          result: "결측 세그먼트 분석에서 배송 미완료 건의 패턴 발견",
        },
      },
      {
        id: "e5-d1-r2",
        cells: {
          topic: "대시보드 UX 방향",
          alternatives: "기술 용어 그대로 사용 vs 비즈니스 용어로 레이블 통일",
          reason: "비개발자인 이커머스 운영 담당자가 주요 사용자이므로 비즈니스 용어 선택",
          result: "가독성 향상, 비즈니스 관점 커뮤니케이션 역량 어필",
        },
      },
    ],
  }, { collapsed: true }),
  blk("e5-d2", "textarea", "성과", {
    type: "textarea",
    text: "배송 지연 일수 증가 시 리뷰 점수 평균 1.2점 하락 확인. 상위 3개 카테고리가 전체 매출의 48% 차지. 3가지 비즈니스 개선 제언(배송 최적화, 카테고리 집중 전략, 재구매 프로모션) 문서화 완료.",
  }),
  blk("e5-d3", "textarea", "다음 개선 계획", {
    type: "textarea",
    text: "예측 모델(회귀 분석) 추가로 배송 지연 예측 기능 구현. 실시간 업데이트 파이프라인 연결 검토.",
  }),
];

// ─── Experience 조립 ─────────────────────────────────────────

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
  coreBlocks: Block[];
  extensionBlocks: Block[];
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
      coreBlocks: args.coreBlocks,
      extensionBlocks: args.extensionBlocks,
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
    coreBlocks: exp1CoreBlocks,
    extensionBlocks: exp1ExtBlocks,
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
    coreBlocks: exp2CoreBlocks,
    extensionBlocks: exp2ExtBlocks,
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
    coreBlocks: exp3CoreBlocks,
    extensionBlocks: exp3ExtBlocks,
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
    coreBlocks: exp4CoreBlocks,
    extensionBlocks: exp4ExtBlocks,
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
    coreBlocks: exp5CoreBlocks,
    extensionBlocks: exp5ExtBlocks,
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
