// FRT-19: 핵심 퍼널 이벤트 이름·페이로드 타입의 단일 출처.
//
// autocapture 를 끄고(FRT-18) 명시 이벤트만 전송해 무료 티어의 이벤트 예산을
// "흐름 파악"에 집중한다. 완료 사실 자체는 DB(user·experience·analysis 행)에도 남지만,
// 가입→온보딩→기록→분석→export 를 PostHog 안에서 하나의 퍼널로 잇기 위해 완료 등뼈를
// 이벤트로 emit 한다. 단순 총량 집계는 DB(고객정보 API 등)로 넘겨 중복 계측을 피한다.

export type SignupMethod = "email" | "google";
// 개별(individual) 분석은 기록 저장 시 백엔드가 자동 생성 — 프론트에 "실행 완료" 관측
// 지점이 없어 완료 이벤트에서 제외한다(후속 FRT-107).
export type AnalysisKind = "comprehensive" | "keyword";
export type ExportType = "resume";
export type RecordStatus = "complete" | "draft";
// FRT-113: 증빙 첨부 수단. 파일 업로드와 링크(URL) 두 갈래뿐이다.
export type AttachmentType = "file" | "url";

export const ANALYTICS_EVENTS = {
  // ── 진입 (drop-off 관측: "들어왔지만 아무것도 안 함") ───────────────
  // 새 기록 입력 라우트 진입만 센다. 수정(edit) 진입을 섞으면
  // "진입 → 유형선택 → 저장" 퍼널의 이탈률이 왜곡된다(FRT-113).
  archiveEntryStarted: "archive_entry_started",
  // ── 직전 선택 (drop-off 관측: "선택했지만 완료 안 함") ─────────────
  signupMethodSelected: "signup_method_selected",
  archiveTypeSelected: "archive_type_selected",
  analysisTargetSelected: "analysis_target_selected",
  // ── 커스터마이징 실사용 (입력 허들 최소화 vs 자유도 검증) ────────────
  archiveAttachmentAdded: "archive_attachment_added",
  // ── 완료 등뼈 (퍼널 스파인) ────────────────────────────────────
  signupCompleted: "signup_completed",
  onboardingCompleted: "onboarding_completed",
  recordCreated: "record_created",
  firstRecordCreated: "first_record_created",
  analysisCompleted: "analysis_completed",
  exportCompleted: "export_completed",
  // ── 인앱 피드백 (FRT-92 전송 레이어가 emit) ───────────────────────
  feedbackSubmitted: "feedback_submitted",
  // ── placeholder: 이름·속성만 정의, emit 은 크레딧 과금 프로젝트(FRT-105)에서 ──
  // 크레딧 잔액·원장 UI 가 아직 없어 여기서는 배선하지 않는다(dead call site 금지).
  freeTokenExhausted: "free_token_exhausted",
  tokenPurchaseCompleted: "token_purchase_completed",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// 이벤트별 속성 계약. PII 금지 — 비식별 퍼널 메타만 싣는다.
export interface AnalyticsEventProps {
  archive_entry_started: Record<string, never>;
  signup_method_selected: { method: SignupMethod };
  archive_type_selected: { experience_type: string };
  analysis_target_selected:
    | { analysis_type: "comprehensive"; count: number }
    | { analysis_type: "keyword"; count: number; keyword_categories: string[] };
  signup_completed: { method: SignupMethod };
  onboarding_completed: Record<string, never>;
  record_created: { experience_type: string; status: RecordStatus };
  // 첨부 "여부"만 본다 — 파일명·URL 원문은 PII 위험이라 절대 싣지 않는다(타입으로 봉인).
  archive_attachment_added: { attachment_type: AttachmentType };
  first_record_created: { experience_type: string };
  analysis_completed: { analysis_type: AnalysisKind };
  export_completed: { export_type: ExportType; language: string };
  // 인앱 피드백 응답. PII 금지 — comment 원문·analysis_id 는 절대 싣지 않는다(서버에만 남긴다).
  // 리터럴 유니온을 인라인한다: lib/feedback/types.ts 가 이미 이 파일(AnalysisKind)을 import 하므로
  // 여기서 feedback 타입을 역참조하면 analytics ↔ feedback 순환이 된다. campaign_id 는 구조적으로
  // FeedbackCampaignId 와 동일해 transport 가 그대로 넘겨도 타입이 맞는다.
  feedback_submitted: {
    campaign_id: "analysis-satisfaction";
    trigger_source: "analysis_completed" | "experience_threshold";
    rating: 1 | 2 | 3 | 4 | 5;
    has_comment: boolean;
    analysis_type?: AnalysisKind;
  };
  // placeholder — 실제 emit 시 확정할 속성(참고용)
  free_token_exhausted: Record<string, never>;
  token_purchase_completed: { credits: number; amount: number };
}
