"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import type { AdminCustomer } from "@/types/admin";

interface CustomerListViewProps {
  customers: AdminCustomer[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** 검색어(빈 결과 문구를 검색/전체에 맞게 바꾸는 데 쓴다). */
  query: string;
  /** 행 클릭 시 이동할 상세 경로 베이스(기본 /admin/customers). B4/FRT-17 연결 지점. */
  detailBasePath?: string;
}

// 백엔드 enum 확정 전 — 알려진 코드만 라벨/색을 주고, 미지 코드는 원문 그대로 표시한다.
const STATUS_META: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "default" }
> = {
  active: { label: "활성", variant: "success" },
  dormant: { label: "휴면", variant: "warning" },
  suspended: { label: "정지", variant: "error" },
  withdrawn: { label: "탈퇴", variant: "default" },
};

const COLUMN_COUNT = 5;

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    // 타임존을 고정한다. 안 하면 서버(UTC)와 관리자 브라우저(KST)가 자정 근처 가입일을 서로 다른
    // 날짜로 렌더해 하이드레이션 불일치가 나고, 화면의 날짜가 눈앞에서 바뀐다(Codex P2).
    // 운영 기준시는 한국 시간이다.
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 셀 공통 여백. 표 가장자리는 컨테이너와 붙지 않게 좌우를 더 준다.
const CELL = "px-3 py-3 first:pl-4 last:pr-4";

function StatusCell({ status }: { status: string }) {
  const meta = STATUS_META[status];
  if (!meta) {
    return (
      <span className="text-body-sm text-text-secondary">{status || "—"}</span>
    );
  }
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

export function CustomerListView({
  customers,
  isLoading,
  error,
  onRetry,
  query,
  detailBasePath = "/admin/customers",
}: CustomerListViewProps) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        {/*
          네이티브 table 로 열 관계를 시맨틱하게 준다 — div 그리드에 role="row" 만 붙이면
          스크린리더가 각 값을 어느 열의 것인지 못 읽어 목록 해석이 불가능하다(Codex P2).
          table-fixed + colgroup 이라야 긴 이메일이 truncate 되고 열 폭이 유지된다.
        */}
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left">
          <caption className="sr-only">가입 고객 목록</caption>
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[20%]" />
            <col className="w-[90px]" />
            <col className="w-[80px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-caption font-medium text-text-tertiary">
              <th scope="col" className={CELL}>
                이메일
              </th>
              <th scope="col" className={CELL}>
                이름
              </th>
              <th scope="col" className={CELL}>
                상태
              </th>
              <th scope="col" className={CELL}>
                온보딩
              </th>
              <th scope="col" className={CELL}>
                가입일
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingRows />
            ) : error ? (
              <ErrorState onRetry={onRetry} />
            ) : customers.length === 0 ? (
              <EmptyState query={query} />
            ) : (
              customers.map((c) => (
                <CustomerRow
                  key={c.id || c.email}
                  customer={c}
                  detailBasePath={detailBasePath}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 행 하나. id 가 있어야 상세로 링크한다 — 방어 파싱상 id 가 빈 문자열이면 href 가
// `/admin/customers/` 로 붕괴해 목록으로 되돌아가므로(조용한 no-op 클릭), 그럴 땐 비클릭 행으로
// 렌더한다(Codex review).
//
// 링크는 **이메일 셀 안**에 둔다. tr 을 통째로 <a> 로 감쌀 수 없으므로, 마우스 편의를 위한
// 행 전체 클릭은 onClick 으로 주고 키보드·스크린리더 경로는 이 실제 링크가 담당한다.
function CustomerRow({
  customer: c,
  detailBasePath,
}: {
  customer: AdminCustomer;
  detailBasePath: string;
}) {
  const router = useRouter();
  const href = c.id ? `${detailBasePath}/${c.id}` : null;

  const handleClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if (!href) return;
    // 링크를 직접 눌렀으면 앵커가 이미 이동시킨다 — 중복 내비게이션 방지.
    if ((e.target as HTMLElement).closest("a")) return;
    router.push(href);
  };

  return (
    <tr
      onClick={handleClick}
      className={`border-b border-border last:border-b-0 ${
        href ? "cursor-pointer transition-colors hover:bg-surface-tertiary" : ""
      }`}
    >
      <td className={`${CELL} truncate text-body-sm font-medium`}>
        {href ? (
          <Link
            href={href}
            className="text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {c.email || "—"}
          </Link>
        ) : (
          <span className="text-text-primary">{c.email || "—"}</span>
        )}
      </td>
      <td className={`${CELL} truncate text-body-sm text-text-secondary`}>
        {c.name ?? "—"}
      </td>
      <td className={CELL}>
        <StatusCell status={c.status} />
      </td>
      <td className={`${CELL} text-body-sm text-text-secondary`}>
        {c.onboarded ? "완료" : "—"}
      </td>
      <td className={`${CELL} text-body-sm text-text-tertiary`}>
        {formatDate(c.createdAt)}
      </td>
    </tr>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border last:border-b-0">
          {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
            <td key={j} className={CELL} aria-hidden="true">
              <span className="block h-4 animate-pulse rounded bg-surface-tertiary" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT}>
        <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
          <p className="text-body text-text-secondary">
            {query
              ? `"${query}"에 해당하는 고객이 없어요.`
              : "아직 표시할 고객이 없어요."}
          </p>
          {query && (
            <p className="text-body-sm text-text-tertiary">
              이메일이나 이름의 일부로 다시 검색해 보세요.
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT}>
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center"
        >
          <p className="text-body text-text-secondary">
            고객 목록을 불러오지 못했어요.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-border px-4 py-2 text-body-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            다시 시도
          </button>
        </div>
      </td>
    </tr>
  );
}
