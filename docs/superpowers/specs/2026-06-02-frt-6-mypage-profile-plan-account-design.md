# FRT-6 — 마이페이지: 프로필 편집·플랜·계정 정보 UI (Design)

- **Issue**: [FRT-6](https://linear.app/story-arc/issue/FRT-6) (Feature, Urgent)
- **Backend dependency**: [BAC-5](https://linear.app/story-arc/issue/BAC-5) `PATCH /auth/profile` — *Todo, 미완료*
- **Sibling dependency**: 비밀번호 재설정 화면 (별도 FRT, 예상 **FRT-8**) — *미존재*
- **Target screen**: `app/(main)/settings/page.tsx`
- **Date**: 2026-06-02
- **Branch**: `feature/frt-6` (base: `dev`)

---

## 1. Overview

마이페이지(`settings/page.tsx`)는 현재 **이름·이메일 + 로그아웃**만 있는 최소 상태다. phase-1 명세의 "프로필 편집·플랜 확인"과 `Account` 타입의 `has_password`·`email_verified`·`connected_oauth` 활용이 빠져 있다.

이 작업은 **프론트 UI만** 다룬다. 백엔드 의존(프로필 저장, 비밀번호 재설정)이 미완성이므로, **읽기 가능한 정보는 실제 동작**시키고 **쓰기 동작은 노출하되 비활성("준비 중")** 으로 처리한다.

## 2. Scope

### In scope
- 프로필 편집 **폼** (온보딩 항목): 이름·생년월일·전화·소속(학력)·학교·학과·고민(worry)·관심사(interest)
- 현재 플랜 표시 (Free 고정 placeholder) + 업그레이드 안내
- 계정 정보: 이메일, 이메일 인증 여부, 연결된 소셜 — **실제 데이터로 동작**
- 비밀번호 변경/설정 진입점 (`has_password` 분기) — **비활성('준비 중')**
- 로그아웃 (기존 유지)
- 데스크톱 우선 + 모바일 반응형 레이아웃

### Out of scope (deferred)
- 프로필 저장 API 연동 → BAC-5 머지 후 (이번엔 저장 버튼 **비활성**)
- 저장 성공/실패 토스트 → 저장 활성화 시점에 함께
- 실제 비밀번호 재설정 플로우 → FRT-8
- 실제 플랜(Pro) 데이터/결제 → 백엔드 plan 필드 신설 후
- 회원 탈퇴 → FRT-9 (이 이슈가 block)
- 테스트 러너 도입 (레포에 미존재; 범위 외)

## 3. Decisions (user-confirmed)

| 항목 | 결정 | 이유 |
|---|---|---|
| 프로필 저장 | 폼은 만들되 **저장 비활성** | BAC-5 미완성. 존재하지 않는 엔드포인트 호출 위험 0 |
| 플랜 | **Free 고정 placeholder + 업그레이드 안내** | plan 필드 부재. DoD 충족하되 추후 실데이터 교체 |
| 비밀번호 진입점 | **노출 + '준비 중' 비활성** | 재설정 화면(FRT-8) 미존재. 라벨은 `has_password`로 분기 |
| 레이아웃 | **데스크톱 우선 + 반응형** | 사용자 지시 |
| 컨테이너 폭 | **`max-w-4xl`** | `(main)` 표준(dashboard·analysis 전부 `max-w-4xl mx-auto`) |

## 4. Componentization

기존 `components/features/archive/` 컨벤션을 따라 `components/features/settings/` 신설. 페이지는 얇은 컴포저, 각 카드는 독립적으로 읽고 이해 가능한 단위.

| Component | 책임 | 데이터 | 동작 |
|---|---|---|---|
| `ProfileEditForm.tsx` | 온보딩 항목 편집 입력 + 로컬 dirty 상태 + **비활성 저장** + 안내 | `user.profile` | 입력 live, 저장 inert |
| `PlanCard.tsx` | "현재 플랜: Free" + 업그레이드 안내 CTA | static | placeholder |
| `AccountInfoCard.tsx` | 이메일·인증 여부·연결된 소셜 | `user.account` | **fully live** |
| `SecurityCard.tsx` | 비밀번호 변경/설정 진입점 | `account.has_password` | inert (FRT-8) |
| `page.tsx` | 조합 + 로딩 + 로그아웃 + 레이아웃 grid | `useAuth()` | live |

> 페이지 컴포넌트는 default export 1개 규칙 유지. 하위 컴포넌트는 named export.

## 5. Layout (desktop-first, responsive)

- **컨테이너**: `mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-12`
- **데스크톱(`lg+`)**: `grid grid-cols-1 lg:grid-cols-12 gap-6`
  - 폼: `lg:col-span-8`
  - 사이드바: `lg:col-span-4` (`space-y-6` 로 플랜→계정정보→보안→로그아웃 스택)
- **모바일(`<lg`)**: 단일 컬럼, 순서 = 타이틀 → identity → 프로필 편집 → 플랜 → 계정 정보 → 보안 → 로그아웃

```
내 계정                                                        ← h1 (text-heading-2)
┌──────────────────────────────────────────────────────────────┐
│ (avatar)  이름                              email              │ identity strip (full width Card)
└──────────────────────────────────────────────────────────────┘
┌─────────────────────────────────┐  ┌──────────────────────────┐
│ 프로필 편집        col-span-8     │  │ 현재 플랜    col-span-4   │
│  이름      │ 생년월일             │  │  [Free]                  │
│  전화번호   │ 소속(버튼 grid)      │  │  Pro 업그레이드 안내 →    │ (secondary)
│  학교      │ 학과 (학생일 때)      │  ├──────────────────────────┤
│  고민    ◯◯◯ (Chip, full row)    │  │ 계정 정보      (LIVE)     │
│  관심사  ◯◯◯ (Chip, full row)    │  │  이메일  a@b.com         │
│  ⓘ 저장은 곧 제공돼요 (BAC-5)     │  │  이메일 인증 [인증됨]      │ Badge success/warning
│  [ 저장 ] (primary · 비활성)      │  │  연결된 소셜  Google      │
└─────────────────────────────────┘  ├──────────────────────────┤
                                      │ 보안                     │
                                      │  비밀번호 변경/설정       │ (secondary · 비활성)
                                      │   (준비 중 · FRT-8)       │
                                      └──────────────────────────┘
                                        [ 로그아웃 ] (destructive)
```

내부 반응형:
- 폼 입력 페어: `grid grid-cols-1 sm:grid-cols-2 gap-4`
- 소속(affiliation) 버튼: `grid grid-cols-2 sm:grid-cols-4 gap-2`
- 고민/관심사 칩: `flex flex-wrap gap-2`
- 버튼: 모바일 `fullWidth`, 데스크톱 auto

## 6. Reuse (신규 의존성·리팩토링 없음)

- 프리미티브: `Input`, `DatePicker`(`mode="date"`), `Chip`, `Badge`, `Card`/`CardHeader`/`CardTitle`, `Button` (`@/components/ui`)
- 온보딩 옵션·헬퍼: `app/(auth)/constants.ts` 의 `AFFILIATION_OPTIONS`, `Q1_OPTIONS`(worry), `INTEREST_OPTIONS`, `formatPhone`, `formatBirth`
- 디자인 토큰: `globals.css` (시맨틱 토큰·타이포 클래스만 사용, 하드코딩 색/폰트/마진 금지)
- 카드는 border 기반(과도한 shadow 금지), **primary 버튼은 화면당 1개**(저장)

## 7. Data flow & field mapping

`useAuth()` → `user: AuthUser { account, profile, onboarded }`. `profile` 은 온보딩 전 `null` 가능.

### 7.1 읽기(pre-fill) 포맷 — 확인된 실데이터 형태 (`lib/demo/seed.ts:573`)
```
account: { email, has_password, email_verified, connected_oauth: string[] }
profile: {
  name: string,                 // 직접 prefill
  birth: "2002-03-15",          // YYYY-MM-DD → DatePicker 직접
  phone: "" | "01012345678",    // raw → formatPhone()로 표시
  education: "재학",            // ⚠ 자유형 문자열 (enum/label과 불일치)
  school: "한양대학교",
  department: "컴퓨터소프트웨어학부",
  worry: string[],              // ⚠ 옵션 상수와 불일치 가능
  interest: ["AI/ML", ...]      // ⚠ 옵션 상수와 불일치 가능
}
```

### 7.2 ⚠ 읽기/쓰기 포맷 비대칭 (keystone risk)
온보딩 `POST /auth/onboarding`(signup/page.tsx:212-221)은 `affiliation`(student/employed/jobseeker/other) + 조건부 `school/department/company/desiredRole/affiliationDetail` 를 보낸다. 그러나 읽기 타입 `Profile` 은 `education`(예: `"재학"`)을 쓰고 company/desiredRole/affiliationDetail 필드가 없다. 즉 **읽기 포맷 ≠ 쓰기 포맷이며 `education`/`worry`/`interest`의 실제 저장값 포맷이 미확정**이다. BAC-5 DoD에도 "me 응답과 필드 일관성 확인"이 포함되어 있다.

**방어적 pre-fill 전략 (저장이 inert이므로 표시 정확성만 영향):**
- 명확한 문자열(name·birth·phone·school·department): 그대로 prefill
- 소속(education) 버튼 grid: `profile.education` 이 `AFFILIATION_OPTIONS[].value` 와 일치하면 해당 버튼 선택, **불일치 시 미선택**(깨져 보이지 않음). `// TODO(BAC-5)` 주석으로 매핑 확정 필요 표기
- 고민/관심사 칩: 옵션 목록 칩 중 `profile.worry`/`profile.interest` 에 존재하는 값만 선택 표시. 목록 밖 값은 미선택(graceful)
- 학교/학과 노출 조건: 소속이 student로 매핑되거나 **기존 `school`/`department` 값이 있으면** 노출 (education 포맷 미확정 시에도 기존 데이터가 숨겨지지 않도록 방어). 데모(`education:"재학"`+학교/학과 보유) 케이스 검증됨

### 7.3 쓰기(저장)
이번 범위에서는 **호출하지 않음**. `ProfileEditForm` 은 로컬 상태로 dirty 추적만 하고, 저장 버튼은 `disabled`. `lib/api/auth-api.ts` 에 `// TODO(BAC-5): updateProfile()` 시밍 주석만 남기고 dead call 미생성. BAC-5 머지 시 함수 1개 추가 + 버튼 활성화로 완결.

### 7.4 편집 가능 필드 vs BAC-5
BAC-5 PATCH 목록: name·birth·phone·education(학력)·worry·interest. **school/department 는 BAC-5 목록에 없음** → UI엔 포함하되 BAC-5에 patch 가능 여부 정합 필요(리스크 9 참조). company/desiredRole/affiliationDetail 은 `Profile` 타입에 없어 폼에서 제외.

## 8. States & edge cases

- `isLoading` → 기존 스피너 유지
- `profile === null`(온보딩 전): 입력 빈값 렌더, 저장은 이미 비활성이라 깨진 동작 없음. (선택) 상단에 "온보딩을 먼저 완료해주세요" 안내 — 경량 처리
- `connected_oauth` 빈 배열: "연결된 소셜 없음" 표시
- `email_verified=false`: `Badge variant="warning"` "미인증" (인증 재발송 액션은 범위 외)
- 저장 버튼: `disabled` + 인라인 안내 "프로필 저장은 곧 제공돼요 (BAC-5)"
- 비밀번호 버튼: `disabled` + "준비 중 (FRT-8)" hint, 라벨은 `has_password ? "비밀번호 변경" : "비밀번호 설정"`
- demo mode: `useAuth()`가 demo seed를 그대로 반환하므로 자동 호환

## 9. Verification (no TDD harness)

레포에 테스트 러너 없음(scripts: dev/build/lint/typecheck). 러너 도입은 범위 외(변경 범위 최소화). 검증:
1. `npm run typecheck` (tsc --noEmit)
2. `npm run lint` (eslint)
3. `npm run build` (next build)
4. 브라우저 스모크(Playwright MCP): 데스크톱/모바일 폭, `email_verified` 분기, `connected_oauth` 유/무, `has_password` 분기, 저장·비밀번호 버튼 비활성 + 안내 표시 확인
PR에 "검증 = type/lint/build + 수동 브라우저, 단위테스트 아님" 명시.

## 10. Risks / open questions

1. **`education`/`worry`/`interest` 읽기 포맷 미확정** (§7.2). 저장 inert라 기능 위험은 없으나 pre-fill 표시가 다를 수 있음 → BAC-5에서 `/auth/me` 필드 포맷 확정 필요. 방어적 매핑으로 "깨져 보임" 회피.
2. **school/department patch 가능 여부** BAC-5 목록 미포함 → 백엔드 정합 필요. UI엔 포함(무해, 저장 inert).
3. **플랜 placeholder**가 실제 Free와 다를 수 있음 → plan 필드 신설 시 교체. 사용자 오해 방지 위해 "안내" 톤 유지.
4. `app/(auth)/constants.ts` 를 `(main)` 컴포넌트에서 import (경량 cross-route 커플링). 리팩토링 회피 위해 import 유지(DRY). 추후 공용 상수 이동은 별도 작업.
5. 토스트(`ToastContainer`)가 `(main)/layout.tsx` 에 미마운트로 보임 → 저장 활성화(토스트 필요) 시 마운트 확인 필요. 이번 범위에선 토스트 미사용.

## 11. Implementation outline (writing-plans에서 상세화)

1. `components/features/settings/AccountInfoCard.tsx` (live, 가장 단순) — 이메일/인증/소셜
2. `components/features/settings/PlanCard.tsx` — Free placeholder + 안내
3. `components/features/settings/SecurityCard.tsx` — 비밀번호 진입점(비활성)
4. `components/features/settings/ProfileEditForm.tsx` — 입력 + dirty + 비활성 저장 + 방어적 prefill
5. `app/(main)/settings/page.tsx` — identity strip + 반응형 grid 조합, 로그아웃 유지
6. 검증(§9)
