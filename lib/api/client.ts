"use client";

import { ApiError } from "./api-error";

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

async function runRefresh(): Promise<RefreshResult> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      refreshGeneration += 1;
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

// 사용자가 비밀번호를 틀렸을 때의 401 (arc-backend `api/auth.py` 로그인·탈퇴 경로).
// 액세스 토큰과 무관하므로 갱신해도 영원히 401 이고, 그 사이 탈퇴 DELETE 같은 요청이 되풀이
// 전송되며 실패 횟수 집계까지 오염시킨다. 게다가 매 라운드의 회전이 다른 요청의 토큰을 죽인다.
//
// 가려내는 **방향**이 중요하다. "갱신 가능한 코드만 허용"으로 좁히거나 `auth: false` 요청을
// 통째로 제외하면 `/auth/me` 도 `auth: false` 라(`lib/api/auth-api.ts`) 세션 복원이 함께 죽는다.
// 그래서 "고칠 수 없는 코드만 제외"로 둔다 — 코드가 없는 401 은 지금처럼 갱신한다.
const WRONG_CREDENTIALS_CODE = "INVALID_CREDENTIALS";

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
    const body = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };

    // 갱신해도 달라지지 않는 응답은 여기서 갈라 그대로 던진다.
    // - 403 은 "내 액세스 토큰이 갱신에 밀려났다"일 때만 되살린다. 진짜 폐기(`AUTH_REVOKED`)나
    //   인가 실패는 대상이 아니다.
    // - 401 은 반대로 **고칠 수 없는 것만** 뺀다 (`WRONG_CREDENTIALS_CODE` 주석 참조).
    const unrecoverable =
      res.status === 403 ? body.code !== ROTATED_OUT_CODE : body.code === WRONG_CREDENTIALS_CODE;
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
    const body = await res.json().catch(() => ({}));
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
