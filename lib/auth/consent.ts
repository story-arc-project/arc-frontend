/* ── 회원가입 동의 항목 config + 선택 로직 ───────────────── */

export type ConsentId =
  | "termsOfService"
  | "privacyRequired"
  | "age14"
  | "personalizedService"
  | "marketing"
  | "personalizedAds"
  | "thirdPartyProvision";

export interface ConsentItem {
  id: ConsentId;
  label: string;
  required: boolean; // true=필수(미동의 시 가입 불가)
  active: boolean; // false면 UI 미노출·미전송 (구조만 정의)
  version: string; // 정책 개정 시 재동의 트리거
  summary?: string; // 펼쳐보기 요약
  detailHref?: string; // 약관/처리방침 전문 (법무 확정 후)
}

export interface ConsentPayloadItem {
  id: ConsentId;
  version: string;
  granted: boolean;
}

export interface ConsentPayload {
  agreements: ConsentPayloadItem[];
}

export type ConsentState = Record<ConsentId, boolean>;

/**
 * 활성 항목만 UI에 노출·전송한다. 맞춤광고·데이터사업은 처리 실체·법무 문구가
 * 확정되면 active: true 로 전환한다("구조 지금, 활성화 나중").
 *
 * summary 는 PIPA 표준 동의서 4요소(목적·항목·보유기간·거부권)와 정보통신망법 표기를 반영한
 * **잠정 초안**이다(법무 검토 전). 약관·처리방침 전문은 docs/legal/terms-of-service.draft.md ·
 * docs/legal/privacy-policy.draft.md 에 있으며, /terms·/privacy 라우트 신설 후 detailHref 로 연결한다.
 */
export const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "termsOfService",
    label: "서비스 이용약관 동의",
    required: true,
    active: true,
    version: "2026-06-08",
    summary:
      "ARC 서비스 이용약관입니다. 서비스 이용 조건과 회원의 권리·의무, 회원이 작성한 경험 기록·업로드 콘텐츠의 권리 귀속(회원 소유)과 서비스 제공·AI 분석을 위한 이용 라이선스, AI 분석·요약 결과물의 성격(참고용·정확성 비보증, AI 생성물 표시), 책임 제한, 해지·탈퇴, 준거법(대한민국)을 포함합니다.",
  },
  {
    id: "privacyRequired",
    label: "개인정보 수집·이용 동의 (서비스 제공)",
    required: true,
    active: true,
    version: "2026-06-08",
    summary:
      "서비스 제공을 위해 개인정보를 수집·이용합니다. · 목적: 계정 생성·본인확인, 경험 기록 저장·관리(아카이빙), 대시보드 제공, AI 기반 분석·요약, 자기소개서·이력서 등 산출물 내보내기(엑스포트) · 수집 항목: 이메일·비밀번호·이름·생년월일·전화번호, 경험 기록(자유 서술)·업로드 파일, 서비스 이용 기록 · 보유 기간: 회원 탈퇴 시까지(관계 법령상 의무 보존 항목 제외) · 동의를 거부할 권리가 있으나, 필수 항목 미동의 시 서비스 이용이 제한됩니다.",
  },
  {
    id: "age14",
    label: "만 14세 이상입니다",
    required: true,
    active: true,
    version: "2026-06-08",
  },
  {
    id: "personalizedService",
    label: "맞춤 서비스 제공을 위한 개인정보 처리",
    required: false,
    active: true,
    version: "2026-06-08",
    summary:
      "맞춤 추천·개인화를 위해 서비스 이용·활동 기록과 관심사·고민 등 입력 정보를 분석합니다. · 보유 기간: 동의 철회 또는 탈퇴 시까지 · 선택 항목으로, 동의하지 않아도 서비스의 핵심 기능은 그대로 이용할 수 있습니다.",
  },
  {
    id: "marketing",
    label: "마케팅·광고성 정보 수신",
    required: false,
    active: true,
    version: "2026-06-08",
    summary:
      "전송자 ARC가 이벤트·혜택·신규 기능 등 광고성 정보를 이메일·앱 알림 등으로 보내드립니다. · 보유·이용: 동의 철회 또는 탈퇴 시까지 · 수신 동의는 마이페이지에서 언제든 철회할 수 있으며, 미동의해도 서비스 이용에 제한이 없습니다.",
  },
  // 아래는 처리 실체·법무 문구 확정 후 active: true 로 전환
  {
    id: "personalizedAds",
    label: "맞춤형 광고를 위한 개인정보 처리",
    required: false,
    active: false,
    version: "2026-06-08",
  },
  {
    id: "thirdPartyProvision",
    label: "데이터 제3자 제공",
    required: false,
    active: false,
    version: "2026-06-08",
  },
];

export function activeConsentItems(items: ConsentItem[] = CONSENT_ITEMS): ConsentItem[] {
  return items.filter((i) => i.active);
}

export function initialConsentState(items: ConsentItem[] = CONSENT_ITEMS): ConsentState {
  return Object.fromEntries(items.map((i) => [i.id, false])) as ConsentState;
}

export function toggleConsent(state: ConsentState, id: ConsentId): ConsentState {
  return { ...state, [id]: !state[id] };
}

export function setAllConsents(
  state: ConsentState,
  granted: boolean,
  items: ConsentItem[] = CONSENT_ITEMS,
): ConsentState {
  const next = { ...state };
  for (const i of activeConsentItems(items)) next[i.id] = granted;
  return next;
}

export function isAllActiveGranted(
  state: ConsentState,
  items: ConsentItem[] = CONSENT_ITEMS,
): boolean {
  return activeConsentItems(items).every((i) => state[i.id]);
}

export function allRequiredGranted(
  state: ConsentState,
  items: ConsentItem[] = CONSENT_ITEMS,
): boolean {
  return activeConsentItems(items)
    .filter((i) => i.required)
    .every((i) => state[i.id]);
}

export function buildConsentPayload(
  state: ConsentState,
  items: ConsentItem[] = CONSENT_ITEMS,
): ConsentPayload {
  return {
    agreements: activeConsentItems(items).map((i) => ({
      id: i.id,
      version: i.version,
      granted: Boolean(state[i.id]),
    })),
  };
}
