// FRT-19: 핵심 퍼널 이벤트 이름·페이로드 타입의 단일 출처.
//
// autocapture 를 끄고(FRT-18) 명시 이벤트만 전송해 무료 티어의 이벤트 예산을
// "흐름 파악"에 집중한다. 완료 사실 자체는 DB(user·experience·analysis 행)에도 남지만,
// 가입→온보딩→기록→분석→export 를 PostHog 안에서 하나의 퍼널로 잇기 위해 완료 등뼈를
// 이벤트로 emit 한다. 단순 총량 집계는 DB(고객정보 API 등)로 넘겨 중복 계측을 피한다.

import type { DraftTier } from "@/lib/export/draft-storage";

export type SignupMethod = "email" | "google";
// 개별(individual) 분석은 기록 저장 시 백엔드가 자동 생성 — 프론트에 "실행 완료" 관측
// 지점이 없어 완료 이벤트에서 제외한다(FRT-107 에서도 못 만든다 — 관측점이 여전히 없어
// 서버사이드 캡처가 필요하다). 조회는 다르다: 개별 분석도 사람이 열어 보므로
// analysis_viewed 에는 실린다(아래 ViewableAnalysisKind).
export type AnalysisKind = "comprehensive" | "keyword";
// FRT-107: 실행은 못 세도 조회는 세는 분석들. 개별 분석은 자동 생성이라 실행 이벤트가
// 없지만, 결과를 얼마나 오래 보는지는 나머지 둘과 같은 축에서 비교해야 의미가 있다.
export type ViewableAnalysisKind = AnalysisKind | "individual";
// FRT-107: 경험 입력 폼에 들어온 경로. 신규 작성과 수정은 이탈의 뜻이 달라(수정 중 이탈은
// 이미 저장된 기록이 있다) 한 이벤트에 싣되 여기서 가른다.
export type ArchiveEntryMode = "new" | "edit";
// FRT-107: 자소서를 손에서 꺼내가는 수단. 지금은 인쇄뿐이다 — 레쥬메의 ResumeExportFormat
// 을 빌려 쓰지 않는 이유는, 값이 하나라고 남의 축에 얹으면 자소서에 PDF 가 생기는 순간
// 두 기능의 포맷 축이 얽히기 때문이다.
export type CoverLetterExportFormat = "print";
// FRT-107: 자소서 편집 저장의 결말. 값은 ResumeSaveOutcome 과 같지만 축을 따로 두는 이유는
// 위 format 과 같다 — 지금 같다고 남의 타입에 얹으면, 한쪽 기능의 저장 경로가 바뀔 때
// 다른 쪽 계약이 조용히 따라 움직인다.
// exit_draft — 저장 버튼을 누르지 않고 화면을 떠나 페이지가 대신 임시 저장한 경우.
export type CoverLetterSaveOutcome = "server" | "failed" | "exit_draft";
export type ExportType = "resume" | "cover_letter";
export type RecordStatus = "complete" | "draft";
// FRT-114: 레쥬메를 손에서 꺼내가는 수단. 인쇄는 파일이 떨어지지 않지만 "결과물을
// 꺼내가는 행동"은 같아서 같은 이벤트에 싣고 여기서만 가른다 — 안 실으면 그 행동은
// 영영 데이터에 남지 않는다(다운스트림에서 접는 건 언제든 가능).
export type ResumeExportFormat = "pdf" | "docx" | "print";
// FRT-114: 편집 저장이 실제로 어디까지 갔는가. 서버에 남았는지(server) 못 남았는지(failed)를
// 뭉치면 관리자가 보는 "저장 건수"가 거짓이 된다. 못 남은 경우에도 편집은 임시 저장으로
// 붙들리므로, 유실 직전인지 아닌지는 같은 이벤트의 `draft_saved` 가 가른다.
// exit_draft — 저장 버튼을 누르지 않고 화면을 떠나 페이지가 대신 임시 저장한 경우.
// 사용자 의사로는 '저장'이 아니지만 편집이 어디까지 갔느냐는 같은 질문이라 같은 이벤트에
// 싣고 outcome 으로만 가른다. 빼면 안전하게 보관된 편집이 유실된 편집과 구별되지 않는다.
//
// `unsupported` 는 FRT-111 에서 제거했다 — 서버에 PATCH·DELETE 가 배포되면서 "기능이 아직
// 없어서 못 저장했다"는 상태 자체가 사라졌다. 롤백으로 405/501 이 오더라도 그건 failed 다.
export type ResumeSaveOutcome = "server" | "failed" | "exit_draft";
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
  // ── 한 화면 *안*에서의 이탈 (FRT-107) ─────────────────────────────
  // 퍼널은 "A 는 했는데 B 는 안 했다"까지만 안다. 아래 둘은 **한 화면을 벗어나지 않은 채**
  // 멈춘 자리를 묻기 때문에 퍼널로 파생되지 않는다 — 그래서만 이벤트로 만든다.
  // (반대로 comprehensive_analysis_abandoned·resume_export_abandoned 처럼 두 이벤트 사이의
  //  단순 미도달인 것들은 만들지 않았다. 퍼널이 코드 없이, 과거 데이터까지 답한다.)
  archiveEntryAbandoned: "archive_entry_abandoned",
  onboardingAbandoned: "onboarding_abandoned",
  // 진행의 자취. 이탈 이벤트만으로는 "어디서 멈췄나"는 알아도 "어디까지 순조로웠나"를 모른다.
  archiveSectionCompleted: "archive_section_completed",
  // 임시저장한 기록을 다시 열어 이어쓰기 시작한 시점 — "재방문 의도가 있는 이탈"의 회수율.
  archiveEntryResumed: "archive_entry_resumed",
  // 온보딩은 라우트가 하나(step state)라 pageview 로도 스텝 진입이 안 보인다.
  onboardingStepViewed: "onboarding_step_viewed",
  // ── 조회 체류 (FRT-107) ───────────────────────────────────────────
  // capture_pageview/capture_pageleave 가 꺼져 있어 $prev_pageview_duration 을 못 쓴다.
  // 정의서의 individual_/comprehensive_/keyword_analysis_result_viewed 3종을 하나로 합치고
  // analysis_type 으로 가른다 — analysis_completed·analysis_target_selected 와 같은 결.
  analysisViewed: "analysis_viewed",
  // ── 기술적 실패 판별 (FRT-107) ────────────────────────────────────
  // "눌렀는데 요청이 안 나갔다"를 보려면 **누른 사실**과 **서버가 받은 사실**이 둘 다
  // 있어야 하고, 그 차이가 곧 버그·네트워크 실패다(사용자 의도적 이탈과 갈린다).
  // 이미 있는 반쪽은 새로 만들지 않는다 — 어느 쪽이 비어 있었는지가 아래를 갈랐다:
  //
  //  분석  : 누른 사실 = analysis_target_selected(요청 **앞**에서 발화) — 있다.
  //          받은 사실 = 없다 → analysis_requested 를 만든다.
  //          (analysis_completed 로는 못 가른다. 그건 분석이 **끝났다**는 뜻이라
  //           "접수됐지만 아직 도는 중"과 "요청조차 못 갔다"가 한 덩어리가 된다.)
  //  엑스포트: 받은 사실 = export_completed(이름과 달리 실체는 접수다) — 있다.
  //          누른 사실 = 없다 → export_execute_button_clicked 를 만든다.
  //          (resume_experience_selected 는 선택 UI 플래그가 꺼지면 아예 안 떠서
  //           누름의 대역이 못 된다.)
  analysisRequested: "analysis_requested",
  exportExecuteButtonClicked: "export_execute_button_clicked",
  // ── 자소서 이후 행동 (FRT-107) ────────────────────────────────────
  // 자소서 기능은 FRT-140 에서 생겼는데 상세 화면 계측이 통째로 비어 있었다.
  // 레쥬메의 resume_edited/_edit_saved/_downloaded 와 같은 이름 규칙·같은 속성 축으로 맞춘다.
  coverLetterEdited: "cover_letter_edited",
  coverLetterEditSaved: "cover_letter_edit_saved",
  coverLetterDownloaded: "cover_letter_downloaded",
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
  // 온보딩은 라우트가 하나(signup 페이지의 step state)라 스텝 진입이 **어떤 방법으로도**
  // 관측되지 않는다 — capture_pageview 도 꺼져 있고, 켜더라도 URL 이 안 바뀐다.
  // step_index 는 스텝 이름이 바뀌어도 순서를 유지하려고 함께 싣는다.
  onboarding_step_viewed: { step: string; step_index: number };
  // 온보딩을 끝내지 못하고 떠난 시점. elapsed_seconds 는 온보딩 시작부터의 벽시계다.
  onboarding_abandoned: { last_step: string; elapsed_seconds: number };
  // FRT-107 속성 보강 — 아래 넷은 신규 작성 경로에서만 실린다. 수정 저장에는 "진입" 시작점이
  // 없어서 잴 수가 없고, 0 을 넣으면 "즉시 저장했다"는 거짓이 된다(부재와 0 은 다른 사실).
  // archive_entry_abandoned 와 **같은 이름·같은 축**으로 싣는 것이 요점이다 — 끝낸 사람과
  // 포기한 사람을 나란히 놓고 "무엇이 달랐나"를 물을 수 있어야 한다.
  record_created: {
    experience_type: string;
    status: RecordStatus;
    elapsed_seconds?: number;
    sections_done?: number;
    sections_total?: number;
    qualitative_fields_filled?: string[];
  };
  // 경험 입력 폼을 저장하지 않고 떠난 시점. 퍼널이 볼 수 없는 것을 본다 —
  // archive_entry_started → record_created 미도달까지는 퍼널도 알지만,
  // **그 화면 어디에서** 멈췄는지는 이 이벤트에만 있다.
  archive_entry_abandoned: {
    mode: ArchiveEntryMode;
    // 마지막으로 완료한 섹션 슬러그. 하나도 못 채웠으면 null — "시작도 못 했다"는
    // 유효한 답이라 부재로 뭉개지 않는다.
    last_section: string | null;
    sections_done: number;
    sections_total: number;
    elapsed_seconds: number;
    // 정성 항목(지원동기·배운점 등) 중 실제로 채운 필드의 **키** 목록. 사용자가 쓴 내용은
    // 절대 싣지 않는다(PII 금지 — 타입이 string[] 인 것은 키 목록이라는 뜻이다).
    // 정의서의 archive_field_completed 를 이벤트로 만들지 않고 여기 속성으로 접었다:
    // 필드마다 쏘면 볼륨이 폭증하는데 답해야 할 질문("정성 기록이 실제로 일어나는가")은
    // 같은 값으로 더 싸게 답한다.
    qualitative_fields_filled: string[];
  };
  // 섹션 하나를 채운 시점. sections_done 이 "몇 개 했나"라면 section_index 는 "폼의 어디를
  // 하고 있나"다 — 둘이 벌어지면 사용자가 순서를 건너뛰며 채운다는 뜻이라 서로 못 대신한다.
  archive_section_completed: {
    section_key: string;
    section_index: number;
    sections_done: number;
    sections_total: number;
  };
  // 임시저장한 기록을 다시 열어 이어쓰기 시작한 시점. "재방문 의도가 있는 이탈"이 실제로
  // 회수되는지를 보는 유일한 신호다(draft 저장 자체는 record_created{status:"draft"} 가 센다).
  archive_entry_resumed: { experience_type: string };
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
  // 결과를 한 번 열어 본 사건. **매 조회마다** 발화하므로 조회 횟수는 이 이벤트를 세면 되고,
  // 체류는 속성으로 함께 온다(정의서 권고 그대로 — 별도 카운터 이벤트를 만들지 않는다).
  // view_duration_seconds 는 "처음 화면을 벗어나기까지 실제로 보인 시간"이다(useDwell).
  // 0 은 유효한 값 — 열자마자 나간 조회가 가장 중요한 신호다.
  analysis_viewed: {
    analysis_type: ViewableAnalysisKind;
    analysis_id: string;
    view_duration_seconds: number;
  };
  // 분석 생성 요청이 **왕복을 마친** 시점. 이미 있는 analysis_target_selected(누름)와 짝을
  // 이룬다.
  //
  // ⚠️ **서버가 응답을 돌려준 경우에만** 발화한다(성공이든 거절이든). 오프라인·DNS·연결
  // 끊김은 응답 자체가 없어 여기 오지 않는다 — 그래야 세 갈래가 갈린다:
  //   · 누름 − requested(전체)    = 요청이 브라우저를 못 떠났다.
  //   · requested{accepted:false} = 나갔는데 서버가 거절했다.
  //   · requested{accepted:true}  = 접수됐다.
  // accepted 의 기준은 **HTTP 상태**(<400)다 — 2xx 인데 본문만 깨진 응답(INVALID_JSON)은
  // 화면엔 실패로 보여도 서버가 받은 것이라 접수로 센다.
  // 실패면 무조건 쏘도록 두면 첫 갈래가 영영 비고, 성공에만 쏘면 앞 두 갈래가 뭉개진다.
  analysis_requested: { analysis_type: AnalysisKind; accepted: boolean };
  // 엑스포트 실행 버튼을 누른 시점(요청 함수를 부르기 **직전**). export_completed(실체는
  // 접수)와의 차이가 같은 질문을 엑스포트에서 답한다.
  export_execute_button_clicked: { export_type: ExportType };
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
    // FRT-261: 임시 저장이 **어느 계층까지 내려갔는가**. 폴백을 깔면서 `persisted:false` 가
    // 사실상 안 찍히게 됐다(메모리 계층이 거의 항상 받아낸다) — 유실 위험은 이제 이 축으로
    // 읽어야 한다. optional 인 것은 서버 저장 경로처럼 임시 저장을 거치지 않는 호출부가
    // 있기 때문이다: "안 실린 것"과 "못 담은 것(null)"은 다른 사실이라 뭉치면 안 된다.
    storage_tier?: DraftTier | null;
  };
  // FRT-107: 자소서 상세 화면은 FRT-140 에서 기능이 생겼는데도 계측이 하나도 없었다.
  // 레쥬메(resume_edited/_edit_saved/_downloaded)와 **같은 축**으로 맞춰 둘을 나란히
  // 비교할 수 있게 한다 — "AI 초안을 얼마나 고쳐 쓰는가"는 두 기능에 같은 질문이다.
  //
  // question_index — 자소서는 문항이 여럿이라(보통 3~5) 어느 문항에서 손을 대기 시작했는지가
  // 레쥬메의 section 에 해당한다. 문항 **내용**은 PII 위험이라 절대 싣지 않는다(번호만).
  cover_letter_edited: { cover_letter_id: string; question_index: number };
  // 저장 시도의 결말. resume_edit_saved 와 같은 뜻이지만 유니온을 따로 두는 이유는
  // CoverLetterExportFormat 과 같다 — 지금 값이 같다고 남의 축에 얹으면, 한쪽 기능의
  // 저장 경로가 바뀔 때 다른 쪽 계약이 조용히 따라 움직인다.
  cover_letter_edit_saved: {
    outcome: CoverLetterSaveOutcome;
    // 편집이 **어디든**(서버든 로컬 임시저장이든) 남았는가. false 가 진짜 유실이다.
    persisted: boolean;
    question_count: number;
    // 임시 저장이 어느 계층까지 내려갔는가(FRT-261). 서버 저장 경로처럼 임시 저장을 거치지
    // 않는 호출부가 있어 optional 이다 — "안 실린 것"과 "못 담은 것(null)"은 다른 사실이다.
    storage_tier?: DraftTier | null;
  };
  // 자소서를 실제로 꺼내간 시점. 지금은 인쇄뿐이라 format 값이 하나지만, 그래도 싣는다 —
  // 나중에 PDF 가 생겼을 때 "그전에는 어떻게 꺼내갔나"를 되짚을 수 있어야 한다.
  cover_letter_downloaded: { format: CoverLetterExportFormat };
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
