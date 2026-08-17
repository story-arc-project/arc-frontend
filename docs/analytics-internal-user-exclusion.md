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

- **로그인 전 익명 이벤트는 걸러지지 않는다.** 해당하는 건 `signup_method_selected` 와
  가입 직후의 `signup_completed` 뿐이다(`$pageview` 는 FRT-18 에서 봉인돼 애초에 안 쌓인다).
- **팀원이 개인 이메일로 새 계정을 만들어 테스트하면 안 걸린다.** 그 계정도
  `ADMIN_EMAILS` 에 넣거나, 유저테스트 리허설은 별도 계정 없이 데모 모드(`/demo`)로 돈다
  (데모 모드는 `isDemoMode()` 로 이미 계측에서 통째 제외된다).
- **`ADMIN_EMAILS` 는 서버 런타임 값이라 수정 후 재배포가 필요하다.**
