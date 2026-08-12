"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, History, Printer } from "lucide-react";

import "./print.css";

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
import {
  applyBaseline,
  readBaseline,
  writeBaselineIfAbsent,
} from "@/lib/export/cover-letter-baseline";
import { applyLimits, readLimits } from "@/lib/export/cover-letter-limits";
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
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [saving, setSaving] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<CoverLetterDraft | null>(null);

  // FRT-238 — 레쥬메 상세와 같은 이유다. App Router 는 id 만 바뀌면 이 인스턴스를 재사용하므로
  // 이전 자기소개서의 조회가 아직 날아다니는 채로 다음 조회가 시작된다.
  //
  // 세대(seq)까지 키에 넣는 건 되돌아오는 경로 때문이다 — A→B→A 로 돌아오면 id 만으로 만든
  // 키가 이미 답을 받아둔 키와 같아져, 재조회 중인데도 옛 본문이 그대로 보인다. id 는 prop 이라
  // setState 로 못 바꾸니 "지난 렌더와 달라졌는가"를 렌더 중에 비교해 커밋 전에 세대를 올린다.
  const [seq, setSeq] = useState(0);
  const [trackedId, setTrackedId] = useState(id);
  if (id !== trackedId) {
    setTrackedId(id);
    setSeq((s) => s + 1);
  }

  // 화면이 지금 답해야 할 질문과, 실제로 답을 받아둔 질문. 둘이 다르면 그 자체가 로딩이다.
  const requestKey = `${id}:${seq}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  const handleRetry = useCallback(() => setSeq((s) => s + 1), []);

  useEffect(() => {
    // 늦게 도착한 답이 무엇 하나라도 건드리면 id 와 본문이 어긋난다. 응답 이후의 갱신은
    // 전부 이 가드 안에 둔다 — 절반만 가드하면 절반만 고쳐진 버그가 된다.
    let ignore = false;

    // 생성 시 입력한 글자수 제한은 출력 계약에 없다 — 서버가 안 준 문항만 로컬 저장분으로
    // 채운다(서버 값이 정본). 없으면 상한 없이 글자수만 보여주는 현재 동작 그대로다.
    getCoverLetter(id)
      .then((raw) => {
        if (ignore) return;
        const data = applyLimits(raw, readLimits(id));
        setResult(data);
        setInitial(data);
        // 성공은 지난 실패를 지운다 — 안 지우면 재시도가 성공해도 에러 화면이 남는다.
        setError(null);
        // 검증이 가리키는 본문은 **처음 받은 본문**이다. 저장이 성공하면 서버 본문이 편집본으로
        // 바뀌는데, 그걸 기준으로 삼으면 사용자가 써넣은 문장이 "검증됨"으로 세탁된다.
        writeBaselineIfAbsent(id, data);
        setOriginal(applyBaseline(data, readBaseline(id)));

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
        setLoadedKey(requestKey);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err as Error);
        setLoadedKey(requestKey);
      });

    return () => {
      ignore = true;
    };
  }, [id, requestKey]);

  const dirtyRef = useRef(false);
  const resultRef = useRef<CoverLetterResult | null>(null);
  // 이 인스턴스가 **지금** 답하고 있는 질문. 비동기 저장의 클로저는 시작 당시의 것을 쥐고
  // 있어, 응답이 늦게 오면 둘이 갈린다(아래 handleSave). id 가 아니라 requestKey 인 것은
  // A→B→A 때문이다 — 돌아오면 id 는 같아지지만 그 사이 재조회가 끼어들어 resultRef 는
  // **저장 전** 본문으로 되돌아가 있다. 세대까지 봐야 그 왕복이 잡힌다.
  //
  // 언마운트하면 null 이 된다(아래 effect) — 언마운트는 seq 를 올리지 않아 같은 문서로 다시
  // 들어온 **새 인스턴스**의 키(seq 0)와 겹치고, 그 틈으로 늦게 끝난 옛 저장이 새 인스턴스가
  // 복원하라고 띄워 둔 draft 를 지운다.
  const requestKeyRef = useRef<string | null>(requestKey);

  const dirty = useMemo(() => {
    if (!result || !initial) return false;
    return JSON.stringify(result) !== JSON.stringify(initial);
  }, [result, initial]);

  // 렌더 중 동기화 — 클라이언트 내비게이션이 passive effect 보다 먼저 끝나도 언마운트
  // 핸들러가 최신 값을 본다(레쥬메 상세와 같은 이유).
  dirtyRef.current = dirty;
  resultRef.current = result;
  requestKeyRef.current = requestKey;

  const handleSave = useCallback(async () => {
    // FRT-238 — loading 은 id 가 이미 바뀌었지만 새 자기소개서 응답은 아직 안 온 창이다.
    // 이 창에서 result/dirty 는 여전히 **이전** 문서 것인데 id 는 **다음** 문서라, 가드
    // 없이 저장하면 이전 문서 내용을 다음 문서 id 로 PATCH 해버린다. 저장 버튼은 이 창에서
    // 렌더되지 않아 안전하지만, 전역 Ctrl/Cmd+S 리스너는 이 창에서도 계속 살아있다.
    if (!result || !dirty || saving || loading) return;
    setSaving(true);
    const snapshot = result;
    try {
      const updated = await updateCoverLetter(id, snapshot);
      setInitial(updated);
      // ⚠️ original 은 갱신하지 않는다. 저장은 **재검증이 아니다** — 서버가 편집본을 그대로
      // 돌려줄 뿐이라, 이걸 새 기준선으로 삼으면 "검증 이후 고쳐졌다"는 유일한 신호가 사라져
      // 사용자가 써넣은 문장이 검증된 것처럼 보인다(codex P1). 재검증 시점을 정의하는 건
      // 서버 계약(BAC-62)의 몫이고, 그때 이 자리에서 기준선을 갱신하면 된다.
      setResult((cur) => (cur === snapshot ? updated : cur));
      // 응답이 도는 동안 화면이 이 요청을 떠났을 수 있다. App Router 는 id 만 바뀌면 이
      // 인스턴스를 재사용하므로(FRT-238) 그때 resultRef 는 **다른** 본문인데 클로저의 id 는
      // 이 문서다 — 그 조합으로 저장소를 건드리면 남의 본문이 이 문서의 draft 로 심긴다.
      //
      // 판정은 id 가 아니라 **requestKey** 로 한다. A→B→A 로 돌아오면 id 는 다시 같아지지만
      // 그 사이 재조회가 끼어들어 resultRef 는 저장 전 본문으로 되돌아가 있고, 그걸 "이어
      // 고친 편집"으로 오인해 쓰면 전환 때 남긴 올바른 draft 를 낡은 본문으로 덮는다.
      //
      // 이 문서의 편집분은 화면이 떠나던 순간의 cleanup 이 이미 같은 키에 남겼으니, 떠난
      // 뒤에는 아무것도 하지 않는다. pendingDraft 도 지금은 다음 요청의 배너다.
      if (requestKeyRef.current === requestKey) {
        // 규칙은 하나다 — **저장에 성공하면 이 문서의 draft 는 없다.** 이어 고친 편집을
        // 여기서 draft 로 갈아끼우면, 사용자가 그 편집을 되돌려도 draft 는 남아(dirty 가
        // false 로 돌아가 이탈 경로들이 손대지 않는다) 다음 진입 때 지운 편집을 되살리라고
        // 권한다. 그 편집은 화면과 dirty 에 살아 있어 나가기·언마운트 cleanup 이 남긴다.
        clearDraft(id);
        // 배너도 같은 이유로 지운다 — 그 스냅샷은 서버 최신본보다 낡았고, 남겨 두면 '복원'이
        // 방금 저장한 내용을 그것으로 덮는다(FRT-191).
        setPendingDraft(null);
      }
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
  }, [result, dirty, saving, loading, id, requestKey]);

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

  // 언마운트한 인스턴스는 더 이상 어떤 요청도 대표하지 않는다. deps 를 비워 진짜 언마운트
  // 에서만 무효화한다 — id 변경 cleanup 에 넣으면 렌더에서 막 갱신한 새 키를 지운다.
  useEffect(() => {
    const ref = requestKeyRef;
    return () => {
      ref.current = null;
    };
  }, []);

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
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-8" aria-busy="true">
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
            <Button variant="primary" size="sm" onClick={handleRetry}>
              다시 시도
            </Button>
          )}
        </div>
      </div>
    );
  }

  const empty = isEmptyCoverLetter(result);

  return (
    // 높이는 **한 번만** 정한다. 예전에는 아래 패널 행이 스스로 `100dvh - gnb (- 3.5rem)` 을
    // 잡았는데, 그러면 정상 흐름에 남아 있는 헤더(3.5rem)와 모바일 탭바만큼 페이지가 화면보다
    // 길어져 — 내부 스크롤을 가진 패널 밖에 **바깥 스크롤바가 하나 더 생기고** 패널 바닥이
    // 화면 밑으로 내려갔다. 여기서 한 번 가두고 패널 행이 남은 공간을 flex 로 채운다.
    <div className="flex h-[calc(100dvh-var(--gnb-h))] flex-col overflow-hidden">
      <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-4 backdrop-blur-sm sm:px-6">
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
      <div className="no-print flex shrink-0 border-b border-border bg-surface md:hidden">
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

      <div className="cover-letter-panels flex min-h-0 flex-1 flex-col md:flex-row">
        {/* `relative` 는 장식이 아니다 — 안쪽 `sr-only` 는 `position:absolute` 인데, 스크롤
            컨테이너가 static 이면 **absolute 자손이 overflow 클리핑을 빠져나가** 문서 높이를
            늘려 바깥 스크롤바를 만든다(실측: 데스크톱 252px·모바일 597px 초과 → 0). */}
        <aside
          className={[
            "no-print relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto border-border bg-surface md:max-w-[45%] md:flex-none md:basis-[45%] md:border-r",
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
            // 인쇄 대상 면 — print.css 가 이 클래스로 높이·스크롤·숨김을 풀어 전체를 출력한다.
            "cover-letter-preview-pane relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-secondary",
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
