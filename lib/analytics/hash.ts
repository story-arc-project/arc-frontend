// FRT-19: 식별자 해싱.
//
// 프론트에 노출되는 안정적 사용자 식별자는 이메일뿐(내부 UUID 미노출)이라,
// 이메일을 SHA-256 해시해 PostHog distinct_id 로 쓴다 → 원본 이메일은 전송하지 않으면서
// 사용자당 안정적인 가명 식별자를 얻는다(AC: "해시된 내부 user ID").
//
// 대소문자·공백 차이로 같은 사용자가 다른 해시가 되지 않도록 정규화 후 해싱한다.
export async function hashUserId(seed: string): Promise<string> {
  const normalized = seed.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
