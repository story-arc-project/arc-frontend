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
// FRT-114: 레쥬메를 손에서 꺼내가는 수단. 인쇄는 파일이 떨어지지 않지만 "결과물을
// 꺼내가는 행동"은 같아서 같은 이벤트에 싣고 여기서만 가른다 — 안 실으면 그 행동은
// 영영 데이터에 남지 않는다(다운스트림에서 접는 건 언제든 가능).
export type ResumeExportFormat = "pdf" | "docx" | "print";
// FRT-114: 편집 저장이 실제로 어디까지 갔는가. 서버 저장(FRT-111)이 아직 계약 진행 중이라
// 사용자에게는 "저장/임시 저장했어요"가 뜨는데 서버엔 아무것도 안 남는 경로가 실재한다.
// 이걸 뭉치면 관리자가 보는 "저장 건수"가 거짓이 된다.
// exit_draft — 저장 버튼을 누르지 않고 화면을 떠나 페이지가 대신 임시 저장한 경우.
// 사용자 의사로는 '저장'이 아니지만 편집이 어디까지 갔느냐는 같은 질문이라 같은 이벤트에
// 싣고 outcome 으로만 가른다. 빼면 안전하게 보관된 편집이 유실된 편집과 구별되지 않는다.
export type ResumeSaveOutcome =
  | "server"
  | "unsupported"
  | "failed"
  | "exit_draft";
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
  // FRT-114. 실행 직전 최종 선택만 센다(analysis_target_selected 와 같은 결) — 체크박스
  // 토글마다 쏘면 이벤트가 폭증하고, 실행 직전 1회여야 "골랐지만 생성이 실패함"이 남는다.
  resumeExperienceSelected: "resume_experience_selected",
  // ── 커스터마이징 실사용 (입력 허들 최소화 vs 자유도 검증) ────────────
  archiveAttachmentAdded: "archive_attachment_added",
  // ── 완료 등뼈 (퍼널 스파인) ────────────────────────────────────
  signupCompleted: "signup_completed",
  onboardingCompleted: "onboarding_completed",
  recordCreated: "record_created",
  firstRecordCreated: "first_record_created",
  analysisCompleted: "analysis_completed",
  exportCompleted: "export_completed",
  // ── 익스포트 이후 행동 (FRT-114) ───────────────────────────────────
  // export_completed 까지만 보면 "만들어놓고 안 쓰는지"가 안 보인다. 결과물을 실제로
  // 꺼내갔는지(다운로드), AI 초안을 얼마나 고쳐 쓰는지(편집·저장)를 여기서 잡는다.
  resumeDownloaded: "resume_downloaded",
  resumeEdited: "resume_edited",
  resumeEditSaved: "resume_edit_saved",
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
  // FRT-114: 레쥬메에 넣을 경험을 고른 시점(생성 요청 직전). export_completed 의
  // experience_count 와 겹쳐 보이지만 순증 가치가 둘 있다 — ① 어떤 **유형**을 "낼 만하다"고
  // 판단하는지 ② 생성 요청이 실패해도 선택 사실이 남는다(export_completed 는 성공 시에만 뜬다).
  // experience_types 는 유형 id 목록(중복 제거)이다. 경험 제목·id 는 PII 위험이라 싣지 않는다.
  resume_experience_selected: { count: number; experience_types: string[] };
  // 만든 레쥬메를 실제로 꺼내간 시점. language 는 export_completed 와 같은 결(국문/영문 중
  // 무엇을 진짜로 받아가는가)이라 같은 이름·같은 타입으로 싣는다.
  resume_downloaded: { format: ResumeExportFormat; language: string };
  // AI 초안에 처음 손댄 시점. 버전 로드당 1회 — 키 입력마다 쏘면 이벤트가 폭증한다.
  // section 은 처음 손댄 섹션 슬러그(resume-diff.ts 의 순서 = 화면 아코디언 순서).
  // version_id — "로드당 1회"는 한 화면 안에서만 참이다. 새로고침·재방문·두 번째 탭은
  // 각자 새 페이지라 같은 레쥬메가 다시 발화한다(analysis_completed 의 analysis_id 와 같은
  // 이유). 없으면 그 중복을 접을 수도, 서로 다른 레쥬메의 편집과 가를 수도 없다.
  // 경로에 이미 드러나는 서버 식별자라 새 노출면이 아니다.
  resume_edited: { section: string; version_id: string };
  // 편집 저장 시도의 결말. outcome 없이 뭉치면 export_completed 가 "접수"를 "완료"로
  // 보고하는 것과 같은 실수를 저장에서 반복한다.
  // persisted — 편집이 **어디든**(서버든 로컬 임시저장이든) 남았는가. false 는 서버도
  // 로컬도 못 남긴 편집 유실이고, outcome 만으로는 그 최악의 경우가 보이지 않는다.
  resume_edit_saved: {
    outcome: ResumeSaveOutcome;
    persisted: boolean;
    sections: string[];
    section_count: number;
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
