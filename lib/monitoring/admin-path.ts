export const ADMIN_PATH_PREFIX = "/admin";

/**
 * 경로가 admin 영역인지. 부팅 스크립트(instrumentation-client)와 런타임 가드
 * (SessionReplayGuard)가 **같은 규칙**을 쓰게 해 한쪽만 admin 으로 판정하는 틈을 없앤다.
 *
 * `/administrators` 같은 남의 경로를 admin 으로 오인하지 않도록 경계(`/`)까지 본다.
 */
export function isAdminPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === ADMIN_PATH_PREFIX ||
    pathname.startsWith(`${ADMIN_PATH_PREFIX}/`) ||
    pathname.startsWith(`${ADMIN_PATH_PREFIX}?`)
  );
}
