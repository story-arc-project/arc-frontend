"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAdminCustomers } from "@/lib/api/admin-api";
import type { AdminCustomer } from "@/types/admin";

interface UseAdminCustomersArgs {
  /** 검색어(이메일/이름 부분일치). 빈 문자열이면 전체. */
  q: string;
  /** 1-based 페이지 번호. */
  page: number;
  /** 페이지 크기. */
  limit: number;
}

interface UseAdminCustomersResult {
  customers: AdminCustomer[];
  /** 검색 조건 전체 건수. 서버가 안 주면 null(미상). */
  count: number | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /**
   * 지금 들고 있는 customers·count 가 **어느 파라미터로 받은 것인지** 나타내는 키.
   * 아직 한 번도 성공하지 않았으면 null. 호출부가 `adminCustomersKey(...)` 와 비교해
   * "이 숫자가 현재 화면의 것인지"를 판정한다(count 로 페이지를 깎기 전 필수).
   */
  settledKey: string | null;
}

/**
 * 조회 파라미터 → 응답 귀속 키. 훅과 호출부가 **같은 함수**를 쓰게 해 형식이 조용히 어긋나는
 * 것을 막는다(어긋나면 판정이 영영 false 가 되어 정규화가 죽는다).
 */
export function adminCustomersKey(
  q: string,
  page: number,
  limit: number,
): string {
  return `${page}|${limit}|${q}`;
}

// FRT-16: 고객 목록을 서버에서 가져온다. q·page·limit 이 바뀔 때마다 다시 조회하며, 검색 중
// 파라미터가 연달아 바뀌면 **늦게 도착한 이전 요청의 응답은 버린다**(stale 응답이 최신 화면을
// 덮어써 검색어와 목록이 어긋나는 것을 막는다). useExperiences 의 mountedRef 언마운트 가드에
// 더해, 요청마다 증가하는 seq 로 최신 요청만 반영한다.
export function useAdminCustomers({
  q,
  page,
  limit,
}: UseAdminCustomersArgs): UseAdminCustomersResult {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const seqRef = useRef(0);
  // reload 트리거 — 값이 바뀌면 effect 가 재실행된다.
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAdminCustomers({
          q,
          limit,
          offset: (page - 1) * limit,
        });
        // 언마운트됐거나, 이 요청 이후 더 새 요청이 시작됐으면 무시(stale 응답 폐기).
        if (!mountedRef.current || seq !== seqRef.current) return;
        setCustomers(data.contents);
        setCount(data.count);
        // count 와 **같은 시점에** 귀속 키를 세운다 — 이 둘이 갈리면 호출부 판정이 무의미해진다.
        setSettledKey(adminCustomersKey(q, page, limit));
        setIsLoading(false);
      } catch (err) {
        if (!mountedRef.current || seq !== seqRef.current) return;
        setError(
          err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."),
        );
        setIsLoading(false);
      }
    }

    load();
  }, [q, page, limit, reloadTick]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  return { customers, count, isLoading, error, reload, settledKey };
}
