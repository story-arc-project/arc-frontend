"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  adminCustomersKey,
  useAdminCustomers,
} from "@/hooks/useAdminCustomers";
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
  // 외부 요인(뒤로/앞으로 가기·링크)으로 URL 이 바뀌면 입력창을 URL 의 검색어로 맞춘다. 이걸 안
  // 하면 아래 디바운스 effect 가 낡은 input 으로 URL 을 되돌려 Back/Forward 를 무력화한다(Codex P2).
  //
  // 기준은 q 단독이 아니라 **q+page 전체**다. `?q=foo&page=2` ↔ `?q=foo` 처럼 검색어가 그대로인
  // 이동에서는 q 만 보면 동기화가 안 걸리고, 디바운스(300ms) 전에 눌린 뒤로가기가 남긴 미확정
  // 입력이 그 뒤 URL 을 덮어써 방금의 이동을 무효로 만든다(Codex P2). 불변식으로 세우면:
  // **어떤 내비게이션이든 그 뒤의 검색창은 URL 을 반영한다** — 갈라지는 건 자유 타이핑 중일 때뿐.
  //
  // 렌더 중 조정(React 권장 prev-value 패턴, archive/page.tsx 전례) — 우리 쪽 write 로 URL 이
  // 바뀐 경우엔 input 이 이미 확정 검색어와 같아 no-op → 루프 없음.
  const urlKey = `${page}|${qParam}`;
  const [syncedUrl, setSyncedUrl] = useState(urlKey);
  if (urlKey !== syncedUrl) {
    setSyncedUrl(urlKey);
    setInput(qParam);
  }
  const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    // 디바운스가 아직 현재 input 을 못 따라잡았으면(=외부 URL 변경 직후 옛값이 남아있는 상태)
    // 쓰지 않는다. 이 가드가 없으면 Back/Forward 직후 낡은 debouncedInput 이 URL 을 되돌린다
    // (Codex adversarial). debounced 가 input 과 같아진 뒤에만 = 사용자가 멈춘 로컬 편집일 때만 쓴다.
    if (debouncedInput !== input) return;
    const next = debouncedInput.trim();
    // qParam 도 trim 해 비교한다 — ?q=%20kim 처럼 공백이 낀 딥링크를 마운트 즉시 재작성하지
    // 않게(조회는 어차피 trim 된 값으로 나가므로 URL 만 조용히 바꾸는 헛 write 방지, Codex review).
    if (next === qParam.trim()) return;
    // 검색어가 바뀌면 항상 1페이지로 리셋한다.
    router.replace(buildHref(next, 1), { scroll: false });
  }, [debouncedInput, input, qParam, router]);

  const { customers, count, isLoading, error, reload, settledKey } =
    useAdminCustomers({
      q: qParam,
      page,
      limit: PAGE_SIZE,
    });

  // 범위를 벗어난 딥링크(?page=99)는 전체 건수를 안 뒤 마지막 유효 페이지로 정규화한다. 안 하면
  // 빈 목록과 "마지막 페이지" 범위가 동시에 뜨는 모순 상태가 된다(Codex P2).
  useEffect(() => {
    if (error) return;
    // count 가 **현재 파라미터로 받은 값일 때만** 깎는다. isLoading 만 보면 부족하다 — 훅은
    // 자기 effect 안에서 setIsLoading(true) 하므로, 같은 패스에서 뒤에 도는 이 effect 는 아직
    // 직전 쿼리의 isLoading=false·count 를 본다. 그 상태로 깎으면 `?q=희귀&page=1` → `?page=20`
    // 같은 Back/Forward 가 멀쩡한 20페이지를 1페이지로 되돌린다(Codex adversarial).
    if (settledKey !== adminCustomersKey(qParam, page, PAGE_SIZE)) return;
    // 검색창을 고쳐 둔 채 아직 디바운스가 안 끝났으면 미룬다. 여기서 replace 하면 page 가 바뀌고
    // → 위 URL 동기화가 입력창을 URL 의 옛 검색어로 되돌려 **타이핑이 조용히 사라진다**
    // (`?q=foo&page=99` 딥링크가 로딩되는 동안 타이핑한 경우, Codex P2). 곧 확정될 검색이 어차피
    // 1페이지로 옮겨가므로 정규화는 그때 해도 늦지 않다.
    if (input.trim() !== qParam.trim()) return;
    // 전체 건수를 모르면(서버가 count 를 안 줌) 깎지 않는다 — 추측으로 유효한 페이지를 잘라내면
    // 그 결과가 통째로 사라진다(Codex P2).
    if (count === null) return;
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    if (page > totalPages) {
      router.replace(buildHref(qParam, totalPages), { scroll: false });
    }
  }, [settledKey, error, count, page, qParam, input, router]);

  const handlePageChange = (next: number) => {
    const pending = input.trim();
    // 검색어를 고쳐 둔 채(디바운스 대기) 페이지를 누른 경우. 낡은 결과의 N페이지로 가면서 입력을
    // 조용히 버리면 안 된다(위 URL 동기화가 입력창을 옛 검색어로 되돌린다, Codex P2). 곧 확정될
    // 검색을 지금 확정해 1페이지로 보낸다 — 화면의 검색창과 결과가 어긋나지 않는다.
    if (pending !== qParam.trim()) {
      router.push(buildHref(pending, 1), { scroll: false });
      return;
    }
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
          pageItemCount={customers.length}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
