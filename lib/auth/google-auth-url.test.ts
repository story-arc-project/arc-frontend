import { describe, expect, it } from "vitest";
import { buildGoogleAuthUrl } from "./google-auth-url";

describe("buildGoogleAuthUrl", () => {
  it("preserves the existing URL including parameter order and encoding", () => {
    expect(buildGoogleAuthUrl({ clientId: "client-xyz", redirectUri: "https://app.test/callback/google", state: "state-123" }))
      .toBe("https://accounts.google.com/o/oauth2/v2/auth?client_id=client-xyz&redirect_uri=https%3A%2F%2Fapp.test%2Fcallback%2Fgoogle&response_type=code&scope=openid+email+profile&access_type=offline&prompt=select_account&state=state-123");
  });

  it.each(["state-123", "delete:state-123", "delete:a+b&c=% 한글#?"])("round-trips caller values without adding policy: %s", (state) => {
    const input = { clientId: "client+&= 한글", redirectUri: "http://localhost:3000/callback/google?x=a+b&y=%25", state };
    const url = new URL(buildGoogleAuthUrl(input));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: input.clientId, redirect_uri: input.redirectUri, response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account", state });
  });
});
