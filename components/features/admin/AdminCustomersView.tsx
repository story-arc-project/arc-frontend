"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAdminCustomers } from "@/hooks/useAdminCustomers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CustomerListView } from "./CustomerListView";
import { CustomerSearchBar } from "./CustomerSearchBar";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const BASE_PATH = "/admin/customers";

// 상태(검색어·페이지)를 URL 에 반영해 새로고침·공유·뒤로가기에 견디게 한다(CLAUDE.md searchParams
// 규약). 빈 검색어·1페이지는 URL 에서 생략해 깨끗하게 유지한다.
function buildHref(q: string, page: number): string {
  const params = new URLSearchParams();
  const trimmed = q.trim();
  if (trimmed) params.set("q", trimmed);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `${BASE_PATH}?${s}` : BASE_PATH;
}

function parsePage(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

// FRT-16 고객 목록·검색 컨테이너. 플래그 게이팅은 상위(서버 page.tsx)가 이미 수행했다 —
// 이 컴포넌트는 flag 를 모른다.
export function AdminCustomersView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const qParam = searchParams.get("q") ?? "";
  const page = parsePage(searchParams.get("page"));

  // 검색창 입력은 로컬 상태로 즉시 반응하고, 디바운스된 값만 URL(→서버 조회)로 흘린다.
  const [input, setInput] = useState(qParam);
  const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const next = debouncedInput.trim();
    if (next === qParam) return;
    // 검색어가 바뀌면 항상 1페이지로 리셋한다.
    router.replace(buildHref(next, 1), { scroll: false });
  }, [debouncedInput, qParam, router]);

  const { customers, count, isLoading, error, reload } = useAdminCustomers({
    q: qParam,
    page,
    limit: PAGE_SIZE,
  });

  const handlePageChange = (next: number) => {
    router.push(buildHref(qParam, next), { scroll: false });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-heading-3 text-text-primary">고객</h1>
        <p className="mt-1 text-body-sm text-text-tertiary">
          가입 고객을 이메일·이름으로 검색하고 상세로 이동할 수 있어요.
        </p>
      </div>

      <CustomerSearchBar value={input} onChange={setInput} />

      <CustomerListView
        customers={customers}
        isLoading={isLoading}
        error={error}
        onRetry={reload}
        query={qParam}
      />

      {!isLoading && !error && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={count}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
