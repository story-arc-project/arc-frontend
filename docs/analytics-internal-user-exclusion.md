# 팀 행동을 지표에서 제외하기 (FRT-139)

우리 넷이 하루에도 수십 번 오가는 행동이 실사용자 행동과 섞이면, 사용자가 15명인 유저테스트에서
퍼널 숫자를 믿을 수 없다. 이 문서는 **무엇이 제외되고, 그게 실제로 되고 있는지 어떻게 확인하는가**를
정본으로 남긴다.

## 제외는 두 겹이다

| | 무엇을 거르나 | 어디에 설정 | 과거 데이터 |
|---|---|---|---|
| ① person 표식 | 팀 계정으로 **로그인한 뒤**의 모든 이벤트 | 코드(자동) + PostHog 필터 | ❌ 소급 안 됨 |
| ② distinct_id 필터 | 팀원의 **모든** 이벤트(과거 포함) | PostHog 콘솔 | ✅ 소급됨 |

두 겹인 이유는 서로의 구멍을 메우기 때문이다. ①은 팀원이 늘어도 `ADMIN_EMAILS`만 고치면 자동으로
따라오지만 **과거 이벤트에는 소급되지 않는다**(이 프로젝트는 person-on-events 모드라, 이벤트에 박히는
person 속성은 인제스트 *시점*의 값이다). ②는 과거까지 즉시 걷어내지만 사람이 늘 때마다 콘솔을 손봐야 한다.

### ① person 표식 — 코드가 자동으로 심는다

- 판정: 서버 전용 env `ADMIN_EMAILS` → `/api/admin/status` → `useIsAdmin()`
  (운영자 이메일 목록은 클라이언트 번들에 실리지 않는다 — `lib/auth/admin.ts` 계약)
- 심는 곳: `components/analytics/InternalUserTagger.tsx` → `markInternalUser()` (`lib/analytics/client.ts`)
- 심는 값: person 속성 `$internal_or_test_user = true`
- 걸리는 곳: PostHog 프로젝트 `test_account_filters` → 코호트 `Internal / Test users`

전송 자체를 막지 않는 이유는 **되돌릴 수 있게** 하기 위해서다. 필터를 끄면 팀 행동도 다시 보인다.
무료 티어 이벤트 예산이 실제로 위험해지면 그때 같은 판정을 그대로 써서 전송 차단으로 승격하면 된다.

### ② distinct_id 필터 — PostHog 콘솔에서 관리한다

`distinct_id`는 **이메일을 정규화(trim + lowercase)한 뒤의 SHA-256 해시**다(`lib/analytics/hash.ts`).
따라서 팀원 이메일만 알면 해시를 직접 계산해 필터에 넣을 수 있다.

```bash
printf '%s' "team@story-arc.org" | shasum -a 256 | awk '{print $1}'
```

이 값을 PostHog → Settings → *Filter out internal and test users* 의 `distinct_id` 조건에 넣는다.

## 되고 있는지 확인하는 법

**A. 코드가 표식을 심는가 (자동)**

```bash
npx vitest run lib/analytics/client.test.ts components/analytics/InternalUserTagger.test.tsx
```

**B. 실제로 PostHog에 붙는가 (수동 — 배포 후 1회)**

1. 팀 계정으로 로그인해 기록을 하나 저장한다(`record_created` 발화).
2. PostHog → Activity(라이브 이벤트)에서 그 이벤트를 찾는다.
3. 해당 person 의 속성에 `$internal_or_test_user: true` 가 있는지 본다.
4. 아무 인사이트에서 *Filter out internal and test users* 를 켜고, 방금 그 이벤트가 **사라지는지** 본다.

4번이 핵심이다 — 표식만 붙고 필터가 꺼져 있으면 숫자는 그대로 더럽다.

**C. 내 계정이 지금 걸러지고 있나 (해시 대조)**

위 `shasum` 으로 자기 이메일 해시를 뽑아, PostHog Persons 에서 그 distinct_id 를 찾는다.
찾은 person 에 표식이 없으면 ①이 안 걸린 것이고, 필터 조건에 그 해시가 없으면 ②가 안 걸린 것이다.

## 알려진 한계

- **식별 전에 발화하는 이벤트는 두 겹 어디에도 안 걸린다.** 해당하는 건 `signup_method_selected`,
  `signup_completed`, `onboarding_completed` 세 가지다. 앞의 둘뿐 아니라 `onboarding_completed`
  까지인 이유는, 가입 플로우가 끝까지 `(auth)` 안에서 돌고 `AuthProvider` 는 가입 *전에* 이미
  `/auth/me` 를 비인증으로 확정해 두었기 때문이다 — 인증 상태가 갱신되는 건 온보딩 성공 뒤의
  하드 내비게이션(`window.location.assign("/dashboard")`)이고, 이벤트는 그 **직전**에 나간다.
  그래서 identify 도 admin 판정도 아직 없고, distinct_id 는 익명 UUID 라 ② 필터로도 못 걷는다.
  (`$pageview` 는 FRT-18 에서 봉인돼 애초에 안 쌓인다.)
  **감수하는 이유**: 이 셋은 계정당 평생 1회뿐이고 팀원은 이미 전원 가입을 마쳤다.
  이걸 막으려면 가입 임계 경로에 인증 재조회 + `/api/admin/status` 왕복을 끼워 넣어야 하는데,
  얻는 것(신규 팀원 1명당 이벤트 3건)에 비해 건드리는 곳이 너무 크다.
- **표식이 붙기 전에 나간 이벤트는 ①이 아니라 ②가 걷는다.** `/api/admin/status` 는 왕복이라,
  팀원의 **첫** 세션에서 로드 직후 발화하는 이벤트(예: `archive_entry_started`)는 표식보다 먼저
  인제스트된다. person-on-events 라 나중에 소급되지 않는다. 다만 재방문 사용자는 distinct_id 가
  localStorage 에 남아 있어 이 이벤트들도 **올바른 해시로** 들어가므로 ② 필터가 그대로 걷어낸다.
  → 두 겹으로 설계한 이유가 이것이다. ① 하나만 믿으면 이 구간이 조용히 샌다.
- **`ADMIN_EMAILS` 에서 빠져도 이미 붙은 표식은 자동으로 안 떨어진다.** person 속성은 서버 쪽에
  남고 `resetUser()` 나 새로고침으로는 지워지지 않는다 — 퇴사자의 이후 활동이 계속 제외된다.
  코드로 지우지 않는 이유는 `useIsAdmin()` 이 **로딩·실패·비인증을 모두 `false`** 로 접기 때문이다
  (fail-close). "확정된 false" 를 구분하지 않은 채 해제를 걸면 판정 요청이 한 번 실패한 진짜
  팀원의 표식이 지워진다. 지울 일이 생기면 **PostHog 콘솔에서 그 person 의 속성을 직접 지운다**
  (해제 대상이 팀원 이탈뿐이라 수동으로 충분하다).
- **팀원이 개인 이메일로 새 계정을 만들어 테스트하면 안 걸린다.** 그 계정도
  `ADMIN_EMAILS` 에 넣거나, 유저테스트 리허설은 별도 계정 없이 데모 모드(`/demo`)로 돈다
  (데모 모드는 `isDemoMode()` 로 이미 계측에서 통째 제외된다).
- **`ADMIN_EMAILS` 는 서버 런타임 값이라 수정 후 재배포가 필요하다.**
