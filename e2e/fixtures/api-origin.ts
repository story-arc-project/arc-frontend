// 테스트 백엔드 origin 의 **단일 출처(single source of truth)**.
//
// `playwright.config.ts` 의 webServer 가 이 값을 dev 서버의 `NEXT_PUBLIC_API_URL`
// 로 주입하고, `stub-api.ts` 가 동일 origin 을 `page.route` 로 가로챈다. 두 곳이
// 같은 상수를 import 하므로, 테스트 러너 프로세스의 환경 변수(`NEXT_PUBLIC_API_URL`)
// 가 무엇이든 **앱이 fetch 하는 origin 과 스텁이 가로채는 origin 이 갈라지지 않는다**.
//
// (러너 env 에서 읽으면: 앱은 config 가 주입한 :8000 으로 fetch, 스텁은 러너 env
//  origin 을 가로채 → 불일치로 실제 백엔드 누수 + 계약 스펙은 거짓 통과. 그걸 차단.)
export const API_ORIGIN = "http://localhost:8000";
