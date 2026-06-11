# FRT-5 — 회원가입 약관·개인정보 동의 (설계 스펙)

- 작성: 2026-06-08
- 상태: 합의 완료 → 구현 계획(writing-plans) 대기
- 관련: Notion "ARC 이용약관·개인정보 동의 — 예시 골격 + 고려사항 (FRT-5)", 법리 triage `docs/legal/2026-06-05-frt-5-privacy-triage.md`(브랜치 `worktree-frt-5-privacy-triage`, dev 미병합)
- 법적 기준: 대한민국 개인정보 보호법(PIPA) + 정보통신망법(마케팅). US/CCPA 아님.

> ⚠️ 이 문서는 **제품·엔지니어링 설계**다. 약관·처리방침 **전문**과 동의 문구의 법적 확정은 정책/법무·변호사 검토 트랙이며, 본 문서의 "법무 확인 체크리스트"로 인계한다.

---

## 1. 배경 & 목표

현재 회원가입 플로우에는 **약관·동의 단계가 전혀 없다.** FRT-5는 이를 신설한다.

- 경로가 둘이다: **이메일**(`/auth/signup` → verify) 과 **소셜**(Google OAuth → `/callback/google`).
- 백엔드에도 동의 관련 필드·엔드포인트가 **현재 없다**(OpenAPI 확인: `/auth/signup`=email·password, `/auth/onboarding`=프로필 필드만). → FRT-5는 **BE 신규 작업을 수반**한다.

목표: PIPA 분리동의 원칙을 지키면서, 입력 허들을 최소화하고, PM이 요구한 "데이터 사업·맞춤 광고까지 넓은 범위"를 **안전하게** 수용한다.

---

## 2. 의사결정 요약 (PM 피드백 ↔ 합의)

PM 피드백:
1. 데이터 사업까지 고려해 작성 — 사용자 맞춤 광고, 맞춤 서비스 제공을 위한 정보 수집.
2. 더 많은 범위를 동의받아 안전하게.

**핵심 재구성 — 한국 PIPA에서 "넓은 포괄 동의 = 안전"은 거꾸로다.**
- PIPA는 목적별 **분리 동의 + 번들 금지**가 원칙이라, 막연한 "다 동의" 한 덩어리는 **동의 자체가 무효**가 되고 제재 리스크가 된다.
- 따라서 "넓게·안전하게"의 올바른 구현은 **막연한 광범위 조항 한 개가 아니라, 목적별로 잘게 쪼갠 선택(opt-in) 동의 항목을 여러 개** 두는 것이다.

**"데이터 사업"은 법적으로 다른 3가지의 묶음** → 분해해서 다룬다:

| 구분 | 성격 | 지금 가능? |
|---|---|---|
| (a) 제3자 제공/데이터 판매 | 받는 자·목적·항목을 **특정해야** 유효 | ❌ 광고/데이터 파트너 부재 → 지금 유효 동의 불가 |
| (b) 가명정보 통계·연구 활용 | 동의 없이 가능(결합·재식별 제약) | △ 동의 항목 아님 → 처리방침 고지 사안 |
| (c) 내부 맞춤 서비스/광고 | 선택 opt-in 동의 항목 | ✅ 지금 구현 가능(단 맞춤"광고"는 처리 실체 필요) |

**처리 실체가 없는 것엔 유효한 동의를 못 받는다.** 광고 SDK·제3자 파트너·데이터 파이프라인이 없는 상태의 "데이터 사업 동의"는 무효 가능. → 기존 triage의 "막연한 데이터 사업은 지금 넣지 말자"와 충돌이 아니라 **순서 문제**.

**합의: "구조는 지금, 활성화는 나중."**
- 목적별 선택 동의 토글을 여러 개 둘 수 있는 **구조(데이터 모델·UI·동의 이력)** 를 지금 만든다.
- 맞춤광고·데이터사업 항목은 **config에 정의만 하고 비활성**, 처리 실체와 법무 문구가 확정되면 켠다.

소셜 동의 패턴(조사 결과):
- 카카오/네이버는 **간편가입(카카오싱크)** 으로 제공자 동의 화면에서 내 약관까지 받아준다 → 별도 화면 거의 불필요. **ARC는 Google만 사용** → 해당 없음.
- Google 동의 화면엔 내 서비스 약관 체크박스를 넣을 수 없다(스코프 + 정책 링크만). → 업계 표준은 **OAuth 복귀 후 신규회원에게 별도 동의 화면**.
- 실무 지침: 소셜의 "제3자 제공 동의"와 별개로 **내 서비스 이용약관 + 개인정보 수집·이용 동의는 반드시 별도**로 받아야 한다(처리방침으로 갈음 불가, 광고성 수신은 필수와 분리).

---

## 3. 동의 항목 세트 (config-driven)

UI는 `active: true` 인 항목만 렌더한다. 비활성 항목은 **체크박스로 노출하지 않는다**(못 지킬 동의는 안 보여줌). 새 범위는 config 엔트리만 추가하면 된다 → "구조 지금 / 활성화 나중".

| id | label | 구분 | 지금 |
|---|---|---|---|
| `termsOfService` | 서비스 이용약관 | 필수 | ✅ active |
| `privacyRequired` | 개인정보 수집·이용 (서비스 제공 목적) | 필수 | ✅ active |
| `age14` | 만 14세 이상입니다 | 필수 | ✅ active |
| `personalizedService` | 맞춤 서비스 제공을 위한 개인정보 처리 | 선택 | ✅ active |
| `marketing` | 마케팅·광고성 정보 수신 (정보통신망법) | 선택 | ✅ active |
| `personalizedAds` | 맞춤형 광고를 위한 개인정보 처리 | 선택 | ⛔ `active:false` |
| `thirdPartyProvision` | 데이터 제3자 제공 | 선택 | ⛔ `active:false` |

제안 타입(구현 시 확정):

```ts
export type ConsentId =
  | "termsOfService" | "privacyRequired" | "age14"
  | "personalizedService" | "marketing"
  | "personalizedAds" | "thirdPartyProvision";

export interface ConsentItem {
  id: ConsentId;
  label: string;
  required: boolean;   // true=필수(가입 차단), false=선택(미동의해도 가입)
  active: boolean;     // false면 렌더하지 않음 (구조만 정의)
  version: string;     // 정책 개정 시 재동의 트리거용
  summary?: string;    // 펼쳐보기 요약
  detailHref?: string; // 약관/처리방침 전문 링크 (법무 확정 후)
}
```

문구·`version`·`detailHref` 실값은 **법무 확정 후** 채운다. 활성 항목도 MVP는 요약 + 임시 링크로 시작 가능(전문 확정 전).

### 3.1 필수 "개인정보 수집·이용 (서비스 제공 목적)" — 처리 상세

이 필수 항목의 동의서에는 **ARC가 실제로 제공하는 기능을 위한 처리를 명시한다.** 정작 우리가 하는 처리(아카이빙·대시보드·분석·엑스포트)가 동의 범위 밖이 되면 안 된다. (PIPA: 목적·항목·보유기간·거부권을 명확히 고지)

- **수집 항목**: 이메일·비밀번호·이름·생년월일·전화번호(계정/프로필) + **경험 기록(자유서술)·업로드 파일**(서비스 핵심 입력) + 서비스 이용 기록.
- **이용 목적(서비스 제공)** — 사용자가 실제 사용하는 기능을 명시:
  - 계정 생성·본인확인
  - **아카이빙**: 경험 기록 저장·관리
  - **대시보드**: 기록 집계·시각화·요약 제공
  - **분석**: AI 기반 경험 분석·요약 제공 (※ 처리 과정에서 외부 LLM(Gemini) 위탁·국외이전 발생 → §6/처리방침 고지 사안)
  - **엑스포트**: 자기소개서·이력서 등 산출물 내보내기
- **보유 기간**: 회원 탈퇴 시까지(법령상 의무보존 제외), 탈퇴 후 일정 기간 내 파기.

**경계(번들링 방지)**: 위 항목은 *사용자가 직접 사용하는 핵심 기능 제공에 필요한 처리*라 **필수**다. 반면 행동·이용패턴 기반 **추천·개인화**(핵심 기능 제공에는 불필수)는 선택 `personalizedService`로 분리한다 — 핵심 기능 처리를 선택과 묶으면 번들 금지 위반이 된다.

---

## 4. 플로우

`consent`를 **첫 온보딩 스텝**으로 신설한다. 양 경로가 신원 확인 후 동일 화면으로 수렴한다.

```
이메일: start → password(/auth/signup) → verify → [consent] → profile → q1 → q2
소셜:   start → Google → callback(신규) → [consent] → profile → q1 → q2
기존(온보딩 완료) 회원: consent 안 봄 → dashboard
```

**배포 게이트 — `NEXT_PUBLIC_CONSENT_ENABLED` (기본 off)**: BE `POST /auth/consent`가 라이브되기 전에 FE만 배포되면 consent 스텝이 미배포 API에 의존해 온보딩이 막힌다(404). 그래서 플래그가 **off(기본)면 consent 스텝을 건너뛰어 기존 온보딩 경로(verify→profile)를 그대로 쓰고**, BE 라이브 후 `NEXT_PUBLIC_CONSENT_ENABLED=true`로 켠다. 첫 온보딩 스텝은 `FIRST_ONBOARDING_STEP`(플래그 off=`profile`, on=`consent`) 한 곳에서 결정되며, 모든 온보딩 재진입 리다이렉트(`signup`·`callback`·`useRedirectIfAuthenticated`·`AuthGate`·`login`)가 이 상수를 참조한다. E2E는 `playwright.config` webServer env에서 플래그 on으로 검증한다.

- `app/(auth)/constants.ts`: 플래그 on 시 `ONBOARDING_STEPS = ["consent","profile","q1","q2"]`, `STEP_ORDER`에 `verify` 다음 `consent` 삽입. off면 기존(`profile`부터).
- `signup/page.tsx`: `handleVerify` 성공(미온보딩) 시 `goTo(FIRST_ONBOARDING_STEP)`. consent 제출 성공 시 `goTo("profile")`.
- `callback/google/page.tsx`: 신규 사용자 라우팅을 `?step=profile` → `?step=consent` 로 변경(현 라우팅 구현 확인 필요).
- 뒤로가기: consent는 첫 온보딩 스텝 → 인증된 사용자는 verify/password로 못 돌아감(기존 `ONBOARDING_STEPS` 가드가 처리).

### "동의 전 계정 생성" 정당화
이메일은 `/auth/signup`에서 계정 row가 동의 **전에** 생성된다. 다음으로 방어한다(법무 확인 항목):
- 계정을 **pending(미완성)** 으로 두고 **필수 동의 미완료 이탈 시 파기**하는 정책(BE).
- 수집 항목은 계정 생성 최소치(email·password)이고, 직후 동의 스텝에서 그 수집에 대한 동의를 받는다.
- "서비스 제한"은 PIPA상 정당하다 — **필수** 동의 미동의 시 서비스 제한은 허용. 반대로 **선택** 동의 거부를 이유로 서비스를 막으면 위반. 본 설계는 필수만 막는다.

---

## 5. UI 설계

표시 방식: **"전체 동의" 1개 + 항목별 펼쳐보기(progressive disclosure)** — 입력 허들 최소화와 분리동의를 양립.

- **전체 동의** 마스터 체크박스: 활성 항목 전체를 토글. 개별 상태와 양방향 동기화.
- 항목 행: 체크박스 + 라벨 + `(필수)`/`(선택)` 배지 + "보기"(펼침 → `summary`/`detailHref`).
- **필수 미충족 시 "다음" 비활성.** 선택 항목은 미동의해도 진행 가능.
- 톤: 경쟁/압박 없이 안정감(프로젝트 원칙). 한 화면 = 하나의 핵심 행동(동의).
- 컴포넌트: `components/features/auth/ConsentStep.tsx`(가칭) — config 배열을 받아 렌더하는 표현 컴포넌트 + 선택/게이팅 로직 훅 분리.

### 14세 게이트
- 1차 게이트 = `age14` 필수 체크박스(Notion 문서 골격과 동일).
- 백스톱(선택): `profile` 스텝의 생년월일(`birth`)로 만 14세 미만 계산·차단 — 모순 입력 방지. MVP 필수 아님(법무 확인).

---

## 6. 데이터 흐름 & 백엔드 계약 (BE 의존성)

동의 스텝에서 **전용 호출로 즉시 기록**한다(verify/callback로 쿠키가 이미 있어 authenticated).

```
POST /auth/consent        (신규 — BE 작업 필요, authenticated)
{
  agreements: [
    { id: "termsOfService",      version: "v1", granted: true  },
    { id: "privacyRequired",     version: "v1", granted: true  },
    { id: "age14",               version: "v1", granted: true  },
    { id: "personalizedService", version: "v1", granted: false },
    { id: "marketing",           version: "v1", granted: false }
  ]
}
// 응답: 200 OK
```

- 클라는 **활성 항목의 granted 맵 + version만** 전송. **동의 시각은 서버가 수신 시점에 기록**(클라 시계 불신).
- 서버는 **동의 원장(ledger)** 에 (user, id, version, granted, timestamp)를 적재 → 정책 개정 시 재동의 판단·입증(Notion 리스크 I).
- **서버가 진짜 게이트**: 필수 동의 미기록 시 `/auth/onboarding`·서비스 거부. 프론트 차단은 UX용 보조.
- 프론트는 `lib/api/client.ts`의 `api.post` 사용, 에러는 기존 `ApiError` 패턴(토스트) 준수.

> BE에 넘길 항목: `POST /auth/consent` 스펙, 동의 원장 스키마, 서버측 필수동의 강제, pending 계정 파기 정책. (별도 BAC 이슈로 연결 — 본 작업 산출물에서는 제외, 추후 생성)

**알려진 잠재 이슈 — 동의 후 새로고침 시 스텝 복원 (Codex P2, PR #108):** consent 제출은 `goTo("profile")`로 로컬 상태만 바꾸고 URL은 `?step=consent`로 남는다. `CONSENT_ENABLED=on` + `/auth/consent` 라이브 이후, profile 단계에서 새로고침하면 URL 복원 effect가 다시 consent로 되돌려 중복 `POST /auth/consent`가 발생할 수 있다. 현재는 **발동 불가(latent)** — 플래그가 기본 off이고 엔드포인트가 미배포라 `handleConsent`의 성공 분기(`goTo("profile")`)에 도달하지 못한다. 올바른 수정은 클라 sessionStorage 우회가 아니라 **서버 동의 상태 기반 스텝 복원**(복원 가드·`useRedirectIfAuthenticated`가 `/auth/me`의 consent 상태를 참조)이며, **BAC `/auth/consent` 연동과 함께** 반영한다. URL 정적 유지 가드(`bypassesConsent`)와 충돌하므로 클라 단독 URL 동기화로는 해결되지 않는다.

---

## 7. 범위 경계

**FRT-5 (프론트엔드)**
- 동의 config(`active`·`required`·`version`), `ConsentStep` 컴포넌트, 선택/게이팅 로직.
- consent 스텝을 온보딩 플로우에 편입(이메일·소셜 양 경로), `/auth/consent` 호출, 동의 이력 전송.
- 14세 필수 체크박스 게이트.
- 테스트(§8).

**별도 트랙 (FRT-5 외)**
- 법무/정책: 약관·처리방침 **전문**, 동의 문구·`version`·링크 확정, 위탁·국외이전·AI(Gemini) 고지, 맞춤광고/데이터사업 실문구·활성화 조건.
- 백엔드(BAC): `/auth/consent` 구현, 동의 원장, 서버 강제, pending 파기, Gemini 유료티어/DPA(기존 미결 액션).

AI 로직은 프론트에 두지 않는다(CLAUDE.md). 동의 판단·저장은 서버.

---

## 8. 테스트 전략 (docs/frontend-testing.md 매트릭스)

- **유닛(TDD, RED→GREEN)**: 동의 선택 로직 — 전체동의 ↔ 개별 양방향 동기화, 필수 전체 충족 시에만 `canProceed`, payload 빌더가 **활성 항목만** 직렬화(비활성 제외).
- **Storybook**: `ConsentStep` 상태 — 초기(미동의)/전체동의/필수만/선택 일부/required 미충족(다음 disabled)/펼쳐보기.
- **Playwright 스모크**: 가입 흐름 — verify 후 consent 진입 → 필수 동의 → profile 진입. 필수 미동의 시 "다음" 차단.

---

## 9. 미해결 / 법무 확인 체크리스트

- [ ] pending 계정 파기 정책(필수 동의 미완료 이탈 시 기간·방법) — BE/법무
- [ ] "동의 직전 이메일 수집(계정 생성)" 구조의 적정성 — 법무
- [ ] 기존(FRT-5 이전) 회원 재동의 범위 — **MVP=신규 가입자만**, version 원장으로 추후 재동의 캠페인 가능
- [ ] 맞춤광고·데이터사업 활성화 조건(처리 실체 + 받는 자/항목/목적 특정 + 법무 문구)
- [ ] 약관·처리방침 전문 작성 → 변호사 검토(출시 전 필수)
- [ ] 처리방침 고지: 위탁·국외이전(Google/PostHog/Sentry/Vercel)·자동분석(AI) — 정책/법무
- [ ] Gemini API 유료티어/Vertex + DPA 전환 확인 — BE(기존 미결 액션)

---

## 10. 참고

- Notion: 웹사이트 개발 TF → Document Hub → "ARC 이용약관·개인정보 동의 — 예시 골격 + 고려사항 (FRT-5)"
- 법리 triage: `docs/legal/2026-06-05-frt-5-privacy-triage.md` (브랜치 `worktree-frt-5-privacy-triage`, dev 미병합)
- 소셜 동의 관례 조사: 카카오싱크(developers.kakao.com), 소셜 로그인 필수 동의 주의(catchsecu.com/archives/13964)
