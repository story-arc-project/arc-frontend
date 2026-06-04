import { http, HttpResponse } from "msw";

/**
 * Storybook용 네트워크 경계 MSW 핸들러.
 *
 * API 직접호출 컴포넌트(`BookmarkToggle` 등)가 마운트/인터랙션 시 내는 fetch를 가로채
 * 실제 백엔드 없이 결정적으로 응답한다. 데이터 mock(`lib/api/mocks/*`)과 달리 이쪽은
 * fetch 자체를 인터셉트하므로 401 → /login 리다이렉트 같은 비결정 동작을 차단한다.
 *
 * 요청은 `${NEXT_PUBLIC_API_URL}` 절대 URL로 나가므로(`lib/api/client.ts`) origin/base에
 * 무관하게 매칭되도록 선행 와일드카드(`*`)를 쓴다.
 */

// `addBookmark`/`removeBookmark`는 body 없는 POST/DELETE다(`lib/api/analysis-api.ts`).
// 204 No Content로 응답해야 클라이언트의 happy-path(`client.ts`의 status===204 → undefined)를 탄다.
// 200 + 빈 body면 `res.json()`이 실패해 INVALID_JSON throw → 컴포넌트가 조용히 삼켜 토글이 안 된다.
export const bookmarkHandlers = [
  http.post("*/analysis/bookmarks/:id", () => new HttpResponse(null, { status: 204 })),
  http.delete("*/analysis/bookmarks/:id", () => new HttpResponse(null, { status: 204 })),
];

/** preview에 등록되는 전역 기본 핸들러. 새 API 호출 컴포넌트는 여기에 핸들러를 추가하면 된다. */
export const defaultHandlers = [...bookmarkHandlers];
