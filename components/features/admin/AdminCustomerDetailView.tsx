"use client";

import { useAdminCustomer } from "@/hooks/useAdminCustomer";

import {
  CustomerDetailError,
  CustomerDetailPanels,
  CustomerDetailSkeleton,
  CustomerNotFound,
} from "./CustomerDetailPanels";

// FRT-17: 고객 상세 컨테이너. 조회와 상태 분기만 담당하고, 그리는 일은 전부 표현형
// (CustomerDetailPanels)에 맡긴다 — 표현형이 훅을 모르는 덕에 Storybook 이 모든 상태를 그린다.
export function AdminCustomerDetailView({ id }: { id: string }) {
  const { detail, isLoading, error, notFound, reload } = useAdminCustomer(id);

  if (isLoading) return <CustomerDetailSkeleton />;
  // 404 를 에러보다 **먼저** 본다. 순서가 바뀌면 없는 고객에게도 "다시 시도"가 붙어 영원히
  // 실패할 요청을 반복하게 된다.
  if (notFound) return <CustomerNotFound />;
  if (error || !detail) return <CustomerDetailError onRetry={reload} />;

  return <CustomerDetailPanels detail={detail} />;
}
