import Link from "next/link";

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
const PLAN_LABELS: Record<string, string> = {
  free: "무료",
  pro: "프로",
  team: "팀",
};

const STATUS_META: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "default" }
> = {
  active: { label: "활성", variant: "success" },
  dormant: { label: "휴면", variant: "warning" },
  suspended: { label: "정지", variant: "error" },
  withdrawn: { label: "탈퇴", variant: "default" },
};

function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? (plan || "—");
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 6열 그리드를 헤더·행이 공유한다. 좁은 화면에선 컨테이너가 가로 스크롤(min-w)로 정렬 유지.
const GRID =
  "grid grid-cols-[minmax(200px,2fr)_minmax(120px,1fr)_90px_90px_80px_120px] items-center gap-3 px-4";

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
        <div className="min-w-[700px]">
          {/* 헤더 */}
          <div
            className={`${GRID} border-b border-border py-3 text-caption font-medium text-text-tertiary`}
            role="row"
          >
            <span>이메일</span>
            <span>이름</span>
            <span>플랜</span>
            <span>상태</span>
            <span>온보딩</span>
            <span>가입일</span>
          </div>

          {isLoading ? (
            <LoadingRows />
          ) : error ? (
            <ErrorState onRetry={onRetry} />
          ) : customers.length === 0 ? (
            <EmptyState query={query} />
          ) : (
            <ul>
              {customers.map((c) => (
                <li key={c.id || c.email} className="border-b border-border last:border-b-0">
                  <CustomerRow customer={c} detailBasePath={detailBasePath} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// 행 하나. id 가 있어야 상세로 링크한다 — 방어 파싱상 id 가 빈 문자열이면 href 가
// `/admin/customers/` 로 붕괴해 목록으로 되돌아가므로(조용한 no-op 클릭), 그럴 땐 비클릭 행으로
// 렌더한다(Codex review).
function CustomerRow({
  customer: c,
  detailBasePath,
}: {
  customer: AdminCustomer;
  detailBasePath: string;
}) {
  const cells = (
    <>
      <span className="truncate text-body-sm font-medium text-text-primary">
        {c.email || "—"}
      </span>
      <span className="truncate text-body-sm text-text-secondary">
        {c.name ?? "—"}
      </span>
      <span className="text-body-sm text-text-secondary">
        {planLabel(c.plan)}
      </span>
      <StatusCell status={c.status} />
      <span className="text-body-sm text-text-secondary">
        {c.onboarded ? "완료" : "—"}
      </span>
      <span className="text-body-sm text-text-tertiary">
        {formatDate(c.createdAt)}
      </span>
    </>
  );

  if (!c.id) {
    return <div className={`${GRID} py-3`}>{cells}</div>;
  }
  return (
    <Link
      href={`${detailBasePath}/${c.id}`}
      className={`${GRID} py-3 transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand`}
    >
      {cells}
    </Link>
  );
}

function LoadingRows() {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="border-b border-border last:border-b-0">
          <div className={`${GRID} py-3.5`}>
            {Array.from({ length: 6 }).map((__, j) => (
              <span
                key={j}
                className="h-4 animate-pulse rounded bg-surface-tertiary"
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
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
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
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
  );
}
