# FRT-5 회원가입 약관·개인정보 동의 — 구현 계획 (프론트엔드)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입 흐름에 PIPA 분리동의 원칙을 지키는 `consent` 스텝을 신설하고, 동의 내역을 `POST /auth/consent`로 전송한다.

**Architecture:** config 배열(`lib/auth/consent.ts`)이 동의 항목·필수/선택·활성여부·버전을 정의하고, 순수 함수가 선택/게이팅 로직을 담당(유닛 TDD). 표현 컴포넌트 `ConsentStep`이 "전체동의 + 펼쳐보기" UI를 렌더. consent는 이메일(verify 후)·소셜(callback 후) 양 경로가 수렴하는 첫 온보딩 스텝이다. 활성 항목만 노출/전송하므로 맞춤광고·데이터사업은 정의만 두고 추후 ON.

**Tech Stack:** Next.js(App Router)·TS(strict)·Tailwind. 테스트: Vitest(유닛)·Storybook(컴포넌트)·Playwright(E2E, `e2e/fixtures/stub-api.ts` 스테이트풀 목).

**스펙:** `docs/legal/2026-06-08-frt-5-consent-design.md`

**BE 의존성(범위 밖):** `POST /auth/consent`·동의 원장·서버측 필수동의 강제·pending 계정 파기는 백엔드(BAC) 작업. 본 계획은 FE를 E2E 목(`/auth/consent` 200) 기준으로 완성하고, 실제 BE 연동은 BAC 완료 후.

---

## File Structure

- Create `lib/auth/consent.ts` — 동의 항목 config + 타입 + 순수 선택/게이팅/payload 로직.
- Create `lib/auth/consent.test.ts` — 위 순수 로직 유닛 테스트.
- Create `components/ui/checkbox.tsx` — 디자인 시스템 체크박스(현재 없음). `components/ui/index.ts`에 export.
- Create `components/features/auth/ConsentStep.tsx` — 동의 화면 표현 컴포넌트.
- Create `components/features/auth/ConsentStep.stories.tsx` — Storybook 상태/상호작용.
- Modify `app/(auth)/constants.ts` — `Step`·`ONBOARDING_STEPS`·`STEP_ORDER`에 `consent` 추가.
- Modify `app/(auth)/signup/page.tsx` — consent 스텝 렌더 + verify→consent 라우팅 + `handleConsent` 호출.
- Modify `app/(auth)/callback/google/page.tsx` — 신규 소셜 사용자 라우팅 `step=profile` → `step=consent`.
- Modify `e2e/fixtures/stub-api.ts` — `POST /auth/consent` 목 핸들러.
- Create `e2e/signup-consent.behavior.spec.ts` — 동의 스텝 스모크.

---

## Task 1: 동의 config + 순수 로직 (TDD)

**Files:**
- Create: `lib/auth/consent.ts`
- Test: `lib/auth/consent.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/auth/consent.test.ts`:
```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test:unit -- consent`
Expected: FAIL — `@/lib/auth/consent` 모듈/함수 미존재.

- [ ] **Step 3: 최소 구현 작성**

`lib/auth/consent.ts`:
```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:unit -- consent`
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add lib/auth/consent.ts lib/auth/consent.test.ts
git commit -m "✨ FRT-5 동의 config + 선택/게이팅 순수 로직 (TDD)"
```

---

## Task 2: Checkbox UI 컴포넌트

**Files:**
- Create: `components/ui/checkbox.tsx`
- Modify: `components/ui/index.ts`

- [ ] **Step 1: Checkbox 구현**

`components/ui/checkbox.tsx`:
```tsx
import { InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  checked: boolean;
};

export function Checkbox({ checked, className = "", ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      className={[
        "h-5 w-5 shrink-0 rounded-md border-2 border-border",
        "accent-brand cursor-pointer transition-colors",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
```

- [ ] **Step 2: export 추가**

`components/ui/index.ts` — `Input` export 다음 줄에 추가:
```ts
export { Checkbox } from "./checkbox";
```

- [ ] **Step 3: 타입 확인**

Run: `npm run typecheck`
Expected: PASS (에러 없음).

- [ ] **Step 4: 커밋**

```bash
git add components/ui/checkbox.tsx components/ui/index.ts
git commit -m "✨ Checkbox UI 컴포넌트 추가"
```

---

## Task 3: ConsentStep 컴포넌트 + Storybook

**Files:**
- Create: `components/features/auth/ConsentStep.tsx`
- Create: `components/features/auth/ConsentStep.stories.tsx`

- [ ] **Step 1: ConsentStep 구현**

`components/features/auth/ConsentStep.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button, Checkbox } from "@/components/ui";
import {
  activeConsentItems,
  initialConsentState,
  toggleConsent,
  setAllConsents,
  isAllActiveGranted,
  allRequiredGranted,
  buildConsentPayload,
  type ConsentId,
  type ConsentPayload,
} from "@/lib/auth/consent";

interface ConsentStepProps {
  onSubmit: (payload: ConsentPayload) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ConsentStep({ onSubmit, isLoading = false, error }: ConsentStepProps) {
  const [state, setState] = useState(initialConsentState());
  const [expanded, setExpanded] = useState<ConsentId | null>(null);

  const items = activeConsentItems();
  const allChecked = isAllActiveGranted(state);
  const canProceed = allRequiredGranted(state);

  return (
    <div>
      <h1 className="text-heading-2 text-text-primary mb-1">약관에 동의해주세요</h1>
      <p className="text-body text-text-secondary mb-6">필수 항목에 동의하면 가입이 완료돼요</p>

      {/* 전체 동의 */}
      <label className="flex items-center gap-3 p-4 mb-3 rounded-xl border-2 border-border cursor-pointer">
        <Checkbox
          checked={allChecked}
          onChange={() => setState((s) => setAllConsents(s, !allChecked))}
          aria-label="전체 동의"
        />
        <span className="text-label text-text-primary font-semibold">전체 동의</span>
      </label>

      {/* 항목별 */}
      <div className="flex flex-col gap-1 mb-6">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg">
            <div className="flex items-center gap-3 px-2 py-2.5">
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <Checkbox
                  checked={Boolean(state[item.id])}
                  onChange={() => setState((s) => toggleConsent(s, item.id))}
                  aria-label={item.label}
                />
                <span className="text-body-sm text-text-secondary">
                  <span className={item.required ? "text-brand" : "text-text-tertiary"}>
                    [{item.required ? "필수" : "선택"}]
                  </span>{" "}
                  {item.label}
                </span>
              </label>
              {(item.summary || item.detailHref) && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === item.id ? null : item.id))}
                  className="text-caption text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer shrink-0"
                >
                  {expanded === item.id ? "닫기" : "보기"}
                </button>
              )}
            </div>
            {expanded === item.id && item.summary && (
              <p className="px-2 pb-3 text-caption text-text-tertiary">{item.summary}</p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mb-3 text-body-sm text-error">{error}</p>}

      <Button
        onClick={() => onSubmit(buildConsentPayload(state))}
        disabled={!canProceed || isLoading}
        fullWidth
      >
        {isLoading ? "처리 중..." : "다음"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Storybook 스토리 작성**

`components/features/auth/ConsentStep.stories.tsx`:
```tsx
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, userEvent, within } from "storybook/test";
import { ConsentStep } from "./ConsentStep";

const meta: Meta<typeof ConsentStep> = {
  title: "Features/Auth/ConsentStep",
  component: ConsentStep,
  parameters: { layout: "centered" },
  args: { onSubmit: fn(), isLoading: false, error: null },
};
export default meta;
type Story = StoryObj<typeof ConsentStep>;

export const Default: Story = {};

export const RequiredGatesNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "다음" })).toBeDisabled();
  },
};

export const AgreeAllEnablesNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("전체 동의"));
    await expect(canvas.getByRole("button", { name: "다음" })).toBeEnabled();
  },
};

export const RequiredOnlyEnablesNext: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("서비스 이용약관 동의"));
    await userEvent.click(canvas.getByLabelText("개인정보 수집·이용 동의 (서비스 제공)"));
    await userEvent.click(canvas.getByLabelText("만 14세 이상입니다"));
    await expect(canvas.getByRole("button", { name: "다음" })).toBeEnabled();
  },
};

export const ErrorState: Story = {
  args: { error: "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요." },
};
```

- [ ] **Step 3: 타입 확인**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add components/features/auth/ConsentStep.tsx components/features/auth/ConsentStep.stories.tsx
git commit -m "✨ FRT-5 ConsentStep 컴포넌트 + Storybook (전체동의·펼쳐보기·게이팅)"
```

---

## Task 4: 가입 흐름에 consent 스텝 편입

**Files:**
- Modify: `app/(auth)/constants.ts`
- Modify: `app/(auth)/signup/page.tsx`
- Modify: `app/(auth)/callback/google/page.tsx`

- [ ] **Step 1: constants.ts — 스텝 정의에 consent 추가**

`app/(auth)/constants.ts`, 기존:
```ts
export type Step = "start" | "password" | "verify" | "profile" | "q1" | "q2";

export const ONBOARDING_STEPS: Step[] = ["profile", "q1", "q2"];
export const STEP_ORDER: Step[] = ["start", "password", "verify", "profile", "q1", "q2"];
```
변경:
```ts
export type Step = "start" | "password" | "verify" | "consent" | "profile" | "q1" | "q2";

export const ONBOARDING_STEPS: Step[] = ["consent", "profile", "q1", "q2"];
export const STEP_ORDER: Step[] = ["start", "password", "verify", "consent", "profile", "q1", "q2"];
```

- [ ] **Step 2: signup/page.tsx — import 추가**

기존(13행 근처):
```ts
import { VerifyEmailResponse } from "@/types/auth";
```
바로 아래에 추가:
```ts
import { ConsentStep } from "@/components/features/auth/ConsentStep";
import { type ConsentPayload } from "@/lib/auth/consent";
```

- [ ] **Step 3: signup/page.tsx — consentError 상태 추가**

기존:
```ts
  const [signupError, setSignupError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
```
변경(한 줄 추가):
```ts
  const [signupError, setSignupError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
```

- [ ] **Step 4: signup/page.tsx — verify 가드 useEffect 라우팅 변경**

기존:
```ts
  // 이미 인증된 사용자가 verify 단계에 머무르지 않도록 강제 이탈
  useEffect(() => {
    if (step === "verify" && !isAuthLoading && isAuthenticated) {
      goTo("profile");
    }
  }, [step, isAuthenticated, isAuthLoading]);
```
변경(`goTo("profile")` → `goTo("consent")`):
```ts
  // 이미 인증된 사용자가 verify 단계에 머무르지 않도록 강제 이탈 → 첫 온보딩 스텝(consent)
  useEffect(() => {
    if (step === "verify" && !isAuthLoading && isAuthenticated) {
      goTo("consent");
    }
  }, [step, isAuthenticated, isAuthLoading]);
```

- [ ] **Step 5: signup/page.tsx — handleVerify의 신규 사용자 분기 변경**

기존(handleVerify 내부):
```ts
      if (result.data.onboarded) {
        // 이미 온보딩 완료된 유저 (재인증 케이스) — FastAPI 쿠키가 이미 설정됨
        // 하드 내비게이션으로 AuthProvider를 재마운트·refetch해야 GNB 계정 메뉴가 노출된다.
        window.location.assign("/dashboard");
      } else {
        goTo("profile");
      }
```
변경(`goTo("profile")` → `goTo("consent")`):
```ts
      if (result.data.onboarded) {
        // 이미 온보딩 완료된 유저 (재인증 케이스) — FastAPI 쿠키가 이미 설정됨
        // 하드 내비게이션으로 AuthProvider를 재마운트·refetch해야 GNB 계정 메뉴가 노출된다.
        window.location.assign("/dashboard");
      } else {
        goTo("consent");
      }
```

- [ ] **Step 6: signup/page.tsx — handleConsent 추가**

`handleVerify` 함수 정의 바로 다음에 추가:
```ts
  async function handleConsent(payload: ConsentPayload) {
    setIsLoading(true);
    setConsentError(null);

    try {
      await api.post("/auth/consent", payload, { auth: true });
      goTo("profile");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "AUTH_TOKEN_EXPIRED" || e.code === "AUTH_MISSING_COOKIES" || e.code === "AUTH_TOKEN_INVALID") {
          setConsentError("로그인 정보가 만료되었어요. 다시 로그인해주세요.");
        } else {
          setConsentError(e.message);
        }
      } else {
        setConsentError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }
```

- [ ] **Step 7: signup/page.tsx — consent 스텝 렌더 블록 추가**

verify 블록 닫힘 `)}` 다음, `{step === "profile" && (` 앞에 삽입:
```tsx
            {/* ── consent ──────────────────────────── */}
            {step === "consent" && (
              <ConsentStep onSubmit={handleConsent} isLoading={isLoading} error={consentError} />
            )}

```

- [ ] **Step 8: callback/google/page.tsx — 신규 소셜 사용자 라우팅 변경**

기존(73행):
```tsx
          router.push(`/signup?step=profile&email=${encodeURIComponent(result.data.user.email)}`);
```
변경(`step=profile` → `step=consent`):
```tsx
          router.push(`/signup?step=consent&email=${encodeURIComponent(result.data.user.email)}`);
```

- [ ] **Step 9: 타입·린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 10: 커밋**

```bash
git add app/(auth)/constants.ts "app/(auth)/signup/page.tsx" "app/(auth)/callback/google/page.tsx"
git commit -m "✨ FRT-5 consent를 첫 온보딩 스텝으로 편입 (이메일·소셜 수렴)"
```

---

## Task 5: E2E 목 + 동의 스텝 스모크

**Files:**
- Modify: `e2e/fixtures/stub-api.ts`
- Create: `e2e/signup-consent.behavior.spec.ts`

- [ ] **Step 1: stub-api.ts — POST /auth/consent 핸들러 추가**

`e2e/fixtures/stub-api.ts`의 `page.route` 콜백 안, 기존 `DELETE /auth/account/*` 핸들러 블록 다음(최종 미매칭 fallback 이전)에 추가:
```ts
      if (method === "POST" && pathname === "/auth/consent") {
        await fulfillJson(200, success(null));
        return;
      }
```
(비-GET 요청은 핸들러 이전에 `mutations` 배열로 자동 캡처되므로 추가 배선 불필요.)

- [ ] **Step 2: 스모크 스펙 작성**

`e2e/signup-consent.behavior.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { stubApi } from "./fixtures/stub-api";

test("동의 스텝: 필수 미동의 시 다음 비활성 → 전체동의 후 진행 + /auth/consent 기록", async ({
  page,
}) => {
  const stub = await stubApi(page, { authed: true }); // page.goto 전에 호출
  await page.goto("/signup?step=consent");

  const next = page.getByRole("button", { name: "다음" });
  await expect(next).toBeDisabled();

  await page.getByLabel("전체 동의").check();
  await expect(next).toBeEnabled();
  await next.click();

  // consent 제출 성공 → profile 스텝 진입
  await expect(page.getByRole("heading", { name: "기본 정보를 알려주세요" })).toBeVisible();

  expect(stub.mutations).toContainEqual(
    expect.objectContaining({ method: "POST", path: "/auth/consent" }),
  );
});

test("동의 스텝: 선택 미동의해도 필수만 충족하면 진행 가능", async ({ page }) => {
  await stubApi(page, { authed: true });
  await page.goto("/signup?step=consent");

  await page.getByLabel("서비스 이용약관 동의").check();
  await page.getByLabel("개인정보 수집·이용 동의 (서비스 제공)").check();
  await page.getByLabel("만 14세 이상입니다").check();

  await expect(page.getByRole("button", { name: "다음" })).toBeEnabled();
});
```

- [ ] **Step 3: E2E 실행**

Run: `npm run test:e2e -- signup-consent`
Expected: PASS (2 tests). 실패 시 `npm run test:e2e:report` 로 확인.

- [ ] **Step 4: 커밋**

```bash
git add e2e/fixtures/stub-api.ts e2e/signup-consent.behavior.spec.ts
git commit -m "✅ FRT-5 동의 스텝 E2E 목(/auth/consent) + 스모크 스펙"
```

---

## Task 6: 전체 검증 + 그래프 갱신

**Files:** 없음 (검증 단계)

- [ ] **Step 1: 검증 명령 실행**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```
Expected: 모두 PASS. (UI 동작은 Task 3 Storybook play·Task 5 Playwright로 이미 커버)

- [ ] **Step 2: 지식 그래프 갱신**

Run: `graphify update .`
Expected: 신규 노드(ConsentStep·consent.ts·Checkbox) 반영.

- [ ] **Step 3: 검증 결과 커밋 (그래프 변경분)**

```bash
git add -A
git commit -m "🔧 graphify 그래프 갱신 (FRT-5 동의 스텝)"
```

---

## Self-Review (작성자 점검 완료)

- **스펙 커버리지**: §3 항목세트→Task1 config / §3.1 필수 처리상세→Task1 `privacyRequired.summary` 문구 / §4 플로우(consent 첫 온보딩 스텝, 이메일·소셜 수렴)→Task4 / §5 UI(전체동의+펼쳐보기, 필수 게이팅, 14세 체크)→Task3 / §6 `POST /auth/consent`→Task4 handleConsent + Task5 목 / §8 테스트(유닛·Storybook·Playwright)→Task1/3/5. ✅
- **플레이스홀더**: 모든 코드 블록 실제 코드. 미해결 법무·BE 항목은 스펙 §9로 인계(계획 범위 밖). ✅
- **타입 일관성**: `ConsentPayload`/`ConsentState`/`ConsentId`·함수 시그니처가 Task1 정의와 Task3·Task4 사용처에서 일치. `activeConsentItems`/`buildConsentPayload` 동일 명칭 사용. ✅

## 미해결 (계획 범위 밖, 스펙 §9 인계)

- BE: `POST /auth/consent` 실구현·동의 원장·서버측 필수동의 강제·pending 계정 파기(BAC 이슈).
- 법무: 약관·처리방침 전문, 동의 문구·`version`·`detailHref` 실값, 맞춤광고·데이터사업 활성화 조건.
