import { describe, expect, it } from "vitest";
import {
  activeConsentItems,
  initialConsentState,
  toggleConsent,
  setAllConsents,
  isAllActiveGranted,
  allRequiredGranted,
  buildConsentPayload,
  type ConsentItem,
} from "@/lib/auth/consent";

const ITEMS: ConsentItem[] = [
  { id: "termsOfService", label: "약관", required: true, active: true, version: "v1" },
  { id: "privacyRequired", label: "개인정보", required: true, active: true, version: "v1" },
  { id: "marketing", label: "마케팅", required: false, active: true, version: "v1" },
  { id: "personalizedAds", label: "광고", required: false, active: false, version: "v1" },
];

describe("consent logic", () => {
  it("activeConsentItems는 active=true 항목만 반환", () => {
    expect(activeConsentItems(ITEMS).map((i) => i.id)).toEqual([
      "termsOfService",
      "privacyRequired",
      "marketing",
    ]);
  });

  it("setAllConsents(전체동의)는 active 항목만 true로, 비활성은 건드리지 않음", () => {
    const s = setAllConsents(initialConsentState(ITEMS), true, ITEMS);
    expect(s.termsOfService).toBe(true);
    expect(s.privacyRequired).toBe(true);
    expect(s.marketing).toBe(true);
    expect(s.personalizedAds).toBe(false);
  });

  it("isAllActiveGranted는 active 전부 동의 시에만 true", () => {
    let s = setAllConsents(initialConsentState(ITEMS), true, ITEMS);
    expect(isAllActiveGranted(s, ITEMS)).toBe(true);
    s = toggleConsent(s, "marketing");
    expect(isAllActiveGranted(s, ITEMS)).toBe(false);
  });

  it("allRequiredGranted는 필수만 충족하면 true (선택 미동의 무관)", () => {
    let s = initialConsentState(ITEMS);
    s = toggleConsent(s, "termsOfService");
    s = toggleConsent(s, "privacyRequired");
    expect(allRequiredGranted(s, ITEMS)).toBe(true);
    expect(isAllActiveGranted(s, ITEMS)).toBe(false);
  });

  it("필수가 하나라도 빠지면 allRequiredGranted=false", () => {
    let s = initialConsentState(ITEMS);
    s = toggleConsent(s, "termsOfService");
    expect(allRequiredGranted(s, ITEMS)).toBe(false);
  });

  it("buildConsentPayload는 active 항목만 직렬화(비활성 제외)", () => {
    const s = setAllConsents(initialConsentState(ITEMS), true, ITEMS);
    const payload = buildConsentPayload(s, ITEMS);
    expect(payload.agreements.map((a) => a.id)).toEqual([
      "termsOfService",
      "privacyRequired",
      "marketing",
    ]);
    expect(payload.agreements[0]).toEqual({ id: "termsOfService", version: "v1", granted: true });
  });
});
