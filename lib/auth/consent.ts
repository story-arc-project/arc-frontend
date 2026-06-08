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
 * 확정되면 active: true 로 전환한다("구조 지금, 활성화 나중"). 문구·version·detailHref
 * 실값은 법무 확정 후 채운다.
 */
export const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: "termsOfService",
    label: "서비스 이용약관 동의",
    required: true,
    active: true,
    version: "2026-06-08",
    summary: "ARC 서비스 이용에 관한 기본 약관입니다.",
  },
  {
    id: "privacyRequired",
    label: "개인정보 수집·이용 동의 (서비스 제공)",
    required: true,
    active: true,
    version: "2026-06-08",
    summary:
      "계정·프로필과 경험 기록·업로드 파일을 아카이빙·대시보드·분석·엑스포트 등 서비스 제공을 위해 수집·이용합니다.",
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
    summary: "이용 패턴을 분석해 추천·개인화를 제공합니다. 동의하지 않아도 가입할 수 있어요.",
  },
  {
    id: "marketing",
    label: "마케팅·광고성 정보 수신",
    required: false,
    active: true,
    version: "2026-06-08",
    summary: "이벤트·소식을 이메일 등으로 보내드립니다. 동의하지 않아도 가입할 수 있어요.",
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
