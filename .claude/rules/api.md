---
paths:
  - "lib/api/**"
---

# API 클라이언트 규칙

- 응답은 **방어 파싱**: 서버 형태 변화(래퍼 유무, 객체 대신 문자열 등)에 throw 하지 말고 안전 분기.
  예: 파일 다운로드 `data`가 presigned URL 문자열 그 자체일 수 있다(BAC-1).
- refresh 실패는 3분기(`ok`/`unauthorized`/`error`)를 유지한다 — 5xx·네트워크 장애를
  로그아웃으로 뭉개면 유효 세션이 날아간다(FRT-11, ApiError 503).
- 파일 업로드는 presign → 스토리지 직접 PUT → confirm 흐름. `AbortSignal`은 전 구간 전달하고
  취소는 AbortError로 매핑한다.
- 디버그 로깅은 client.ts/server.ts의 DEBUG(`NEXT_PUBLIC_API_DEBUG`) 게이트 로거만 사용.
  그 외 console 사용은 ESLint(no-console)가 차단한다.
- AI 판단 로직 금지 — backend API 호출만. 공개 시그니처(함수명·타입) 변경은 UI/훅 영향 범위를 먼저 확인.
