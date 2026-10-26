/** Google authorize URL만 조립한다. state 생성·저장과 흐름 정책은 호출부가 소유한다. */
export function buildGoogleAuthUrl({ clientId, redirectUri, state }: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
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
}
