import { createOAuthState, setOAuthIntent } from "./oauth-state";

/** 재인증 OAuth 를 지원하는 provider. 향후 "kakao" | "naver" 확장 지점. */
export type OAuthProvider = "google";

/** 탈퇴용 OAuth 왕복임을 콜백에 알리는 intent 값. */
export const DELETE_INTENT = "delete";

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
};

interface OAuthProviderConfig {
  /** env 에서 client_id 를 읽는다(없으면 비활성). */
  getClientId: () => string | undefined;
  /** provider 별 콜백 경로. */
  callbackPath: string;
  /** authorize endpoint + 고정 파라미터로 인증 URL 을 만든다. */
  buildAuthUrl: (a: { clientId: string; redirectUri: string; state: string }) => string;
}

const REGISTRY: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    getClientId: () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    callbackPath: "/callback/google",
    // ⚠ app/(auth)/login/page.tsx 의 handleSocialLogin 과 동일 파라미터를 유지해야
    //   공유 콜백(/callback/google)이 login·delete 두 흐름을 모두 처리할 수 있다.
    buildAuthUrl: ({ clientId, redirectUri, state }) => {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        prompt: "select_account",
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
  },
};

// REGISTRY 키에서 파생한다 → provider 추가 시 SUPPORTED 갱신 누락(조용한 null)을 막는다.
const SUPPORTED = Object.keys(REGISTRY) as readonly OAuthProvider[];

/** connected_oauth 중 현재 재인증을 지원하는 첫 provider 를 반환(없으면 null). */
export function pickReauthProvider(connected: readonly string[]): OAuthProvider | null {
  return (
    connected.find((p): p is OAuthProvider =>
      (SUPPORTED as readonly string[]).includes(p),
    ) ?? null
  );
}

/**
 * 탈퇴 재인증용 OAuth 를 시작한다. intent 쿠키를 심고 provider authorize 로 리다이렉트.
 * client_id 미설정이면 리다이렉트하지 않고 false 를 반환한다(호출부가 인라인 에러).
 */
export function startOAuthReauth(provider: OAuthProvider): boolean {
  const config = REGISTRY[provider];
  const clientId = config.getClientId();
  if (!clientId) return false;
  const redirectUri = `${window.location.origin}${config.callbackPath}`;
  const url = config.buildAuthUrl({ clientId, redirectUri, state: createOAuthState() });
  setOAuthIntent(DELETE_INTENT);
  window.location.href = url;
  return true;
}
