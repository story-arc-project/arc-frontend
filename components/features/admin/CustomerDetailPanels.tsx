import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatActivityStatusBreakdown,
  getCustomerStatusMeta,
} from "@/lib/admin/customer-status";
import { formatAdminDate } from "@/lib/admin/format";
import type {
  AdminActivityKey,
  AdminActivityStat,
  AdminCustomerAccount,
  AdminCustomerActivity,
  AdminCustomerDetail,
  AdminCustomerProfile,
} from "@/types/admin";

// FRT-17: 고객 상세 표현형. 훅·플래그를 모르고 props 만 받는다 — 그래야 Storybook 이 로딩·에러·
// 404·프로필 없음·활동 미상 같은 상태를 실제 백엔드 없이 전부 그려볼 수 있다(FRT-108/109 전례).
//
// PII: 이 화면은 계약이 허용한 범위(계정 + 소속·학교·학과·회사·희망직무)만 그린다. 전화번호·
// 생년월일·고민·관심사는 계약 단계에서 제외해 애초에 내려오지 않는다.

const LIST_PATH = "/admin/customers";

// 활동 항목 표시 순서·라벨. 화면이 아는 항목만 그린다(계약 §확장 규약).
const ACTIVITY_LABELS: { key: AdminActivityKey; label: string }[] = [
  { key: "experiences", label: "기록" },
  { key: "individualAnalyses", label: "개별 분석" },
  { key: "comprehensiveAnalyses", label: "종합 분석" },
  { key: "keywordAnalyses", label: "키워드 분석" },
  { key: "resumes", label: "이력서" },
];

const AUTH_PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-body-lg font-semibold text-text-primary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <dt className="text-body-sm text-text-tertiary sm:w-32 sm:shrink-0">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-body-sm text-text-primary">
        {children}
      </dd>
    </div>
  );
}

/** 상세 화면 상단 — 목록 복귀 + 이름·이메일·상태. */
export function CustomerDetailHeader({
  customer,
}: {
  customer: AdminCustomerAccount;
}) {
  const statusMeta = getCustomerStatusMeta(customer.status);

  return (
    <header className="mb-6">
      {/*
        목록 복귀는 검색어 없는 경로로 고정한다. 검색어(?q=)에는 고객 이메일이 실리므로 상세
        URL 로 실어 나르면 FRT-16 이 좁혀둔 PII 노출면(브라우저 히스토리·Referer·외부 분석 전송)이
        다시 넓어진다. 검색 상태 보존은 브라우저 뒤로가기가 담당한다 — 목록의 행 클릭이 push 라
        히스토리에 검색어가 살아 있는 목록 URL 이 그대로 남는다.
      */}
      <Link
        href={LIST_PATH}
        className="inline-flex items-center gap-1 text-body-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        고객 목록
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-heading-2 text-text-primary">
          {customer.name ?? "이름 미설정"}
        </h1>
        {statusMeta ? (
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        ) : customer.status ? (
          // 모르는 상태 코드는 라벨을 지어내지 않고 원문을 노출한다.
          <span className="text-body-sm text-text-secondary">
            {customer.status}
          </span>
        ) : null}
        {customer.withdrawnAt && <Badge variant="error">탈퇴</Badge>}
      </div>

      <p className="mt-1 break-all text-body-sm text-text-secondary">
        {customer.email || "—"}
      </p>
    </header>
  );
}

function AccountPanel({ customer }: { customer: AdminCustomerAccount }) {
  const providers =
    customer.authProviders.length > 0
      ? customer.authProviders
          .map((p) => AUTH_PROVIDER_LABELS[p] ?? p)
          .join(" · ")
      : // 소셜 계정이 없으면 이메일+비밀번호 가입이다.
        "이메일 · 비밀번호";

  return (
    <Panel title="계정">
      <dl className="flex flex-col gap-3">
        <Field label="이메일">
          <span className="break-all">{customer.email || "—"}</span>
        </Field>
        <Field label="가입일">{formatAdminDate(customer.createdAt)}</Field>
        <Field label="온보딩">{customer.onboarded ? "완료" : "미완료"}</Field>
        <Field label="로그인 수단">{providers}</Field>
        {/* 탈퇴는 계정 상태 값이 아니라 별도 기록이라 해당될 때만 줄이 생긴다. */}
        {customer.withdrawnAt && (
          <Field label="탈퇴일">{formatAdminDate(customer.withdrawnAt)}</Field>
        )}
      </dl>
    </Panel>
  );
}

function ProfilePanel({ profile }: { profile: AdminCustomerProfile | null }) {
  // 프로필이 없는 것(온보딩 전)과 있으나 비어 있는 것은 운영자에게 다른 사실이다.
  if (!profile) {
    return (
      <Panel title="프로필">
        <p className="text-body-sm text-text-secondary">
          아직 프로필을 작성하지 않았어요.
        </p>
        <p className="mt-1 text-caption text-text-tertiary">
          온보딩을 완료하면 소속·희망 직무가 표시됩니다.
        </p>
      </Panel>
    );
  }

  const fields: { label: string; value: string | null }[] = [
    { label: "소속", value: profile.affiliation },
    { label: "소속 상세", value: profile.affiliationDetail },
    { label: "학교", value: profile.school },
    { label: "학과", value: profile.department },
    { label: "회사", value: profile.company },
    { label: "희망 직무", value: profile.desiredRole },
  ];
  const filled = fields.filter((f) => f.value !== null);

  if (filled.length === 0) {
    return (
      <Panel title="프로필">
        <p className="text-body-sm text-text-secondary">
          프로필 항목이 아직 비어 있어요.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="프로필">
      <dl className="flex flex-col gap-3">
        {filled.map((f) => (
          <Field key={f.label} label={f.label}>
            {f.value}
          </Field>
        ))}
      </dl>
    </Panel>
  );
}

function ActivityRow({
  label,
  stat,
}: {
  label: string;
  stat: AdminActivityStat | null;
}) {
  // 미상(서버가 항목 자체를 안 줌 / 건수가 숫자가 아님)은 0 으로 위장하지 않는다 — 활동이 없는
  // 고객과 집계가 실패한 응답을 운영자가 구분할 수 있어야 한다.
  const unknown = !stat || stat.total === null;
  const breakdown = stat ? formatActivityStatusBreakdown(stat.byStatus) : null;

  // dt/dd 로 라벨과 값의 관계를 시맨틱하게 준다 — span 나열이면 스크린리더가 "기록 12건 성공 7"을
  // 어느 항목의 값인지 모른 채 이어 읽는다(목록 표를 table 로 둔 것과 같은 이유).
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border py-3 last:border-b-0">
      <dt className="w-24 shrink-0 text-body-sm text-text-tertiary">{label}</dt>
      <dd className="text-body font-medium text-text-primary">
        {unknown ? "—" : `${stat.total}건`}
      </dd>
      {breakdown && (
        <dd className="text-body-sm text-text-secondary">{breakdown}</dd>
      )}
      {stat?.lastAt && (
        <dd className="ml-auto text-caption text-text-tertiary">
          최근 {formatAdminDate(stat.lastAt)}
        </dd>
      )}
    </div>
  );
}

function ActivityPanel({ activity }: { activity: AdminCustomerActivity }) {
  return (
    <Panel title="활동 요약">
      <dl className="flex flex-col">
        {ACTIVITY_LABELS.map(({ key, label }) => (
          <ActivityRow key={key} label={label} stat={activity[key]} />
        ))}
      </dl>
    </Panel>
  );
}

/** 고객 상세 본문(헤더 + 3개 패널). */
export function CustomerDetailPanels({ detail }: { detail: AdminCustomerDetail }) {
  return (
    <div className="mx-auto max-w-3xl">
      <CustomerDetailHeader customer={detail.customer} />
      <div className="flex flex-col gap-4">
        <AccountPanel customer={detail.customer} />
        <ProfilePanel profile={detail.profile} />
        <ActivityPanel activity={detail.activity} />
      </div>
    </div>
  );
}

/**
 * 로딩 골격 — 목록의 LoadingRows 와 같은 톤.
 * 골격 자체에는 읽을 내용이 없으므로 role="status" + aria-label 로 "불러오는 중"만 알린다.
 * 통째로 aria-hidden 하면 스크린리더에는 아무 일도 일어나지 않는 빈 화면이 된다.
 */
export function CustomerDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl"
      role="status"
      aria-label="고객 정보를 불러오는 중"
    >
      <div className="mb-6">
        <span className="block h-4 w-20 animate-pulse rounded bg-surface-tertiary" />
        <span className="mt-3 block h-7 w-40 animate-pulse rounded bg-surface-tertiary" />
        <span className="mt-2 block h-4 w-56 animate-pulse rounded bg-surface-tertiary" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5">
            <span className="block h-5 w-24 animate-pulse rounded bg-surface-tertiary" />
            <div className="mt-4 flex flex-col gap-3">
              {[0, 1, 2].map((j) => (
                <span
                  key={j}
                  className="block h-4 w-full animate-pulse rounded bg-surface-tertiary"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 조회 실패 — 일시적 장애일 수 있으므로 다시 시도를 준다. */
export function CustomerDetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-3 px-4 py-20 text-center"
    >
      <p className="text-body text-text-secondary">
        고객 정보를 불러오지 못했어요.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-border px-4 py-2 text-body-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          다시 시도
        </button>
        <Link
          href={LIST_PATH}
          className="rounded-md px-4 py-2 text-body-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          고객 목록
        </Link>
      </div>
    </div>
  );
}

/**
 * 없는 고객(404). **다시 시도 버튼을 주지 않는다** — 존재하지 않는다는 건 확정된 사실이라
 * 재시도는 영원히 실패할 요청을 반복하게 만들고, 장애와 구분도 흐려진다.
 */
export function CustomerNotFound() {
  return (
    <div
      role="status"
      className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-2 px-4 py-20 text-center"
    >
      <p className="text-body text-text-secondary">
        찾을 수 없는 고객이에요.
      </p>
      <p className="text-body-sm text-text-tertiary">
        이미 삭제되었거나 주소가 잘못되었을 수 있어요.
      </p>
      <Link
        href={LIST_PATH}
        className="mt-2 rounded-md border border-border px-4 py-2 text-body-sm font-medium text-text-primary transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        고객 목록으로
      </Link>
    </div>
  );
}
