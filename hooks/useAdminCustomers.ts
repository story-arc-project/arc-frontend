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
  /** 검색 조건 전체 건수(페이지네이션용). */
  count: number;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
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
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  return { customers, count, isLoading, error, reload };
}
