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
export type ExportType = "resume" | "cover_letter";
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
  // ── 복구 행동 (실패에서 빠져나오는가) ────────────────────────────
  // 이벤트 정의서의 comprehensive_analysis_retried / keyword_analysis_retried 는
  // "동일 조합 재요청"으로 실패 재시도와 성공 후 재활용을 섞어 정의했다.
  // FRT-108 은 실패 전용으로 좁히므로 이름을 하나로 합치고 analysis_type 으로 가른다
  // (analysis_completed 와 같은 결). 성공 건 재실행은 새 분석이라 여기 안 실린다.
  analysisRetried: "analysis_retried",
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
  // analysis_id — 같은 완료를 두 곳에서 관측할 수 있어(목록을 두 탭·두 기기에 열어두면 각
  // 화면이 독립적으로 전이를 본다) 이벤트만으로는 중복을 가려낼 수 없다. 서버 식별자를 실어
  // 다운스트림에서 접을 수 있게 한다. 경로에 이미 드러나는 값이라 새 노출면이 아니다.
  analysis_completed: { analysis_type: AnalysisKind; analysis_id: string };
  // 실패한 분석의 재시도 요청이 접수된 시점. 재시도 결과(성공/재실패)는
  // analysis_completed 와 status 로 따로 관측한다.
  analysis_retried: { analysis_type: AnalysisKind };
  // experience_count — 사용자가 레쥬메에 넣기로 고른 경험 수(FRT-109). 선택 UI 가 꺼져 있으면
  // "고른" 개념 자체가 없으므로 싣지 않는다(0 이 아니라 부재).
  // 익스포트 종류마다 의미 있는 속성이 다르다 — 레쥬메는 언어(국문/영문), 자소서는 문항 수다.
  // 하나의 넓은 객체로 합치면 language 를 optional 로 풀어야 하고, 그러면 레쥬메 호출부가
  // 언어를 빠뜨려도 타입이 통과한다. 판별 유니온으로 각 종류의 필수 속성을 지킨다.
  export_completed:
    | {
        export_type: "resume";
        language: string;
        // 사용자가 레쥬메에 넣기로 고른 경험 수(FRT-109). 선택 UI 가 꺼져 있으면
        // "고른" 개념 자체가 없으므로 싣지 않는다(0 이 아니라 부재).
        experience_count?: number;
      }
    | {
        export_type: "cover_letter";
        // 사용자가 직접 넣은 문항 수(FRT-140). 0 이면 자유 형식 1건으로 생성된다 —
        // 0 과 부재가 다른 뜻이라 optional 이 아니라 필수다.
        question_count: number;
      };
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
