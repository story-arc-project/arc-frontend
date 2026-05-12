// 데모 모드 전역 플래그.
// React 트리 밖(API 클라이언트 함수)에서도 동기 체크가 가능해야 하므로 모듈 변수로 관리한다.
//
// 진실 공급원은 두 곳:
// 1) DemoModeProvider 가 마운트/언마운트 시점에 setDemoMode() 로 직접 토글
// 2) 그 외 시점에는 현재 URL pathname 이 /demo 로 시작하면 자동 ON
//    (provider 가 마운트되기 전에 호출되는 API 도 안전하게 demo 로 인식)

let demoModeActive = false;

const DEMO_PATH_PREFIX = "/demo";

export function setDemoMode(active: boolean): void {
  demoModeActive = active;
}

export function isDemoMode(): boolean {
  if (demoModeActive) return true;
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith(DEMO_PATH_PREFIX);
}

export const DEMO_BASE_PATH = DEMO_PATH_PREFIX;
