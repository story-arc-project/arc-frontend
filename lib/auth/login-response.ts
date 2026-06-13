/**
 * 로그인 성공 응답을 방어적으로 해석해 온보딩 페이지로 보내야 하는지 판단한다(FRT-51).
 *
 * 로그인은 이미 성공(쿠키 발급 완료)한 상태이므로 응답 본문이 비정상이어도
 * `data.onboarded` 직접 접근으로 TypeError 를 던져 '네트워크 오류' 화면을 띄우면 안 된다.
 * 또한 `data`/`onboarded` 가 누락되면 온보딩 여부를 알 수 없는데, 이때 /signup 으로
 * 보내면 이미 온보딩을 마친 정상 사용자에게 위양성 리다이렉트가 발생한다.
 *
 * 따라서 **명시적으로 `onboarded === false`** 인 경우에만 온보딩이 필요하다고 본다.
 * (누락·null·비불리언 응답은 온보딩 완료로 간주해 대시보드로 진행한다.)
 */
export function needsOnboarding(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  return (data as { onboarded?: unknown }).onboarded === false;
}
