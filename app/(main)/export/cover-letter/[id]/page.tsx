"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, History, Printer } from "lucide-react";

import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  CoverLetterMutationUnsupportedError,
  CoverLetterNotReadyError,
  getCoverLetter,
  updateCoverLetter,
} from "@/lib/api/cover-letter-api";
import {
  clearDraft,
  isDraftNewer,
  readDraft,
  writeDraft,
  type CoverLetterDraft,
} from "@/lib/export/cover-letter-draft";
import { useBasePath } from "@/lib/utils/use-base-path";
import { CoverLetterEditorPanel } from "@/components/features/export/CoverLetterEditorPanel";
import { CoverLetterPreview } from "@/components/features/export/CoverLetterPreview";
import { isEmptyCoverLetter, type CoverLetterResult } from "@/types/cover-letter";

type MobileTab = "editor" | "preview";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CoverLetterDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const basePath = useBasePath();

  const [result, setResult] = useState<CoverLetterResult | null>(null);
  // 서버가 만들어 준 원본. 편집 여부(=검증 결과가 낡았는지) 판정의 기준이라 저장 성공 전까지
  // 바뀌지 않는다 — dirty 판정용 initial 과 역할이 다르므로 따로 든다.
  const [original, setOriginal] = useState<CoverLetterResult | null>(null);
  const [initial, setInitial] = useState<CoverLetterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [saving, setSaving] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<CoverLetterDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoverLetter(id);
      setResult(data);
      setInitial(data);
      setOriginal(data);

      const draft = readDraft(id);
      if (draft && isDraftNewer(draft, data)) {
        setPendingDraft(draft);
      } else {
        setPendingDraft(null);
        // 서버 본문이 draft 보다 새로우면 그 draft 는 낡았다 — 남겨 두면 다음 진입 때마다
        // 배너가 다시 뜬다. 이 정리는 되돌릴 수 없으므로, "판정 불가"를 여기로 흘려보내지
        // 않는 책임은 isDraftNewer 쪽에 있다(서버 시각을 못 읽으면 true 로 보존).
        if (draft) clearDraft(id);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyRef = useRef(false);
  const resultRef = useRef<CoverLetterResult | null>(null);

  const dirty = useMemo(() => {
    if (!result || !initial) return false;
    return JSON.stringify(result) !== JSON.stringify(initial);
  }, [result, initial]);

  // 렌더 중 동기화 — 클라이언트 내비게이션이 passive effect 보다 먼저 끝나도 언마운트
  // 핸들러가 최신 값을 본다(레쥬메 상세와 같은 이유).
  dirtyRef.current = dirty;
  resultRef.current = result;

  const handleSave = useCallback(async () => {
    if (!result || !dirty || saving) return;
    setSaving(true);
    const snapshot = result;
    try {
      const updated = await updateCoverLetter(id, snapshot);
      setInitial(updated);
      setOriginal(updated);
      setResult((cur) => (cur === snapshot ? updated : cur));
      if (resultRef.current === snapshot) clearDraft(id);
      toast.success("저장됐어요");
    } catch (err) {
      // 서버에 저장 경로가 없다(BAC-62 미착수). 편집을 잃을 이유는 아니므로 **항상** 로컬에
      // 남긴다 — 미지원이든 서버 장애든 결과가 같기 때문이다(FRT-148 의 네 경로).
      const latest = resultRef.current ?? snapshot;
      const saved = writeDraft(id, latest);
      if (saved) {
        // 방금 쓴 임시 저장이 곧 지금 편집 중인 내용이다. 배너를 남겨 두면 '복원'이 화면에
        // 없는 낡은 스냅샷을 되돌리면서 방금 쓴 최신 저장까지 지운다 — 배너 하나가 편집을
        // 두 번 잃게 만든다(FRT-148).
        setPendingDraft(null);
      }

      if (err instanceof CoverLetterMutationUnsupportedError) {
        if (saved) {
          setInitial(snapshot);
          toast("편집 저장 기능은 곧 제공될 예정이에요", "info");
        } else {
          toast.error("임시 저장도 실패했어요. 페이지를 닫지 마세요.");
        }
      } else {
        // dirty 는 그대로 둔다 — 다음 저장/이탈 경로가 계속 살아 있어야 한다.
        toast.error("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSaving(false);
    }
  }, [result, dirty, saving, id]);

  const handleBack = useCallback(() => {
    if (dirty && result) {
      if (!writeDraft(id, result)) {
        toast.error("임시 저장에 실패했어요. 저장 후 나가주세요.");
        return;
      }
      toast("변경사항을 임시 저장했어요", "info");
    }
    router.push(`${basePath}/export`);
  }, [dirty, result, id, router, basePath]);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    setResult(pendingDraft.data);
    setPendingDraft(null);
    clearDraft(id);
  }, [pendingDraft, id]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(id);
    setPendingDraft(null);
  }, [id]);

  // 클라이언트 이동(언마운트)에도 편집을 남긴다.
  useEffect(() => {
    return () => {
      if (dirtyRef.current && resultRef.current) writeDraft(id, resultRef.current);
    };
  }, [id]);

  // Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!result || !dirty) return;
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, result, dirty]);

  // 탭을 그대로 닫는 경우(cleanup 미실행)까지 막는다.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-border bg-surface-secondary"
          />
        ))}
      </div>
    );
  }

  if (error || !result) {
    const status = error instanceof ApiError ? error.status : 500;
    const isNotFound = status === 404;
    // 본문이 아직 없는 것(생성 중·실패)과 못 불러온 것은 다른 상태다. 소거법으로 판정하면
    // 네트워크 장애까지 "생성 중"이 되므로 전용 타입으로만 좁힌다.
    const notReady = error instanceof CoverLetterNotReadyError;
    return (
      <div className="flex min-h-[calc(100dvh-var(--gnb-h))] flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-title text-text-primary">
          {isNotFound
            ? "자기소개서를 찾을 수 없어요"
            : notReady
              ? "아직 만들고 있어요"
              : "자기소개서를 불러오지 못했어요"}
        </h2>
        <p className="text-body-sm text-text-secondary">
          {isNotFound
            ? "삭제되었거나 주소가 잘못된 것 같아요."
            : notReady
              ? "완료되면 목록에서 열 수 있어요."
              : "잠시 후 다시 시도해주세요."}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`${basePath}/export`}>익스포트로 돌아가기</Link>
          </Button>
          {!isNotFound && (
            <Button variant="primary" size="sm" onClick={load}>
              다시 시도
            </Button>
          )}
        </div>
      </div>
    );
  }

  const empty = isEmptyCoverLetter(result);

  return (
    <div className="flex flex-col">
      <header className="no-print sticky top-[var(--gnb-h)] z-40 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur-sm sm:px-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2">
          <ChevronLeft size={16} className="mr-1" />
          <span className="hidden sm:inline">익스포트</span>
        </Button>
        <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-text-primary">
          자기소개서
          {result.meta?.job_label ? ` · ${result.meta.job_label}` : ""}
        </span>
        {dirty && <span className="shrink-0 text-caption text-text-tertiary">저장 안 됨</span>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.print()}
          aria-label="인쇄"
        >
          <Printer size={16} />
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </header>

      {/* 모바일 탭 전환 */}
      <div className="no-print sticky top-[calc(var(--gnb-h)+3.5rem)] z-30 flex border-b border-border bg-surface md:hidden">
        {(
          [
            { key: "editor", label: "편집" },
            { key: "preview", label: "미리보기" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMobileTab(t.key)}
            className={[
              "flex-1 py-2.5 text-body-sm transition-colors",
              mobileTab === t.key
                ? "border-b-2 border-brand font-medium text-brand"
                : "border-b-2 border-transparent text-text-secondary",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100dvh-var(--gnb-h)-3.5rem)] flex-col md:h-[calc(100dvh-var(--gnb-h))] md:flex-row">
        <aside
          className={[
            "no-print flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border-border bg-surface md:max-w-[45%] md:flex-none md:basis-[45%] md:border-r",
            mobileTab === "editor" ? "" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="space-y-3 p-5 sm:p-6">
            {pendingDraft && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-4">
                <History size={18} className="mt-0.5 shrink-0 text-text-secondary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold text-text-primary">
                    저장하지 못한 편집 내용이 있어요
                  </p>
                  <p className="mt-0.5 text-caption text-text-secondary">
                    이 기기에 자동 저장된 내용이에요.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleDiscardDraft}>
                    삭제
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleRestoreDraft}>
                    복원
                  </Button>
                </div>
              </div>
            )}

            {empty ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-body text-text-primary">본문이 비어 있어요.</p>
                <p className="mt-1 text-body-sm text-text-secondary">
                  기록이 부족하면 초안이 짧게 나올 수 있어요. 경험을 더 남기고 다시 만들어보세요.
                </p>
              </div>
            ) : (
              <CoverLetterEditorPanel
                result={result}
                onChange={setResult}
                original={original ?? undefined}
              />
            )}
          </div>
        </aside>

        <main
          className={[
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-secondary",
            mobileTab === "preview" ? "" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="p-5 sm:p-8">
            <CoverLetterPreview result={result} original={original ?? undefined} />
          </div>
        </main>
      </div>
    </div>
  );
}
