"use client";

import { usePathname } from "next/navigation";

import { DEMO_BASE_PATH } from "@/lib/demo/state";

/**
 * 현재 라우트가 /demo 하위면 "/demo" 를, 그 외는 "" 를 반환한다.
 * 컴포넌트가 양쪽 라우트 그룹에서 모두 쓰일 때 절대 경로의 prefix 로 사용한다.
 *
 * 예: router.push(`${base}/archive`)  →  /archive 또는 /demo/archive
 */
export function useBasePath(): string {
  const pathname = usePathname() ?? "";
  return pathname.startsWith(DEMO_BASE_PATH) ? DEMO_BASE_PATH : "";
}
