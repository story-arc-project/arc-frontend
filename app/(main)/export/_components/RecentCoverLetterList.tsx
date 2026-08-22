"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  CoverLetterMutationUnsupportedError,
  deleteCoverLetter,
  getCoverLetterList,
} from "@/lib/api/cover-letter-api";
import { useBasePath } from "@/lib/utils/use-base-path";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/date-utils";
import type { CoverLetterListItem } from "@/types/cover-letter";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { ListRefreshErrorBanner } from "./ListRefreshErrorBanner";

interface RecentCoverLetterListProps {
  onCreateClick: () => void;
  reloadToken?: number;
}

/** 이전 조회가 끝난 뒤 다음 조회까지의 간격. 자소서 생성은 큐에 들어가 수십 초 걸린다. */
const POLL_INTERVAL_MS = 5_000;
/** 상한 — 무한 폴링을 만들지 않는다(목록은 원래 폴링하지 않는 화면이다). 요청 완료 기준
 *  간격이라 실제 관찰 창은 2분을 넘는다. 상한에 닿으면 사용자가 눌러 잇는다. */
const MAX_POLL_TICKS = 24;

// 서버가 제목을 주지 않으면 만든 시각을 이름으로 쓴다(레쥬메 목록과 같은 규칙).
function coverLetterLabel(createdAt: string): string {
  if (!createdAt) return "자기소개서";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "자기소개서";
  return `${formatDateTime(createdAt)} 자기소개서`;
}

export function RecentCoverLetterList({
  onCreateClick,
  reloadToken = 0,
}: RecentCoverLetterListProps) {
  const basePath = useBasePath();
  const [items, setItems] = useState<CoverLetterListItem[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [deleteSupported, setDeleteSupported] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);

  // FRT-258 — 이 목록의 로딩 게이트는 `items === null`, 즉 첫 조회에만 걸린다. 그래서 재조회는
  // **목록이 조작 가능한 채로** 뒤에서 돌고, 그 사이 사용자가 만든 변경(삭제)을 늦게 도착한
  // 응답이 통째로 덮는다. 방어는 두 갈래다.
  //   ① 요청 세대(seqRef) — 더 새 요청이 시작됐으면 옛 응답은 쓰지 않는다
  //      (전례: hooks/useAdminCustomers.ts).
  //   ② 지운 id 집합 — 삭제는 요청을 만들지 않아 ①이 못 잡는다. 그렇다고 삭제가 세대를
  //      올려 응답을 **버리면**, 그 응답에 실려 온 새 항목(방금 만든 자소서·상태 갱신)까지
  //      함께 사라진다. 버리지 말고 지운 것만 빼서 적용한다.
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // load 보다 앞에 선언한다 — 마운트 effect 순서상 이쪽이 먼저 true 를 세워야 한다.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const data = await getCoverLetterList();
      // 가드는 **쓰기보다 앞**이어야 한다. 언마운트됐거나 이 응답이 떠난 뒤 더 새 요청이
      // 시작됐으면 화면에 쓰지 않는다.
      if (!mountedRef.current || seq !== seqRef.current) return;
      setError(null);
      // 이 응답이 떠난 뒤 사용자가 지운 행은 서버가 아직 모를 수 있다 — 빼고 그린다.
      setItems(data.filter((c) => !deletedIdsRef.current.has(c.id)));
    } catch (err) {
      if (!mountedRef.current || seq !== seqRef.current) return;
      // FRT-319 — 실패를 "목록이 비었다"로 기록하지 않는다. `setItems([])` 은 두 가지를
      // 한꺼번에 무너뜨린다. ① 잘 떠 있던 목록이 사라지고 에러 박스로 바뀐다 — 성공했던
      // 직전 응답을 남길 수 있는데도 버린다. ② `items` 가 비면 `hasPending` 도 false 가 돼
      // **폴링이 꺼진다** — 폴링은 스스로 되살아나지 않으므로 '생성 중' 행이 완성돼도 영영
      // 갱신되지 않는다. 마지막 성공분은 그대로 두고 실패는 배너로만 알린다.
      setError(err as Error);
    }
  }, []);

  // 집합 기록과 화면 제거를 한 몸으로 묶는다 — 둘 중 하나만 하면 그 순간 떠 있던
  // 재조회가 지운 행을 되살린다.
  const removeLocally = (id: string) => {
    deletedIdsRef.current.add(id);
    setItems((prev) => (prev ?? []).filter((c) => c.id !== id));
  };

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  // 생성은 비동기다 — 만들고 목록으로 돌아오면 첫 조회가 대개 'queued' 를 본다. 여기서
  // 멈추면 그 행은 **서버가 다 만든 뒤에도** '생성 중'에 고착돼 열 수 없다(전체 새로고침만
  // 탈출구다). 그래서 진행 중인 행이 있을 때만 유한 횟수 다시 읽는다.
  const hasPending = (items ?? []).some((i) => i.status === "processing");

  // 사람이 눌러 다시 읽으면 폴링 예산도 처음부터 다시 센다.
  const handleManualReload = useCallback(() => {
    setPollExhausted(false);
    load();
  }, [load]);

  useEffect(() => {
    if (!hasPending || pollExhausted) return;
    let cancelled = false;
    let ticks = 0;
    let timer: ReturnType<typeof setTimeout>;

    // setInterval 이 아니라 "끝난 뒤 다시 예약"이다 — 목록 GET 이 간격보다 오래 걸리면
    // 요청이 겹치고, 늦게 도착한 옛 응답이 새 응답을 덮어써 상태가 되돌아간다
    // (setItems 로 통째 교체하기 때문이다). lib/analysis/use-retry-refresh 와 같은 이유.
    const schedule = () => {
      timer = setTimeout(async () => {
        ticks += 1;
        await load(); // load 는 내부에서 실패를 흡수한다 — 한 번 실패해도 다음 차례로 잇는다.
        if (cancelled) return;
        // 진행 중인 행이 사라지면 hasPending 이 false 가 되고 이 effect 가 정리된다.
        if (ticks >= MAX_POLL_TICKS) {
          // 조용히 멈추면 '생성 중' 이 영원한 상태처럼 보인다 — 이을 길을 남긴다.
          setPollExhausted(true);
          return;
        }
        schedule();
      }, POLL_INTERVAL_MS);
    };
    schedule();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasPending, pollExhausted, load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCoverLetter(id);
      removeLocally(id);
      toast.success("자기소개서를 삭제했어요");
    } catch (err) {
      if (err instanceof CoverLetterMutationUnsupportedError) {
        setDeleteSupported(false);
        toast("삭제 기능은 곧 제공될 예정이에요", "info");
      } else if (err instanceof ApiError && err.status === 404) {
        // 이미 없는 것을 지우려 한 것뿐이다 — 사용자가 원한 결과와 같으므로 목록에서 뺀다.
        removeLocally(id);
      } else {
        toast.error("삭제에 실패했어요");
      }
    } finally {
      setDeletingId(null);
      // 성공·실패·삭제 미지원(버튼 자체가 사라지는 경로) 어디로 빠져도 다이얼로그를 닫는다.
      setPendingDeleteId(null);
    }
  };

  // 첫 조회가 아직 안 끝났다 — 아직 성공도 실패도 아니다.
  if (items === null && !error) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-border bg-surface-secondary"
          />
        ))}
      </div>
    );
  }

  // FRT-319 — 전체 에러 화면은 **첫 조회 실패**에만 쓴다. 목록을 한 번이라도 받아 뒀다면
  // 그것을 지울 이유가 없다(그 뒤의 실패는 아래 배너로 알린다).
  if (items === null) {
    return (
      <div className="rounded-lg border border-border bg-surface-secondary p-5 text-center">
        <p className="text-body-sm text-text-secondary">목록을 불러오지 못했어요.</p>
        <Button variant="ghost" size="sm" onClick={handleManualReload} className="mt-2">
          다시 시도
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {error && <ListRefreshErrorBanner onRetry={handleManualReload} />}
        <div className="rounded-xl border border-dashed border-border bg-surface-secondary p-8 text-center">
          <PenLine size={28} className="mx-auto text-text-tertiary" />
          <p className="mt-3 text-body text-text-primary">아직 만든 자기소개서가 없어요.</p>
          <p className="mt-1 text-body-sm text-text-secondary">
            문항을 넣으면 기록을 바탕으로 초안을 만들어요.
          </p>
          <Button variant="primary" size="sm" onClick={onCreateClick} className="mt-4">
            새 자기소개서 만들기
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {error && <ListRefreshErrorBanner onRetry={handleManualReload} />}
      {pollExhausted && hasPending && (
        <p className="mb-2 flex flex-wrap items-center gap-1.5 text-caption text-text-secondary">
          생성이 예상보다 오래 걸리고 있어요.
          <button
            type="button"
            onClick={handleManualReload}
            className="font-medium text-brand underline underline-offset-2"
          >
            다시 불러오기
          </button>
        </p>
      )}
      <ul className="flex flex-col gap-2">
      {items.map((item) => {
        // status 가 없으면(구 백엔드) 이동 가능. 있으면 completed 만 허용 — 생성 중/실패 행은
        // 본문이 아직 없어 상세가 에러 화면으로 샌다(레쥬메 목록과 같은 판정).
        const isNavigable = !item.status || item.status === "completed";
        const rowContent = (
          <>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-body-sm font-medium text-text-primary">
                {item.title || coverLetterLabel(item.created_at)}
              </span>
              {item.status && item.status !== "completed" && (
                <span
                  className={`mt-0.5 block text-caption ${
                    item.status === "failed" ? "text-error" : "text-text-tertiary"
                  }`}
                >
                  {item.status === "failed" ? "실패" : "생성 중"}
                </span>
              )}
            </div>
            {/* 서버가 제목을 주지 않는 자소서는 라벨이 길어 truncate 로 잘린다 —
                만든 시각을 숨기면 모바일에서 어느 것이 방금 만든 건지 알 수 없다(FRT-126). */}
            {item.created_at && (
              <span className="shrink-0 text-caption text-text-tertiary">
                {formatRelativeTime(item.created_at)}
              </span>
            )}
          </>
        );

        return (
          <li key={item.id}>
            <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-brand text-brand">
                <PenLine size={16} />
              </div>
              {isNavigable ? (
                <Link
                  href={`${basePath}/export/cover-letter/${item.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {rowContent}
                </Link>
              ) : (
                <div
                  className="flex min-w-0 flex-1 cursor-default items-center gap-3 opacity-70"
                  aria-disabled="true"
                >
                  {rowContent}
                </div>
              )}
              {deleteSupported && (
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(item.id)}
                  disabled={deletingId === item.id}
                  className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-error disabled:opacity-40"
                  aria-label="자기소개서 삭제"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        );
      })}
      </ul>
      <DeleteConfirmDialog
        open={pendingDeleteId !== null}
        title="이 자기소개서를 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요."
        deleting={deletingId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) handleDelete(pendingDeleteId);
        }}
      />
    </>
  );
}
