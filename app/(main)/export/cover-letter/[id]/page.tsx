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
import { capture, type CoverLetterSaveOutcome } from "@/lib/analytics";
import { firstChangedAnswerIndex } from "@/lib/export/cover-letter-diff";
import { draftTierWarning, type DraftTier } from "@/lib/export/draft-storage";
import { usePersistOnUnload } from "@/lib/export/use-persist-on-unload";
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

/**
 * FRT-107: 저장의 결말들(서버 저장·실패·저장 없이 이탈)이 사용자에겐 거의 같아 보이지만
 * 데이터로는 전혀 다른 사실이다. 레쥬메의 captureEditSaved 와 같은 모양으로 한 곳에서 싣는다.
 *
 * 컴포넌트 밖에 두는 이유는 언마운트 cleanup 이 이 함수를 부르기 때문이다 — 안에 두면
 * 그 effect 의 의존성에 걸리고, 훗날 무엇 하나라도 클로저에 들어오는 순간 cleanup 이 매
 * 렌더마다 돌아 '이탈 저장'이 반복 발화한다. 인자만 받으니 밖이 제자리다.
 */
function captureEditSaved(
  outcome: CoverLetterSaveOutcome,
  persisted: boolean,
  snapshot: CoverLetterResult | null,
  // 로컬로 떨어진 경우 **어느 계층**에 담겼는지. 같은 "보관됨"이라도 브라우저를 닫으면
  // 사라지는 보관이 섞여 있어, 이걸 안 나누면 유실 규모를 과소 보고한다(FRT-261).
  storageTier?: DraftTier | null,
  // 화면이 사라지는 순간(탭 닫기)에 쏘는가. 기본 경로는 배치 큐라 페이지와 함께 사라진다 —
  // 그때만 sendBeacon 경로를 고른다(FRT-329).
  atUnload = false,
): void {
  const props = {
    outcome,
    persisted,
    question_count: snapshot?.answers?.length ?? 0,
    ...(storageTier === undefined ? {} : { storage_tier: storageTier }),
  };
  if (atUnload) capture("cover_letter_edit_saved", props, { atUnload: true });
  else capture("cover_letter_edit_saved", props);
}

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

  // AI 초안에 처음 손댄 시점·저장 없이 나간 시점(FRT-107)을 지키는 두 플래그. 아래 조회
  // effect 가 문서 전환마다 리셋해야 하므로, 그 effect보다 먼저 선언해 둔다.
  // '나가기'는 스스로 이동을 일으켜 언마운트로 이어진다 — 이미 쐈으면 두 번 세지 않는다.
  const exitDraftFiredRef = useRef(false);
  // 탭이 숨겨질 때 이 탭이 마지막으로 담아 둔 편집(FRT-329). 손대지 않은 채 다시 숨겨지면
  // 같은 것을 다시 쓰지 않고(같은 문서를 연 다른 탭이 남긴 편집을 덮지 않도록), 그 편집을
  // 되돌려 깨끗해지면 담아 둔 것도 치운다(레쥬메 상세와 같은 규칙).
  const hiddenSnapshotRef = useRef<CoverLetterResult | null>(null);

  useEffect(() => {
    // 늦게 도착한 답이 무엇 하나라도 건드리면 id 와 본문이 어긋난다. 응답 이후의 갱신은
    // 전부 이 가드 안에 둔다 — 절반만 가드하면 절반만 고쳐진 버그가 된다.
    let ignore = false;

    // 다른 문서를 열면 그 문서의 exit_draft 는 아직 한 번도 안 쐈다(레쥬메 상세와 같은 이유,
    // FRT-238). 이 ref 를 문서 전환마다 안 내리면, 한 번이라도 이탈이 잡힌 뒤로는 이 인스턴스가
    // 재사용하는 모든 다음 문서의 exit_draft 가 영영 안 잡힌다.
    exitDraftFiredRef.current = false;
    // 이전 문서에서 담아 둔 것은 이전 문서의 키에 있다 — 이 문서가 깨끗하다고 그 키를 지우면
    // 안 된다.
    hiddenSnapshotRef.current = null;

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
  const savingRef = useRef(false);
  // '뒤로' 버튼이 이미 이 이탈을 알렸으면 뒤이은 언마운트 cleanup 은 같은 경고를 또
  // 띄우지 않는다 — router.push 가 이 컴포넌트를 곧바로 언마운트시키므로, 가드가 없으면
  // 저장 계층 경고(tierWarning)가 사용자에게 두 번 뜬다(FRT-261 회귀).
  const exitHandledRef = useRef(false);
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
  // 언마운트 시점에 "저장이 아직 도는 중인가". 그 요청이 곧 자기 결말을 쏘므로 이탈
  // 계측과 겹치면 안 된다(아래 cleanup).
  savingRef.current = saving;

  // AI 초안에 처음 손댄 시점(FRT-107). 레쥬메의 resume_edited 와 같은 축이다 —
  // "AI 결과물을 얼마나 고쳐 쓰는가"는 두 기능에 같은 질문이고, 자소서 쪽만 이 관측이
  // 통째로 비어 있었다. 문서(requestKey)당 1회 — 키 입력마다 쏘면 이벤트가 폭증한다.
  const editedFiredKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // 아직 이 문서를 다 못 불러왔으면 result/initial 은 **앞 문서의 것**이다(A→B 전환에서
    // id·requestKey 만 먼저 바뀐다). 그 상태로 쏘면 B 의 id 에 A 의 수정 문항이 실리고,
    // B 의 키가 발화 완료로 찍혀 **B 의 진짜 수정이 영영 안 잡힌다.** 저장 경로가 이미
    // 같은 이유로 이 창을 기다린다(loadedKey).
    if (loading) return;
    if (!dirty || editedFiredKeyRef.current === requestKey) return;
    const questionIndex = firstChangedAnswerIndex(result, initial);
    // 본문이 아니라 다른 무엇이 달라진 경우(-1)는 "고쳐 썼다"가 아니다.
    if (questionIndex < 0) return;
    editedFiredKeyRef.current = requestKey;
    capture("cover_letter_edited", {
      cover_letter_id: id,
      question_index: questionIndex,
    });
  }, [dirty, result, initial, requestKey, id, loading]);
  // requestKeyRef 는 여기서 갱신하지 않는다 — 아래 effect(커밋 단계)에서만 움직인다.

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
      // 응답이 도는 동안 화면이 이 요청을 떠났을 수 있다. 그때 아래 정리를 그대로 실행하면
      // **지금 화면이 쓰고 있는 draft 를 지운다** — 배너는 남고 되돌릴 내용만 사라진다.
      // App Router 는 id 만 바뀌면 이 인스턴스를 재사용하고(FRT-238), 언마운트해도 seq 는
      // 0 부터 다시 시작하므로 "떠났다"를 id 만으로는 알 수 없다.
      //
      // 그래서 판정은 id 가 아니라 **requestKey**(문서 + 세대)다. A→B→A 로 돌아오면 id 는
      // 다시 같아지지만 그 사이 재조회가 끼어들어 화면은 저장 전 본문을 들고 있다.
      //
      // 이 문서의 편집분은 화면이 떠나던 순간의 cleanup 이 이미 같은 키에 남겼다. 떠난
      // 뒤에는 아무것도 하지 않는다 — pendingDraft 도 지금은 다음 요청의 배너다.
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
      captureEditSaved("server", true, updated);
      toast.success("저장됐어요");
    } catch (err) {
      // 서버에 저장 경로가 없다(BAC-62 미착수). 편집을 잃을 이유는 아니므로 **항상** 로컬에
      // 남긴다 — 미지원이든 서버 장애든 결과가 같기 때문이다(FRT-148 의 네 경로).
      const latest = resultRef.current ?? snapshot;
      const tier = writeDraft(id, latest);
      const saved = tier !== null;
      // 담기긴 했지만 오래 못 버티는 계층일 수 있다 — 그 사실을 안 알리면 사용자는 저장된
      // 줄 알고 탭을 닫는다(FRT-261).
      const tierWarning = draftTierWarning(tier);
      // 서버에 못 남긴 저장. persisted 는 **어디든** 남았는가라, false 가 진짜 유실이다.
      captureEditSaved("failed", saved, latest, tier);
      if (saved) {
        // 방금 쓴 임시 저장이 곧 지금 편집 중인 내용이다. 배너를 남겨 두면 '복원'이 화면에
        // 없는 낡은 스냅샷을 되돌리면서 방금 쓴 최신 저장까지 지운다 — 배너 하나가 편집을
        // 두 번 잃게 만든다(FRT-148).
        setPendingDraft(null);
      }

      if (err instanceof CoverLetterMutationUnsupportedError) {
        if (saved) {
          setInitial(snapshot);
          // 경고가 있으면 그쪽이 먼저다 — "곧 제공될 예정"은 지금 할 일을 말해주지 않는다.
          if (tierWarning) toast.error(tierWarning);
          else toast("편집 저장 기능은 곧 제공될 예정이에요", "info");
        } else {
          toast.error("임시 저장도 실패했어요. 페이지를 닫지 마세요.");
        }
      } else {
        // dirty 는 그대로 둔다 — 다음 저장/이탈 경로가 계속 살아 있어야 한다.
        const detail = "저장에 실패했어요. 잠시 후 다시 시도해주세요.";
        toast.error(tierWarning ? `${detail} ${tierWarning}` : detail);
      }
    } finally {
      setSaving(false);
    }
  }, [result, dirty, saving, loading, id, requestKey]);

  const handleBack = useCallback(() => {
    if (dirty && result) {
      const tier = writeDraft(id, result);
      // 저장 버튼을 누른 적은 없지만 사용자에게는 "임시 저장했어요"라고 **말한다**.
      // 여기서 안 쏘면 안전하게 보관된 편집이 유실된 편집과 데이터상 구별되지 않고,
      // 실패(=편집 유실 직전)한 순간은 아예 어디에도 남지 않는다(FRT-107).
      captureEditSaved("exit_draft", tier !== null, result, tier);
      if (tier === null) {
        // 아무 데도 못 담았다 — 나가면 그대로 잃는다. 여기서만 이동을 막는다.
        // 실패한 '나가기'는 이탈이 아니다 — 사용자는 화면에 그대로 남는다. 여기서 중복
        // 방지 플래그를 세우면 뒤이어 **진짜로** 떠날 때 보관된 편집이 안 남는다.
        toast.error("임시 저장에 실패했어요. 저장 후 나가주세요.");
        return;
      }
      exitDraftFiredRef.current = true;
      // 담기긴 했으니 붙잡아 둘 이유가 없다. 이 환경에서는 아무리 눌러도 영구 저장이
      // 성공하지 않아, 막으면 출구 없는 화면이 된다. 대신 무엇을 조심해야 하는지 알린다.
      const tierWarning = draftTierWarning(tier);
      if (tierWarning) toast.error(tierWarning);
      else toast("변경사항을 임시 저장했어요", "info");
      // 이동이 확정된 뒤에만 세운다 — 곧 이어질 언마운트가 이 경고를 또 띄우지 않도록.
      exitHandledRef.current = true;
    }
    router.push(`${basePath}/export`);
  }, [dirty, result, id, router, basePath]);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    // 복원은 사용자의 편집이 아니라 **지난 세션 편집의 복구**다. 여기서 표식을 미리 세우지
    // 않으면 setResult 가 initial(서버본) 과 갈라져 dirty 를 세우고, 위 effect 가 그것을
    // "방금 고쳐 썼다"로 읽어 아무 타건 없이 cover_letter_edited 를 쏜다.
    //
    // 표식을 **소진**하는 것이지 잠깐 미루는 게 아니다 — 복원 직후 이어지는 진짜 편집도 다시
    // 첫 편집으로 잡지 않는다. 배너가 떴다는 건 이 문서에 손댄 사실이 지난 세션에 이미
    // 세어졌다는 뜻이라, 또 쏘면 한 문서가 두 번 잡힌다. 레쥬메가 같은 자리에서 같은 판단을 한다.
    editedFiredKeyRef.current = requestKey;
    setResult(pendingDraft.data);
    setPendingDraft(null);
    clearDraft(id);
  }, [pendingDraft, id, requestKey]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(id);
    setPendingDraft(null);
  }, [id]);

  // 화면이 **실제로** 답하고 있는 요청을 새긴다. 렌더 중에 쓰지 않는 이유는 커밋되지 않는
  // 렌더가 있기 때문이다 — 다른 문서로 가던 전환이 취소되면 화면은 이 문서에 남는데 키만
  // 그쪽으로 바뀌고, 그 상태로 저장이 끝나면 가드가 "떠났다"고 오판해 낡은 draft 와 배너를
  // 남긴다(FRT-191 이 되살아난다). cleanup 이 곧 무효화다 — 언마운트면 null 로 남아, 같은
  // 문서로 다시 들어온 새 인스턴스의 키와 겹치지 않는다. 아래 draft 보관 effect 보다 먼저
  // 선언해 cleanup 도 먼저 돌게 둔다.
  useEffect(() => {
    const ref = requestKeyRef;
    ref.current = requestKey;
    return () => {
      ref.current = null;
    };
  }, [requestKey]);

  // 클라이언트 이동(언마운트)에도 편집을 남긴다.
  //
  // 상단 '뒤로' 버튼만 출구가 아니다 — GNB 링크·브라우저 뒤로가기로 떠나도 여기로 온다.
  // 그런데 그 경로들이 기댈 안전망은 이것 하나뿐이라, 여기서 결과를 버리면 저장 실패가
  // **아무에게도 안 알려진 채** 편집이 사라진다(FRT-261). toast 는 모듈 전역 pub/sub 라
  // 이 컴포넌트가 죽은 뒤에도 다음 화면에서 정상적으로 뜬다.
  useEffect(() => {
    return () => {
      if (!dirtyRef.current || !resultRef.current) return;
      const tier = writeDraft(id, resultRef.current);
      // 상단 '뒤로'만 출구가 아니다 — GNB 링크로 떠나도 페이지는 조용히 임시 저장한다.
      // 그 편집도 어디까지 갔는지는 같은 질문이라 같은 이벤트로 남긴다(FRT-107).
      //
      // ⚠️ 저장이 아직 도는 중이면 **계측만** 건너뛴다. 그 요청은 곧 server/failed 로 자기
      // 결말을 쏘는데, 여기서 exit_draft 까지 쏘면 한 번의 저장 시도에 서로 배타적인 결말이
      // 둘 실린다. 게다가 exit_draft 는 "저장을 누르지 않고 떠났다"는 뜻이라, 방금 누른
      // 사용자에게는 거짓이다. 임시 저장(writeDraft)은 그대로 남긴다 — 응답이 늦게 오거나
      // 실패할 수 있으니 편집을 지키는 쪽은 건드리지 않는다.
      if (!exitDraftFiredRef.current && !savingRef.current) {
        exitDraftFiredRef.current = true;
        captureEditSaved("exit_draft", tier !== null, resultRef.current, tier);
      }
      // '뒤로' 버튼이 같은 이탈을 이미 경고했으면 여기서는 조용히 저장만 이어간다.
      if (exitHandledRef.current) return;
      const tierWarning = draftTierWarning(tier);
      if (tierWarning) toast.error(tierWarning);
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

  // 탭을 그대로 닫는 경우(cleanup 미실행)에 경고만 띄운다. 저장은 아래 pagehide 가 맡는다(bfcache).
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // 탭을 닫거나 새로고침해도 편집을 남긴다(FRT-329). 위 언마운트 cleanup 은 진짜 페이지
  // 언로드에서는 실행되지 않아, 사용자가 경고에서 "나가기"를 고르면 편집이 그대로 사라졌다.
  //
  // 탭이 숨겨질 때(hidden)는 **조용히 담아 두기만** 한다 — 탭 전환은 이탈이 아니고 돌아와서
  // 계속 쓰지만, 모바일은 이 뒤에 pagehide 없이 탭을 죽이는 일이 잦다. pagehide 는 진짜
  // 떠남이라 같은 exit_draft 로 센다. 단 저장이 도는 중이면 계측은 건너뛴다(언마운트 cleanup
  // 과 같은 이유 — 한 시도에 결말 하나). 토스트는 띄우지 않는다 — 볼 사람이 없는 화면이고,
  // 실패는 persisted:false 로 지표에 남는다. "머무르기"를 고르면 pagehide 가 오지 않으므로
  // 경고 다이얼로그와 순서가 얽히지 않는다. 레쥬메 상세와 같은 훅·같은 규칙이다.
  //
  // 다른 문서로 옮기는 창(loading)에서는 걸지 않는다 — id 는 이미 다음 문서인데 result/dirty
  // 는 아직 이전 문서 것이라(FRT-238), 여기서 담으면 이전 문서의 편집이 다음 문서의 키로
  // 들어간다. 이전 문서의 편집은 문서가 바뀌는 순간 위 언마운트 cleanup 이 이전 키로 이미
  // 남겼다(handleSave 가 loading 을 가드하는 것과 같은 이유).
  useEffect(() => {
    if (loading || dirty || hiddenSnapshotRef.current === null) return;
    hiddenSnapshotRef.current = null;
    clearDraft(id);
  }, [dirty, loading, id]);

  usePersistOnUnload({
    enabled: dirty && !loading,
    onPersist: (reason) => {
      if (!dirtyRef.current || !resultRef.current) return;
      const snapshot = resultRef.current;
      if (reason === "hidden") {
        if (snapshot === hiddenSnapshotRef.current) return;
        hiddenSnapshotRef.current = snapshot;
        writeDraft(id, snapshot);
        return;
      }
      const tier = writeDraft(id, snapshot);
      if (exitDraftFiredRef.current || savingRef.current) return;
      // 한 이탈은 한 번만 센다 — '뒤로'가 이미 셌거나, 이 뒤에 언마운트가 이어져도.
      exitDraftFiredRef.current = true;
      captureEditSaved("exit_draft", tier !== null, snapshot, tier, true);
    },
  });

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

  // FRT-193 — 편집기가 설 자리는 **렌더할 문항이 있는가**로 정한다. 본문이 비었는지로
  // 가르면 마지막 글자를 지우는 순간 편집기가 통째로 언마운트돼, 그 화면에서 다시 쓸
  // 방법이 사라진다(문항이 1개면 즉시, 페이지를 나갔다 와야 복구됐다). 형제인
  // `CoverLetterPreview` 가 이미 쓰는 규칙과 같다.
  const hasQuestions = result.answers.length > 0;

  // "생성 결과가 부실하다"는 안내다. 그러므로 재는 대상은 편집 중인 `result` 가 아니라
  // 서버가 만들어 준 `original` 이다 — 사용자가 스스로 지운 것은 여기 해당하지 않는다.
  // 안내는 편집기를 **치우는 대신 그 위에 선다**: 배타 분기로 두는 한, 기준만 고쳐도
  // 빠져나올 수 없는 화면은 다른 조건으로 또 만들어진다.
  //
  // 그 자리에서 직접 써 넣기 시작하면 물러난다(`result` 조건). 기준선을 아직 모르면
  // (`original === null`) 안내하지 않는다 — 모르는 것을 단정하느니 편집기만 세운다.
  const generatedEmpty =
    original !== null &&
    isEmptyCoverLetter(original) &&
    isEmptyCoverLetter(result);

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
          onClick={() => {
            // 만든 자소서를 실제로 꺼내간 시점(FRT-107). export_completed 까지만 보면
            // "만들어놓고 안 쓰는지"가 안 보인다 — 레쥬메의 resume_downloaded 와 같은 축.
            capture("cover_letter_downloaded", { format: "print" });
            window.print();
          }}
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

            {generatedEmpty && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-body text-text-primary">본문이 비어 있어요.</p>
                <p className="mt-1 text-body-sm text-text-secondary">
                  기록이 부족하면 초안이 짧게 나올 수 있어요. 경험을 더 남기고 다시 만들어보세요.
                </p>
              </div>
            )}

            {hasQuestions && (
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
