"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAdminCustomer } from "@/lib/api/admin-api";
import { ApiError } from "@/lib/api/api-error";
import type { AdminCustomerDetail } from "@/types/admin";

interface UseAdminCustomerResult {
  detail: AdminCustomerDetail | null;
  isLoading: boolean;
  error: Error | null;
  /**
   * 그 id 의 고객이 존재하지 않음(404). 일반 에러와 **분리**한다 — 404 에 "다시 시도" 버튼을
   * 주면 영원히 실패할 요청을 반복하게 되고, 운영자는 장애와 삭제된 고객을 구분하지 못한다.
   */
  notFound: boolean;
  reload: () => void;
}

// FRT-17: 고객 상세 + 활동 요약을 서버에서 가져온다. id 가 바뀌면 다시 조회하며,
// useAdminCustomers 와 같은 두 겹 가드를 쓴다 — 언마운트 후 setState 방지(mountedRef)와
// 늦게 도착한 이전 요청의 응답 폐기(seqRef). 상세는 목록에서 연달아 다른 행으로 들어갈 수
// 있어 stale 응답이 다른 고객의 정보를 현재 화면에 덮어쓸 수 있다.
export function useAdminCustomer(id: string): UseAdminCustomerResult {
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);

  const mountedRef = useRef(true);
  const seqRef = useRef(0);
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
      setNotFound(false);

      // id 가 비어 있으면 요청 자체가 성립하지 않는다(경로가 목록으로 붕괴한다).
      if (!id) {
        if (!mountedRef.current || seq !== seqRef.current) return;
        setDetail(null);
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      try {
        const data = await getAdminCustomer(id);
        if (!mountedRef.current || seq !== seqRef.current) return;
        setDetail(data);
        setIsLoading(false);
      } catch (err) {
        if (!mountedRef.current || seq !== seqRef.current) return;
        // 404 는 "없는 고객"이라는 확정된 사실이므로 재시도 대상이 아니다.
        if (err instanceof ApiError && err.status === 404) {
          setDetail(null);
          setNotFound(true);
          setIsLoading(false);
          return;
        }
        setError(
          err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."),
        );
        setIsLoading(false);
      }
    }

    load();
  }, [id, reloadTick]);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  return { detail, isLoading, error, notFound, reload };
}
