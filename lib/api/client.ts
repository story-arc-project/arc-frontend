"use client";

import { ApiError } from "./api-error";
import { parseErrorBody } from "./error-body";

export { ApiError } from "./api-error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEBUG = process.env.NEXT_PUBLIC_API_DEBUG === "true";

function logRequest(method: string, path: string, body?: unknown) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console -- NEXT_PUBLIC_API_DEBUG 게이트 로거
  console.log(`[API →] ${method} ${path}`, body ?? "");
}

function logResponse(method: string, path: string, status: number, duration: number) {
  if (!DEBUG) return;
  const color = status < 400 ? "color:green" : "color:red";
  // eslint-disable-next-line no-console -- NEXT_PUBLIC_API_DEBUG 게이트 로거
  console.log(`[API ←] %c${status}%c ${method} ${path} (${duration}ms)`, color, "");
}

// ──────────────────────────────────────────────
// Core request
// ──────────────────────────────────────────────

// `auth: false`를 넘기면 401 시 로그인 리다이렉트를 하지 않음 (비인증 라우트 전용)
type RequestOptions = RequestInit & { auth?: boolean };

// refresh 결과를 3분기로 구분한다. 5xx·네트워크 장애(일시적)와 401/403(재인증 필요)을
// 같은 false로 뭉개면, 일시 장애로 갱신에 실패한 유효 세션까지 로그아웃 처리된다.
type RefreshResult = "ok" | "unauthorized" | "error";

// 진행 중인 refresh 를 401 을 받은 모든 요청이 공유한다. 각자 쏘면 브라우저가 아직 갱신되지
// 않은 **같은 쿠키**를 전부에 실어 보내고, 서버는 회전된 옛 토큰의 재사용(=탈취)으로 보아
// 403 + 쿠키 삭제로 응답한다. 그 삭제가 먼저 성공한 refresh 가 심어 둔 새 쿠키까지 지우므로
// 유효한 세션이 죽는다 — 403 을 관대하게 분류해도 이미 쿠키가 없어 되살릴 수 없다.
// 그래서 처방은 분류가 아니라 **두 번째 요청을 애초에 보내지 않는 것**이다 (FRT-209/FRT-253).
//
// 주의: 위 "403 은 되살릴 수 없다"는 **이 엔드포인트(`/auth/refresh`)에 한한** 이야기다.
// 일반 요청의 403 은 쿠키가 살아 있어 되살릴 수 있다 — `ROTATED_OUT_CODE` 아래를 볼 것.
let inflightRefresh: Promise<RefreshResult> | null = null;

function tryRefresh(): Promise<RefreshResult> {
  // 완료 후 반드시 비운다. 결과가 눌러앉으면 다음 만료 때 갱신이 영영 되지 않는다.
  inflightRefresh ??= runRefresh().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

// 갱신이 성공할 때마다 오른다. 요청은 **보내기 직전의 값**을 기억해 두었다가 401/403 을 받은
// 순간 다시 읽는다. 값이 달라져 있으면 "내가 나간 뒤에 이미 누군가 갱신을 끝냈다"는 뜻이고,
// 브라우저는 그때 심어진 새 쿠키를 이미 들고 있다.
let refreshGeneration = 0;

// 쿠키는 탭이 공유하지만 위 세대는 모듈 지역 변수라 **탭마다 별개다**. 그대로 두면 다른 탭이
// 방금 심어 준 최신 쿠키를 이 탭이 "낡았다"고 오해해 한 번 더 회전시키고, 그 회전이 저쪽 탭의
// 요청을 403 에 빠뜨린다 — 바로 위에서 막은 물결이 탭 경계를 넘은 판본이다. 갱신 성공을
// 방송해 세대를 맞추면 그 왕복이 끊긴다.
//
// 다만 방송이 403 보다 먼저 닿는다는 보장은 없으므로 **첫 한 번의 중복 회전까지 없애지는
// 못한다**. 없애는 것은 그 뒤의 왕복이다. 경계 자체를 지우는 것은 백엔드 회전 유예 창(BAC-64).
//
// SSR 프리렌더는 Node 위에서 도는데 Node 에도 `BroadcastChannel` 이 있다 — 거기서 열면 열린
// 채널이 빌드의 이벤트 루프를 붙잡을 수 있으므로 `window` 로 가른다.
const refreshChannel =
  typeof window !== "undefined" && typeof BroadcastChannel === "function"
    ? new BroadcastChannel("arc-auth-refresh")
    : null;

if (refreshChannel) {
  // 명세상 방송은 **발신자 자신에게는 돌아오지 않는다**. 그래서 갱신한 탭은 `runRefresh` 에서
  // 직접 올리고, 여기서는 남의 갱신만 받는다.
  refreshChannel.onmessage = () => {
    refreshGeneration += 1;
  };
}

async function runRefresh(): Promise<RefreshResult> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      refreshGeneration += 1;
      refreshChannel?.postMessage("refreshed");
      return "ok";
    }
    // 401/403 = refresh token 만료·무효 → 진짜 재인증 필요
    if (res.status === 401 || res.status === 403) return "unauthorized";
    // 그 외(5xx 등) = 일시 장애 → 세션을 끊지 않고 에러로 surface
    return "error";
  } catch {
    // 네트워크 오류도 일시 장애로 취급
    return "error";
  }
}

// 액세스 토큰은 **자기를 발급한 refresh 토큰의 jti 를 품는다**
// (arc-backend `utils/token.py`: `create_access_token(user_id, ref.jti)`). refresh 가 성공하면
// 옛 행에 `next` 가 박히므로 직전 액세스 토큰도 **그 순간 함께 죽고**, 그 토큰을 실은 요청은
// `check_auth` 에서 403 `AUTH_REUSE_DETECTED` 로 거절된다 — 유예 창은 없다.
//
// 이 403 은 `/auth/refresh` 의 403 과 다르다. `check_auth` 는 `remove_tokens` 를 부르지 않아
// **쿠키가 살아 있고**, 갱신 후 다시 보내면 그대로 성공한다. FRT-209 에서 "403 은 관대하게
// 읽어도 이미 쿠키가 없어 못 살린다"고 적은 것은 **refresh 엔드포인트에 한한** 이야기였는데,
// 그 판단을 일반 요청까지 확대한 것이 재발의 원인이었다. 같은 상태 코드라도 어느 엔드포인트가
// 주었는지에 따라 복구 가능성이 갈린다.
const ROTATED_OUT_CODE = "AUTH_REUSE_DETECTED";

// 액세스 토큰과 **무관한** 401. 갱신해도 영원히 401 이고, 그 사이 원요청이 되풀이 전송된다 —
// 탈퇴 DELETE 가 3번 나가고 실패 횟수 집계까지 오염되며, 매 라운드의 회전이 다른 요청의 토큰을
// 죽인다. arc-backend `api/auth.py` 가 내는 401 을 전수 확인해 두 종류를 골랐다.
// - `INVALID_CREDENTIALS`: 비밀번호 오답 (`/login`, `/account/password`)
// - `SOCIAL_AUTH_FAILED`: 소셜 인증 실패 (`/social-login`, `/account/social`)
// 나머지 401 은 전부 `AUTH_MISSING_COOKIES`·`AUTH_TOKEN_EXPIRED`·`AUTH_TOKEN_INVALID` 로,
// 갱신이 정확히 그것을 고친다.
//
// 가려내는 **방향**이 중요하다. "갱신 가능한 코드만 허용"으로 좁히거나 `auth: false` 요청을
// 통째로 제외하면 `/auth/me` 도 `auth: false` 라(`lib/api/auth-api.ts`) 세션 복원이 함께 죽는다.
// 그래서 "고칠 수 없는 코드만 제외"로 둔다 — 코드가 없는 401 은 지금처럼 갱신한다.
const UNRECOVERABLE_401_CODES = new Set(["INVALID_CREDENTIALS", "SOCIAL_AUTH_FAILED"]);

// 갱신 경계를 걸친 요청에 줄 기회. 1 이면 갱신 직후의 재시도가 또 경계에 걸렸을 때 그 요청이
// 영구히 실패한다 — 신고된 트레이스가 정확히 그 상태였다(refresh 200 뒤 401 넷이 그대로 죽고,
// 두 번째 갱신을 받은 하나만 200 으로 돌아왔다). 상한이 없으면 회전이 잦은 서버에서 한 요청이
// 영원히 맴돌 수 있으므로 2 로 묶는다.
const MAX_REFRESH_ROUNDS = 2;

async function request<T>(
  path: string,
  options: RequestOptions = {},
  refreshRoundsLeft = MAX_REFRESH_ROUNDS
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  const method = fetchOptions.method ?? "GET";
  logRequest(method, path, isFormData ? "[FormData]" : fetchOptions.body);
  const start = performance.now();

  // 이 요청이 어느 세대의 쿠키를 싣고 나갔는지. 반드시 fetch **앞에서** 읽는다.
  const generationAtSend = refreshGeneration;

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: isFormData
      ? fetchOptions.headers
      : { "Content-Type": "application/json", ...fetchOptions.headers },
  });

  logResponse(method, path, res.status, Math.round(performance.now() - start));

  if ((res.status === 401 || res.status === 403) && refreshRoundsLeft > 0) {
    // 본문은 한 번만 읽을 수 있으니 여기서 한 번 파싱해 판정과 throw 에 함께 쓴다.
    const body = await parseErrorBody(res);

    // 갱신해도 달라지지 않는 응답은 여기서 갈라 그대로 던진다.
    // - 403 은 "내 액세스 토큰이 갱신에 밀려났다"일 때만 되살린다. 진짜 폐기(`AUTH_REVOKED`)나
    //   인가 실패는 대상이 아니다.
    // - 401 은 반대로 **고칠 수 없는 것만** 뺀다 (`UNRECOVERABLE_401_CODES` 주석 참조).
    const unrecoverable =
      res.status === 403
        ? body.code !== ROTATED_OUT_CODE
        : UNRECOVERABLE_401_CODES.has(body.code ?? "");
    if (unrecoverable) {
      throw new ApiError(res.status, body.message ?? "오류가 발생했어요.", body.code);
    }

    // 내가 나간 뒤에 이미 갱신이 끝나 있었다면 **또 갱신하지 않는다**. 여기서 갱신하면 방금
    // 심어진 새 토큰까지 회전시켜, 그 토큰으로 재시도 중이던 다른 요청들을 통째로 403 에
    // 빠뜨린다 — 신고 트레이스의 두 번째 401/403 물결이 이렇게 만들어진다. 되살리기가 스스로
    // 다음 물결을 낳는 셈이다. 브라우저는 이미 새 쿠키를 들고 있으니 그대로 다시 보내면 된다.
    // (갱신이 아직 진행 중이라면 세대는 그대로이므로 아래 `tryRefresh` 가 그것에 합류한다.)
    if (refreshGeneration !== generationAtSend) {
      return request<T>(path, options, refreshRoundsLeft - 1);
    }

    // 여기까지 온 403 은 "내 액세스 토큰이 회전에 밀려났는데 **내 탭은 갱신한 적이 없다**"는
    // 뜻이다 — 회전시킨 것은 다른 탭이다. 이때 갱신을 보내면 아직 교체되지 않았을 수 있는 **옛
    // 리프레시 쿠키**를 싣게 되고, 서버는 그것을 재사용(=탈취)으로 보아 `remove_tokens` 로 쿠키를
    // 지운다. 화면 하나가 안 뜬 대가로 로그인 상태 전체를 잃는 셈이다.
    //
    // 재전송이 갱신을 **지배한다**. 쿠키가 이미 교체돼 있으면 재전송이 성공하고(갱신도 성공했을
    // 상황), 교체돼 있지 않으면 갱신은 반드시 재사용 탐지에 걸린다. 그러니 갱신할 이유가 없다 —
    // 다시 보내 보고, 그래도 403 이면 세션을 건드리지 않고 그대로 던진다(아래 `!res.ok`).
    // 위 세대 방송(`BroadcastChannel`)은 이 재전송 한 번마저 아껴 줄 뿐이다.
    if (res.status === 403) {
      return request<T>(path, options, refreshRoundsLeft - 1);
    }

    const refresh = await tryRefresh();
    if (refresh === "ok") {
      return request<T>(path, options, refreshRoundsLeft - 1);
    }
    if (refresh === "error") {
      // refresh 자체가 일시 장애(5xx·네트워크) → 비인증으로 단정하지 않는다.
      // /login으로 튕기지 않고 에러를 던져, 호출부(AuthGate 등)가 재시도 화면을 띄우게 한다.
      throw new ApiError(503, "인증 갱신에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
    // refresh === "unauthorized" → 재인증 필요 → 진짜 로그아웃 흐름
    if (auth) window.location.href = "/login";
    throw new ApiError(401, "인증이 만료되었어요. 다시 로그인해주세요.");
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body.message ?? "오류가 발생했어요.", body.code);
  }

  if (res.status === 204) return undefined as T;

  try {
    return await res.json() as T;
  } catch {
    throw new ApiError(res.status, "응답 형식이 올바르지 않아요.", "INVALID_JSON");
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string, options?: RequestOptions) {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};
