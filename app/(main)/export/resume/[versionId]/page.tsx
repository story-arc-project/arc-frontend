"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./print.css";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  createResume,
  getResume,
  ResumeNotReadyError,
  updateResume,
} from "@/lib/api/export-api";
import { capture, type ResumeSaveOutcome } from "@/lib/analytics";
import { useBasePath } from "@/lib/utils/use-base-path";
import { isEmptySection, type ResumeVersion } from "@/types/resume";
import { DraftRestoreBanner } from "./_components/DraftRestoreBanner";
import { EmptyResumeState } from "./_components/EmptyResumeState";
import {
  ExportFormatDialog,
  type ExportFormat,
} from "./_components/ExportFormatDialog";
import { ParsingWarningsBanner } from "./_components/ParsingWarningsBanner";
import { RegenerateConfirmDialog } from "./_components/RegenerateConfirmDialog";
import { ResumeDetailSkeleton } from "./_components/ResumeDetailSkeleton";
import { ResumeDetailTopBar } from "./_components/ResumeDetailTopBar";
import { ResumeEditorPanel } from "./_components/ResumeEditorPanel";
import { ResumePreview } from "./_components/ResumePreview";
import { EnglishReadOnlyNotice } from "./_components/EnglishReadOnlyNotice";
import { RemainingExperiencesNotice } from "./_components/RemainingExperiencesNotice";
import { draftTierWarning, type DraftTier } from "@/lib/export/draft-storage";
import { usePersistOnUnload } from "@/lib/export/use-persist-on-unload";
import { reserveClientIds } from "./_components/editors/shared";
import { changedResumeSections } from "./_components/resume-diff";
import {
  clearDraft,
  isDraftNewer,
  isStoredDraft,
  readDraft,
  writeDraft,
  type ResumeDraft,
} from "./_components/resume-draft";

type MobileTab = "editor" | "preview";

interface PageProps {
  params: Promise<{ versionId: string }>;
}

export default function ResumeDetailPage({ params }: PageProps) {
  const { versionId } = use(params);
  const router = useRouter();
  const basePath = useBasePath();

  const [resume, setResume] = useState<ResumeVersion | null>(null);
  const [initial, setInitial] = useState<ResumeVersion | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<ResumeDraft | null>(null);
  const [continueAnyway, setContinueAnyway] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  // FRT-114: "AI 초안에 손을 댔다"는 버전당 한 번만 쏜다. 키 입력마다 발화하면
  // 이벤트가 폭증하고, 그러면 "몇 명이 고쳤나"를 세는 데 쓸 수 없다.
  const editedFiredRef = useRef(false);
  // '나가기'는 스스로 router.push 를 해 곧바로 언마운트로 이어진다 — 두 출구가 각각 쏘면
  // 한 번의 이탈이 두 건으로 잡힌다. 먼저 쏜 쪽이 이 플래그로 뒤쪽을 막는다.
  const exitDraftFiredRef = useRef(false);
  // 탭이 숨겨질 때 이 탭이 마지막으로 담아 둔 편집(FRT-329). 두 가지를 판정한다 —
  // 손대지 않은 채 다시 숨겨지면 같은 것을 다시 쓰지 않고(같은 문서를 연 다른 탭이 그 사이
  // 남긴 편집을 덮지 않도록), 그 편집을 되돌려 깨끗해지면 담아 둔 것도 치운다(안 치우면
  // dirty 가 풀려 아무 경로도 손대지 않아, 다음 진입에 버린 편집을 복원하라고 권한다).
  const hiddenSnapshotRef = useRef<ResumeVersion | null>(null);

  // FRT-238 — App Router 는 versionId 만 바뀌면 이 인스턴스를 재사용한다. 그래서 이전 버전의
  // 조회가 아직 날아다니는 채로 다음 조회가 시작되고, 늦게 도착한 쪽이 화면을 덮으면 **보고 있는
  // 버전과 실린 내용이 어긋난 채로 저장**된다.
  //
  // 세대(seq)까지 키에 넣는 건 **되돌아오는 경로** 때문이다. versionId 만으로 키를 만들면
  // A→B→A 로 돌아왔을 때 그 키가 이미 답을 받아둔 키와 같아져, 재조회 중인데도 옛 내용이
  // 그대로 보인다. versionId 는 prop 이라 setState 로 못 바꾸므로 "지난 렌더와 달라졌는가"를
  // 렌더 중에 비교해 커밋 전에 세대를 올린다 — 한 번 쓴 키는 다시 쓰이지 않는다.
  const [seq, setSeq] = useState(0);
  const [trackedVersionId, setTrackedVersionId] = useState(versionId);
  if (versionId !== trackedVersionId) {
    setTrackedVersionId(versionId);
    setSeq((s) => s + 1);
  }

  // 화면이 지금 답해야 할 질문과, 실제로 답을 받아둔 질문. 둘이 다르면 그 자체가 로딩이다 —
  // 별도 플래그를 두지 않으므로 "로딩만 꺼지고 내용은 옛것"인 어긋난 중간 상태가 아예 없다.
  const requestKey = `${versionId}:${seq}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  const handleRetry = useCallback(() => setSeq((s) => s + 1), []);

  useEffect(() => {
    // 늦게 도착한 답이 무엇 하나라도 건드리면 버전과 내용이 어긋나므로, 응답 이후의 갱신은
    // 전부 이 가드 안에 둔다. 절반만 가드하면 절반만 고쳐진 버그가 된다.
    let ignore = false;

    // 새 버전 로드(재생성으로 이동해 온 경우 포함) 시 재생성 UI 상태를 초기화한다.
    // 동일 인스턴스가 재사용돼도 '다시 만들기' 버튼/다이얼로그가 잔존(영구 비활성)하지
    // 않도록 여기서 리셋한다.
    setRegenerating(false);
    setRegenerateOpen(false);
    // 다른 버전을 열면 그 버전의 초안은 아직 손대지 않은 상태다.
    editedFiredRef.current = false;
    exitDraftFiredRef.current = false;
    // 이전 버전에서 담아 둔 것은 이전 버전의 키에 있다 — 이 버전이 깨끗하다고 그 키를 지우면
    // 안 되고, 이 버전에 같은 객체가 다시 올 일도 없다.
    hiddenSnapshotRef.current = null;

    getResume(versionId)
      .then((data) => {
        if (ignore) return;
        setResume(data);
        setInitial(data);
        // 성공은 지난 실패를 지운다 — 안 지우면 재시도가 성공해도 에러 화면이 남는다.
        setError(null);
        reserveClientIds(data);

        const draft = readDraft(versionId);
        if (draft && isDraftNewer(draft, data)) {
          reserveClientIds(draft.data);
          setPendingDraft(draft);
        } else {
          setPendingDraft(null);
          // draft 삭제는 되돌릴 수 없다. 버려질 응답이 낡은 시점의 판정으로 사용자의
          // 임시저장분을 지우지 않도록, 이 정리도 반드시 가드 뒤에 있어야 한다.
          if (draft) clearDraft(versionId);
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
  }, [versionId, requestKey]);

  const dirtyRef = useRef(false);
  const resumeRef = useRef<ResumeVersion | null>(null);
  const initialRef = useRef<ResumeVersion | null>(null);
  // 이 인스턴스가 **지금** 답하고 있는 질문. 비동기 저장의 클로저는 시작 당시의 것을 쥐고
  // 있어, 응답이 늦게 오면 둘이 갈린다(아래 handleSave). versionId 가 아니라 requestKey 인
  // 것은 A→B→A 때문이다 — 돌아오면 versionId 는 같아지지만 그 사이 재조회가 끼어들어
  // resumeRef 는 **저장 전** 본문으로 되돌아가 있다. 세대까지 봐야 그 왕복이 잡힌다.
  //
  // 언마운트하면 null 이 된다(아래 effect) — 언마운트는 seq 를 올리지 않으므로, 같은
  // 레쥬메로 다시 들어온 **새 인스턴스**의 키(seq 가 0 부터 다시 시작)와 겹친다. 그 상태로
  // 늦게 끝난 옛 저장이 가드를 통과하면, 새 인스턴스가 **복원하라고 띄워 둔 draft 를 지운다**
  // — 배너는 화면에 남아 있는데 되돌릴 내용은 사라진 상태가 된다.
  const requestKeyRef = useRef<string | null>(requestKey);

  // FRT-147 — 영문 레쥬메는 읽기·내보내기 전용이다(매핑이 단방향이라 저장하면 영문 전용
  // 값이 사라진다). 편집 UI 를 숨기는 것만으로 막으면 그 바깥에서 setResume 을 부르는
  // 경로가 하나만 생겨도 저장이 다시 열린다.
  const readOnly = resume?.meta?.language === "en";

  // 저장·임시저장(나가기/언마운트)·Ctrl+S·이탈 경고가 **전부 dirty 를 보고** 움직이므로,
  // 읽기 전용을 여기 한 곳에서 막으면 그 경로들이 한꺼번에 닫힌다.
  const dirty = useMemo(() => {
    if (!resume || !initial || readOnly) return false;
    return JSON.stringify(resume) !== JSON.stringify(initial);
  }, [resume, initial, readOnly]);

  // Sync refs during render so the unmount handler sees the latest values
  // even when client navigation fires before passive effects flush.
  dirtyRef.current = dirty;
  resumeRef.current = resume;
  initialRef.current = initial;
  // requestKeyRef 는 여기서 갱신하지 않는다 — 아래 effect(커밋 단계)에서만 움직인다.

  // 저장의 결말들(서버 저장·백엔드 미수용·그 외 오류·저장 없이 이탈)이 사용자에겐 거의
  // 같아 보이지만 데이터로는 전혀 다른 사실이다. 한 곳에서 같은 모양으로 싣는다(FRT-114).
  const captureEditSaved = useCallback(
    (
      outcome: ResumeSaveOutcome,
      persisted: boolean,
      changed: string[],
      // 로컬로 떨어진 경우 **어느 계층**에 담겼는지. 같은 "보관됨"이라도 브라우저를 닫으면
      // 사라지는 보관이 섞여 있어, 이걸 안 나누면 유실 규모를 과소 보고한다(FRT-261).
      storageTier?: DraftTier | null,
      // 화면이 사라지는 순간(탭 닫기)에 쏘는가. 기본 경로는 배치 큐라 페이지와 함께
      // 사라진다 — 그때만 sendBeacon 경로를 고른다(FRT-329).
      atUnload = false,
    ) => {
      const props = {
        outcome,
        persisted,
        sections: changed,
        section_count: changed.length,
        ...(storageTier === undefined ? {} : { storage_tier: storageTier }),
      };
      if (atUnload) capture("resume_edit_saved", props, { atUnload: true });
      else capture("resume_edit_saved", props);
    },
    [],
  );

  const isFullyEmpty = useMemo(() => {
    if (!resume) return false;
    return (
      isEmptySection(resume.인적사항) &&
      !resume.자기소개_요약?.trim() &&
      isEmptySection(resume.학력) &&
      isEmptySection(resume.경력) &&
      isEmptySection(resume.프로젝트) &&
      isEmptySection(resume.대외활동) &&
      isEmptySection(resume.동아리_학회) &&
      isEmptySection(resume.수상) &&
      isEmptySection(resume.자격증) &&
      isEmptySection(resume.어학) &&
      isEmptySection(resume.기술및역량) &&
      // 논문·기타정보도 화면에 그리는 내용이다. 여기서 빠뜨리면 이 둘에만 값이 있는
      // 레쥬메(영문 CV 는 publications 만 남는 경우가 실제로 있다)가 "비어 있음"으로
      // 판정돼, 그리면 되는 내용을 두고 EmptyResumeState 가 뜬다.
      isEmptySection(resume.논문) &&
      isEmptySection(resume.기타정보)
    );
  }, [resume]);

  const versionLabel = useMemo(() => {
    if (!resume) return "레쥬메";
    const shortId = versionId.slice(0, 8);
    const lang = resume.meta.language === "en" ? "🇺🇸" : "🇰🇷";
    return `레쥬메 #${shortId} ${lang}`;
  }, [resume, versionId]);

  // 편집기의 onChange 를 그대로 setResume 에 넘기지 않고 한 겹 감싼다 — 초안 대비 처음
  // 달라지는 순간이 여기서만 보인다(FRT-114). dirty 는 렌더 이후 값이라 "false→true 전이"를
  // effect 로 잡으면 어느 섹션이 바뀌었는지는 이미 알 수 없다.
  const handleEditorChange = useCallback(
    (next: ResumeVersion) => {
      if (!editedFiredRef.current && initial) {
        const changed = changedResumeSections(initial, next);
        if (changed.length > 0) {
          editedFiredRef.current = true;
          capture("resume_edited", {
            section: changed[0],
            version_id: versionId,
          });
        }
      }
      setResume(next);
    },
    [initial, versionId],
  );

  const handleSave = useCallback(async () => {
    // FRT-238 — loading 은 versionId 가 이미 바뀌었지만 새 버전의 응답은 아직 안 온 창이다.
    // 이 창에서 resume/dirty 는 여전히 **이전** 버전 것인데 versionId 는 **다음** 버전이라,
    // 가드 없이 저장하면 이전 버전 내용을 다음 버전 id 로 PATCH 해버린다. 저장 버튼은 이
    // 창에서 렌더되지 않아 안전하지만, 전역 Ctrl/Cmd+S 리스너는 이 창에서도 계속 살아있다.
    if (!resume || !dirty || saving || loading) return;
    setSaving(true);
    const snapshot = resume;
    // 서버로 보내는 건 snapshot 이고, 성공 시 initial 이 서버 응답으로 갈린다 —
    // **비교는 지금** 해둬야 한다. (실패 갈래는 서버가 아니라 로컬에 최신본을 남기므로
    // 거기서 다시 잰다.)
    const sections = changedResumeSections(initial, snapshot);
    try {
      const updated = await updateResume(versionId, snapshot);
      setInitial(updated);
      setResume((current) => (current === snapshot ? updated : current));
      // 응답이 도는 동안 화면이 이 요청을 떠났을 수 있다. 그때 아래 정리를 그대로 실행하면
      // **지금 화면이 쓰고 있는 draft 를 지운다** — 배너는 남고 되돌릴 내용만 사라진다.
      // App Router 는 versionId 만 바뀌면 이 인스턴스를 재사용하고(FRT-238), 언마운트해도
      // seq 는 0 부터 다시 시작하므로 "떠났다"를 id 만으로는 알 수 없다.
      //
      // 그래서 판정은 versionId 가 아니라 **requestKey**(버전 + 세대)다. A→B→A 로 돌아오면
      // versionId 는 다시 같아지지만 그 사이 재조회가 끼어들어 화면은 **저장 전** 본문을 들고
      // 있고, 그때 저장소에 있는 draft 는 이 저장이 지울 것이 아니다.
      //
      // 이 버전의 편집분은 화면이 떠나던 순간의 cleanup 이 이미 같은 키에 남겼다. 떠난
      // 뒤에는 **아무것도 하지 않는 것**이 옳다 — pendingDraft 도 지금은 다음 요청의 배너다.
      if (requestKeyRef.current === requestKey) {
        // 규칙은 하나다 — **저장에 성공하면 이 버전의 draft 는 없다.**
        //
        // 요청이 도는 동안 이어 고쳤더라도 여기서 그 최신본으로 "갈아끼우지" 않는다. 그렇게
        // 만든 draft 는 그 자체가 다음 사고의 씨앗이다: 사용자가 그 편집을 곧바로 되돌려도
        // draft 는 저장소에 남아(dirty 가 false 로 돌아가 이탈 경로들이 손대지 않는다) 다음
        // 진입 때 **지운 편집을 되살리라고 권한다**. 이어 고친 편집은 화면과 dirty 에 그대로
        // 살아 있어 나가기·언마운트 cleanup·Ctrl+S 가 남긴다 — 저장 시점의 스냅샷을 하나 더
        // 만들 이유가 없다.
        clearDraft(versionId);
        // 배너도 같은 이유로 지운다. 그 스냅샷은 서버 최신본보다 낡았고, 남겨 두면 '복원'이
        // 방금 저장한 내용을 그것으로 덮고 clearDraft 까지 불러 되돌릴 길도 없앤다 — 실패
        // 갈래에서만 막아 둔 것을 성공 갈래에서도 막는다(FRT-191).
        setPendingDraft(null);
      }
      toast.success("저장됐어요");
      captureEditSaved("server", true, sections);
    } catch (err) {
      // 실패는 갈래가 하나다. 서버에 PATCH 가 실재하는 지금(FRT-111) "아직 저장을 못
      // 받는다"는 상태는 없고, 어떤 실패든 **서버엔 안 남았다**는 같은 사실을 뜻한다.
      // 서버 장애·오프라인도 편집을 잃을 이유는 아니다. 언마운트 핸들러에만 기대면
      // 탭을 그대로 닫았을 때(cleanup 미실행) 고친 내용이 통째로 사라진다.
      // dirty 는 그대로 두어 다음 저장/이탈 경로가 계속 살아 있게 한다.
      const latest = resumeRef.current ?? snapshot;
      const tier = writeDraft(versionId, latest);
      const saved = tier !== null;
      const tierWarning = draftTierWarning(tier);
      if (saved) {
        // 방금 쓴 임시 저장이 곧 지금 편집 중인 내용이다. 배너를 그대로 두면 '복원'이
        // 화면에 없는 낡은 스냅샷(pendingDraft)을 되돌리면서 clearDraft 로 방금 쓴
        // 최신 임시 저장까지 지운다 — 배너 하나가 편집을 두 번 잃게 만든다.
        setPendingDraft(null);
      }
      // 4xx 는 다시 시도해도 같은 결과다 — 제목 길이 초과 같은 검증 실패(422)는 입력을
      // 고쳐야 통과한다. "잠시 후 다시 시도해주세요"로 뭉개면 사용자는 고칠 수 있는 것을
      // 못 고친 채 재시도만 반복한다. 서버가 준 사유를 그대로 보여준다(ProfileEditForm
      // 과 같은 관용구). 5xx·네트워크 장애는 실제로 잠시 후면 되므로 그대로 둔다.
      //
      // 단 400 은 서버 메시지를 그대로 쓰지 않는다. 이 코드를 내는 분기는 "생성이 아직
      // 안 끝났다" 하나뿐인데(`patch_resume`) 메시지가 영문이라 읽히지 않는다 —
      // 사유를 보여주는 규칙보다 **읽히는 것**이 먼저다.
      const reason = !(err instanceof ApiError)
        ? null
        : err.status === 400
          ? "아직 레쥬메를 만드는 중이에요. 완성되면 저장할 수 있어요."
          : err.status > 400 && err.status < 500
            ? err.message
            : null;
      const detail = reason ?? "저장에 실패했어요. 잠시 후 다시 시도해주세요.";
      // 서버도 로컬도 못 남긴 = 편집 유실 직전. 그렇다고 사유를 빼면 안 된다 — 사유가
      // 곧 탈출구다(제목 길이 초과라면 고쳐서 바로 저장하면 위기 자체가 사라진다).
      // 둘 다 말한다: 무엇이 잘못됐는지, 그리고 지금 닫으면 잃는다는 것.
      // 담긴 계층이 오래 못 버티면 그것도 함께 말한다 — "저장됐다"고 읽히면 사용자는
      // 탭을 닫고, 그 순간 임시 보관분까지 사라진다(FRT-261).
      toast.error(
        saved
          ? tierWarning
            ? `${detail} ${tierWarning}`
            : detail
          : `${detail} 임시 저장도 안 됐으니 페이지를 닫지 마세요.`,
      );
      // 섹션은 **실제로 보관된 값(latest)** 기준이다 — 요청이 도는 동안 이어서 고친
      // 섹션이 draft 에는 들어갔는데 지표에서만 빠지면 보관된 편집을 과소 보고한다.
      captureEditSaved("failed", saved, changedResumeSections(initial, latest), tier);
    } finally {
      setSaving(false);
    }
  }, [
    resume,
    dirty,
    saving,
    loading,
    versionId,
    requestKey,
    initial,
    captureEditSaved,
  ]);

  const handleRegenerate = useCallback(async () => {
    if (!resume || regenerating) return;
    setRegenerating(true);
    // 이 경로도 아래에서 export_completed 를 쏜다. 누름을 여기서 안 잡으면 그 완료 하나가
    // 짝 없이 총계에 얹혀, "눌렀는데 요청이 안 나갔다"를 재는 **누름 − 완료** 차이가
    // 재생성 건수만큼 깎인다(FRT-107). 완료를 쏘는 자리마다 누름도 있어야 뺄셈이 성립한다.
    capture("export_execute_button_clicked", { export_type: "resume" });
    try {
      await createResume({ language: resume.meta.language });
      // '다시 만들기'도 새 레쥬메 버전이 만들어진 익스포트 완료다 — 모달 생성 경로만
      // 잡으면 퍼널이 이 사용자를 미완료로 센다(FRT-19).
      capture("export_completed", { export_type: "resume", language: resume.meta.language });
      // 재생성 확정 — dialog 약속대로 현재 편집/임시저장을 폐기한다. 기존 draft를
      // 지우고, 현재 편집을 initial로 확정해 dirty를 해소한다 → 이어질 언마운트
      // cleanup이 dirtyRef=false를 보고 draft를 되살리지 않는다.
      // regenerating은 여기서 끄지 않는다: 이동이 실제로 끝나기 전 버튼이 재활성돼
      // 두 번째 재생성이 겹치는 것을 막는다.
      clearDraft(versionId);
      setInitial(resume);
      // 서버가 새 id 를 주지 않아 새 버전으로 바로 갈 수 없다 — 목록에서 확인한다.
      toast("레쥬메를 다시 만들고 있어요. 완료되면 목록에 표시돼요", "info");
      router.push(`${basePath}/export`);
    } catch {
      toast.error("다시 만들기에 실패했어요. 잠시 후 다시 시도해주세요.");
      setRegenerating(false);
    }
  }, [resume, regenerating, router, basePath, versionId]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  // 파일 생성기(폰트·문서 라이브러리)는 무겁다 — 내보내기를 누른 순간에만 불러온다.
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!resume || exporting) return;

      if (format === "print") {
        // 인쇄는 브라우저 대화상자를 열 뿐이라 **실제로 인쇄했는지는 알 수 없다**.
        // 그래도 "결과물을 꺼내가려 했다"는 사실은 파일 다운로드와 같아 같은 이벤트에
        // 싣고 format 으로만 가른다 — 안 실으면 이 경로는 영영 데이터에 안 남는다.
        capture("resume_downloaded", {
          format: "print",
          language: resume.meta.language,
        });
        setExportOpen(false);
        // 상태 반영 전에 인쇄하면 모달 오버레이가 인쇄물에 그대로 찍힌다
        // (print.css 는 .no-print 만 숨기고 공용 Dialog 에는 그 클래스가 없다).
        // 다음 매크로태스크로 미뤄 모달이 DOM 에서 빠진 뒤 인쇄창을 연다.
        setTimeout(handlePrint, 0);
        return;
      }

      setExporting(format);
      try {
        // 서로 의존이 없는 두 청크 — 순차로 기다릴 이유가 없다.
        const [{ buildResumeDocument }, { downloadBlob, resumeFileName }] =
          await Promise.all([
            import("@/lib/export/resume-document"),
            import("@/lib/export/download"),
          ]);
        const doc = buildResumeDocument(resume);

        const blob =
          format === "pdf"
            ? await (await import("@/lib/export/resume-pdf")).renderResumePdf(doc)
            : await (
                await import("@/lib/export/resume-docx")
              ).renderResumeDocx(doc);

        downloadBlob(
          blob,
          resumeFileName({
            name: doc.header.name,
            language: doc.language,
            ext: format,
          }),
        );
        // 파일이 실제로 손에 떨어진 뒤에만 센다 — 생성 실패(catch)까지 세면
        // 생성기 버그가 심할수록 다운로드 지표가 멀쩡해 보인다(FRT-114).
        capture("resume_downloaded", { format, language: resume.meta.language });
        setExportOpen(false);
      } catch {
        toast.error("파일을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
      } finally {
        setExporting(null);
      }
    },
    [resume, exporting, handlePrint],
  );

  const handleBack = useCallback(() => {
    if (dirty && resume) {
      const tier = writeDraft(versionId, resume);
      // 저장 버튼을 누른 적은 없지만 사용자에게는 "임시 저장했어요"라고 **말한다**.
      // 여기서 안 쏘면 안전하게 보관된 편집이 유실된 편집과 데이터상 구별되지 않고,
      // 실패(=편집 유실 직전)한 순간은 아예 어디에도 남지 않는다(FRT-114).
      captureEditSaved(
        "exit_draft",
        tier !== null,
        changedResumeSections(initial, resume),
        tier,
      );
      if (tier === null) {
        toast.error("임시 저장에 실패했어요. 저장 후 나가주세요.");
        // 실패한 '나가기'는 이탈이 아니다 — 사용자는 화면에 그대로 남는다. 여기서
        // 중복 방지 플래그를 세우면 뒤이어 **진짜로** 떠날 때 보관된 편집이 안 남는다.
        return;
      }
      // 이동이 확정된 뒤에만 세운다 — 곧 이어질 언마운트가 같은 이탈을 또 세지 않도록.
      exitDraftFiredRef.current = true;
      // 담기긴 했으니 붙잡지 않는다. 이 환경에서는 아무리 눌러도 영구 저장이 성공하지
      // 않아 막으면 출구 없는 화면이 된다 — 대신 무엇을 조심할지 알린다(FRT-261).
      const tierWarning = draftTierWarning(tier);
      if (tierWarning) toast.error(tierWarning);
      else toast("변경사항을 임시 저장했어요", "info");
    }
    router.push(`${basePath}/export`);
  }, [
    dirty,
    resume,
    initial,
    versionId,
    router,
    basePath,
    captureEditSaved,
  ]);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    // 복원은 사용자의 편집이 아니라 **이전 세션 편집의 복구**다. 여기서 resume_edited 가
    // 나가면 "AI 결과에 손댔다"가 거짓이 되고, 그 편집은 이미 지난 세션에 한 번 잡혔다.
    // setResume 을 직접 부르는 것만으로는 부족하다 — 복원 직후 이어지는 진짜 편집이
    // 다시 첫 편집으로 잡히기 때문에 플래그를 여기서 소진한다.
    editedFiredRef.current = true;
    setResume(pendingDraft.data);
    setPendingDraft(null);
    clearDraft(versionId);
  }, [pendingDraft, versionId]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft(versionId);
    setPendingDraft(null);
  }, [versionId]);

  // 화면이 **실제로** 답하고 있는 요청을 새긴다. 다른 ref 들과 달리 렌더 중에 쓰지 않는 이유는
  // 커밋되지 않는 렌더가 있기 때문이다 — 다른 버전으로 가던 전환이 중간에 취소되면 화면은 이
  // 버전에 남는데 렌더 중 갱신한 키만 그 버전으로 바뀐다. 그 상태로 저장이 끝나면 가드가
  // "떠났다"고 오판해 낡은 draft 와 배너를 그대로 두고, 저장에 성공했는데도 '복원'이 그것을
  // 되돌릴 수 있다 — FRT-191 그 자체가 되살아난다. 커밋된 렌더만 이 키를 움직인다.
  //
  // cleanup 이 곧 무효화다. 버전이 바뀌면 다음 effect 가 새 키를 새기고, **언마운트면 null 로
  // 남는다** — 언마운트는 seq 를 올리지 않아 같은 레쥬메로 다시 들어온 새 인스턴스의 키와
  // 겹치기 때문이다. 아래 draft 보관 effect 보다 먼저 선언해 cleanup 도 먼저 돌게 둔다.
  useEffect(() => {
    const ref = requestKeyRef;
    ref.current = requestKey;
    return () => {
      ref.current = null;
    };
  }, [requestKey]);

  // Persist draft on any client-side navigation (unmount)
  useEffect(() => {
    return () => {
      if (dirtyRef.current && resumeRef.current) {
        // '나가기' 버튼이 이미 이 이탈을 처리했는지를 먼저 본다 — router.push 가 곧바로
        // 이 effect 의 cleanup 을 부르므로, 나중에 세우면 handleBack 이 방금 띄운 경고
        // 토스트를 여기서 또 띄우게 된다(FRT-261 회귀).
        const alreadyHandled = exitDraftFiredRef.current;
        const tier = writeDraft(versionId, resumeRef.current);
        // 상단 '나가기'만 출구가 아니다 — GNB 링크로 떠나도 페이지는 조용히 임시 저장한다.
        // 그 편집도 어디까지 갔는지는 같은 질문이라 같은 이벤트로 남긴다. 단 '나가기'는
        // 스스로 이동을 일으켜 여기로 이어지므로, 이미 쐈으면 두 번 세지 않는다.
        if (!alreadyHandled) {
          exitDraftFiredRef.current = true;
          captureEditSaved(
            "exit_draft",
            tier !== null,
            changedResumeSections(initialRef.current, resumeRef.current),
            tier,
          );
        }
        // 이 경로가 기댈 안전망은 이것 하나뿐이다. 결과를 지표에만 남기고 사용자에게 안
        // 알리면 저장 실패가 **아무에게도 안 알려진 채** 편집이 사라진다(FRT-261).
        // toast 는 모듈 전역 pub/sub 라 이 컴포넌트가 죽은 뒤에도 다음 화면에서 뜬다.
        // 다만 '나가기'가 이미 같은 경고를 띄웠으면 중복이니 여기서는 건너뛴다.
        if (alreadyHandled) return;
        const tierWarning = draftTierWarning(tier);
        if (tierWarning) toast.error(tierWarning);
      }
    };
  }, [versionId, captureEditSaved]);

  // Ctrl/Cmd+S — always consume the shortcut on this page
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!resume || !dirty) return;
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, resume, dirty]);

  // beforeunload when dirty — 경고만 띄운다. 저장은 아래 pagehide 가 맡는다(bfcache).
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
  // 떠남이라 같은 exit_draft 로 센다. 토스트는 띄우지 않는다 — 볼 사람이 없는 화면이고,
  // 실패는 persisted:false 로 지표에 남는다. "머무르기"를 고르면 pagehide 가 오지 않으므로
  // 경고 다이얼로그와 순서가 얽히지 않는다.
  //
  // 다른 버전으로 옮기는 창(loading)에서는 걸지 않는다 — versionId 는 이미 다음 버전인데
  // resume/dirty 는 아직 이전 버전 것이라(FRT-238), 여기서 담으면 이전 버전의 편집이 다음
  // 버전의 키로 들어간다. 이전 버전의 편집은 버전이 바뀌는 순간 위 언마운트 cleanup 이 이전
  // 키로 이미 남겼다(handleSave 가 loading 을 가드하는 것과 같은 이유).
  //
  // 치우는 것은 **내가 담은 그 스냅샷일 때만**이다. 같은 레쥬메를 연 다른 탭이 그 사이 같은
  // 키에 더 새 편집을 남겼으면, 그것은 이 탭이 치울 것이 아니다 — "담았다"는 기억은 저장소에
  // 있는 것이 아직 내 것이라는 증거가 못 된다.
  useEffect(() => {
    if (loading || dirty || hiddenSnapshotRef.current === null) return;
    const snapshot = hiddenSnapshotRef.current;
    hiddenSnapshotRef.current = null;
    if (isStoredDraft(versionId, snapshot)) clearDraft(versionId);
  }, [dirty, loading, versionId]);

  usePersistOnUnload({
    enabled: dirty && !loading,
    onPersist: (reason) => {
      if (!dirtyRef.current || !resumeRef.current) return;
      const snapshot = resumeRef.current;
      if (reason === "hidden") {
        if (snapshot === hiddenSnapshotRef.current) return;
        hiddenSnapshotRef.current = snapshot;
        writeDraft(versionId, snapshot);
        return;
      }
      const tier = writeDraft(versionId, snapshot);
      // 한 이탈은 한 번만 센다 — '나가기'가 이미 셌거나, 이 뒤에 언마운트가 이어져도.
      //
      // 저장이 도는 중이어도 여기서는 **쏜다**. 언마운트 cleanup 은 응답 핸들러가 살아 있어
      // 그쪽에 결말을 맡기지만(savingRef 가드), 진짜 언로드는 문서를 먼저 거둬 떠 있던 PATCH
      // 의 핸들러가 돌지 않는다 — 여기서 건너뛰면 그 시도는 어느 결말도 못 남긴다. 언로드를
      // 견디는(sendBeacon) 결말은 이 한 번뿐이다.
      if (exitDraftFiredRef.current) return;
      exitDraftFiredRef.current = true;
      captureEditSaved(
        "exit_draft",
        tier !== null,
        changedResumeSections(initialRef.current, snapshot),
        tier,
        true,
      );
    },
  });

  if (loading) return <ResumeDetailSkeleton />;

  if (resume && isFullyEmpty && !continueAnyway && !pendingDraft) {
    return (
      <>
        {/* 이 화면은 "경험이 없다"고 말하지만, 실제로는 경험이 **있었는데 못 읽은** 것일
            수 있고 그 사실은 이 배너에만 있다. 여기서 감추면 사용자는 화면 말을 믿고
            다시 만들어도 같은 결과를 받는다. */}
        {resume.파싱경고.length > 0 && (
          <div className="mx-auto w-full max-w-xl px-6 pt-6">
            <ParsingWarningsBanner warnings={resume.파싱경고} />
          </div>
        )}
        {/* 읽기 전용에서는 '빈 레쥬메 편집하기'가 할 수 없는 일을 약속한다(편집기가 없다). */}
        <EmptyResumeState
          onContinueAnyway={
            readOnly ? undefined : () => setContinueAnyway(true)
          }
        />
      </>
    );
  }

  if (error || !resume) {
    const status = error instanceof ApiError ? error.status : 500;
    const isNotFound = status === 404;
    // FRT-326 — 본문이 아직 없는 것(생성 중)과 못 불러온 것은 다른 상태다. 생성은 비동기라
    // 만들자마자 들어오면 이 경로가 정상이며, 실패로 그리면 사용자가 정상 진행을 실패로 읽는다.
    // 소거법으로 판정하면 네트워크 장애까지 "생성 중"이 되므로 전용 타입으로만 좁힌다
    // (자소서 상세와 같은 판정 — CoverLetterNotReadyError).
    const notReady = error instanceof ResumeNotReadyError;
    return (
      <div className="flex min-h-[calc(100dvh-var(--gnb-h))] flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-title text-text-primary">
          {isNotFound
            ? "레쥬메를 찾을 수 없어요"
            : notReady
              ? "아직 만들고 있어요"
              : "레쥬메를 불러오지 못했어요"}
        </h2>
        <p className="text-body-sm text-text-secondary">
          {isNotFound
            ? "삭제되었거나 주소가 잘못된 것 같아요."
            : notReady
              ? // 자소서는 "완료되면 목록에서 열 수 있어요"라고 말한다 — 그쪽 목록에는 폴링이
                // 있어 참인 말이다. 레쥬메 목록에는 폴링이 없으므로(FRT-325) 그대로 베끼면
                // 지킬 수 없는 약속이 된다. 이 화면에 실재하는 탈출구를 가리킨다.
                "다 만들어지면 '다시 시도'를 눌러 열 수 있어요."
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

  return (
    <div className="flex flex-col">
      <ResumeDetailTopBar
        versionLabel={versionLabel}
        dirty={dirty}
        saving={saving}
        regenerating={regenerating}
        onBack={handleBack}
        onSave={handleSave}
        onRegenerate={() => setRegenerateOpen(true)}
        onExport={() => setExportOpen(true)}
      />

      {/* Mobile tab switcher — 읽기 전용이면 고를 것이 없다(편집 패널이 없음). */}
      <div
        className={[
          "no-print sticky top-[calc(var(--gnb-h)+3.5rem)] z-30 border-b border-border bg-surface md:hidden",
          readOnly ? "hidden" : "flex",
        ].join(" ")}
      >
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
                ? "border-b-2 border-brand text-brand font-medium"
                : "border-b-2 border-transparent text-text-secondary",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100dvh-var(--gnb-h)-3.5rem)] md:h-[calc(100dvh-var(--gnb-h))] flex-col md:flex-row">
        {/* 읽기 전용이면 편집 패널을 **아예 그리지 않는다** — 빈 사이드바로 화면을 반 접지
            않고 미리보기가 전폭을 쓰게 둔다. CSS 로만 감추면 편집기와 파싱 경고 배너가
            DOM 에 그대로 남아, 아래 미리보기 쪽 배너와 같은 경고가 두 벌 마운트된다.
            ⚠️ 이건 화면 배치일 뿐 **저장을 막는 장치가 아니다** — 봉인은 dirty=false 다. */}
        {!readOnly && (
          <aside
            className={[
              "no-print flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto border-border bg-surface md:max-w-[40%] md:flex-none md:basis-2/5 md:border-r",
              mobileTab === "editor" ? "" : "hidden md:flex",
            ].join(" ")}
          >
            <div className="p-5 sm:p-6 space-y-3">
              {pendingDraft && (
                <DraftRestoreBanner
                  updatedAt={pendingDraft.updated_at}
                  onRestore={handleRestoreDraft}
                  onDiscard={handleDiscardDraft}
                />
              )}
              <ParsingWarningsBanner warnings={resume.파싱경고} />
              <ResumeEditorPanel resume={resume} onChange={handleEditorChange} />
            </div>
          </aside>
        )}

        <main
          className={[
            "flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto bg-surface-secondary",
            readOnly || mobileTab === "preview" ? "" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="p-5 sm:p-8">
            {readOnly && (
              <div className="mx-auto mb-4 max-w-[210mm] space-y-3">
                <EnglishReadOnlyNotice />
                {/* 파싱 경고 배너는 편집 사이드바 안에 있는데 읽기 전용은 그 사이드바를
                    통째로 감춘다 — 여기서 다시 그리지 않으면 "어떤 경험이 빠졌는지"를
                    영문 사용자만 영영 못 본다. 편집은 못 해도 보완할 곳은 알아야 한다. */}
                <ParsingWarningsBanner warnings={resume.파싱경고} />
              </div>
            )}
            <div className="mx-auto max-w-[210mm]">
              <RemainingExperiencesNotice count={resume.meta?.보류된_경험수} />
            </div>
            <ResumePreview resume={resume} />
          </div>
        </main>
      </div>

      <ExportFormatDialog
        open={exportOpen}
        busy={exporting}
        onClose={() => setExportOpen(false)}
        onSelect={handleExport}
      />

      <RegenerateConfirmDialog
        open={regenerateOpen}
        submitting={regenerating}
        onClose={() => setRegenerateOpen(false)}
        onConfirm={handleRegenerate}
      />
    </div>
  );
}
