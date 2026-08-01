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
  ResumeMutationUnsupportedError,
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
import { reserveClientIds } from "./_components/editors/shared";
import { changedResumeSections } from "./_components/resume-diff";
import {
  clearDraft,
  isDraftNewer,
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
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    // 새 버전 로드(재생성으로 이동해 온 경우 포함) 시 재생성 UI 상태를 초기화한다.
    // App Router가 versionId만 바뀔 때 동일 인스턴스를 재사용해도 '다시 만들기'
    // 버튼/다이얼로그가 잔존(영구 비활성)하지 않도록 여기서 리셋한다.
    setRegenerating(false);
    setRegenerateOpen(false);
    setLoading(true);
    setError(null);
    // 다른 버전을 열면 그 버전의 초안은 아직 손대지 않은 상태다.
    editedFiredRef.current = false;
    exitDraftFiredRef.current = false;
    try {
      const data = await getResume(versionId);
      setResume(data);
      setInitial(data);
      reserveClientIds(data);

      const draft = readDraft(versionId);
      if (draft && isDraftNewer(draft, data)) {
        reserveClientIds(draft.data);
        setPendingDraft(draft);
      } else {
        setPendingDraft(null);
        if (draft) clearDraft(versionId);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyRef = useRef(false);
  const resumeRef = useRef<ResumeVersion | null>(null);
  const initialRef = useRef<ResumeVersion | null>(null);

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

  // 저장의 결말들(서버 저장·백엔드 미수용·그 외 오류·저장 없이 이탈)이 사용자에겐 거의
  // 같아 보이지만 데이터로는 전혀 다른 사실이다. 한 곳에서 같은 모양으로 싣는다(FRT-114).
  const captureEditSaved = useCallback(
    (outcome: ResumeSaveOutcome, persisted: boolean, changed: string[]) => {
      capture("resume_edit_saved", {
        outcome,
        persisted,
        sections: changed,
        section_count: changed.length,
      });
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
    if (!resume || !dirty || saving) return;
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
      // Only clear the draft when no newer edits arrived during save.
      // Otherwise the unmount handler may have just persisted a fresher draft we must keep.
      if (resumeRef.current === snapshot) {
        clearDraft(versionId);
      }
      toast.success("저장됐어요");
      captureEditSaved("server", true, sections);
    } catch (err) {
      if (err instanceof ResumeMutationUnsupportedError) {
        // Persist the freshest state — never overwrite a newer draft with a stale snapshot.
        const latest = resumeRef.current ?? snapshot;
        const saved = writeDraft(versionId, latest);
        if (saved) {
          setInitial(snapshot);
          // 방금 쓴 임시 저장이 곧 지금 편집 중인 내용이다. 배너를 그대로 두면 '복원'이
          // 화면에 없는 낡은 스냅샷(pendingDraft)을 되돌리면서 clearDraft 로 방금 쓴
          // 최신 임시 저장까지 지운다 — 배너 하나가 편집을 두 번 잃게 만든다.
          setPendingDraft(null);
          toast("편집 저장 기능은 곧 제공될 예정이에요", "info");
        } else {
          toast.error("임시 저장도 실패했어요. 페이지를 닫지 마세요.");
        }
        // 사용자에게는 "저장했어요"로 보이지만 서버엔 아무것도 안 남은 갈래다(FRT-111 대기).
        // server 와 뭉치면 관리자가 보는 '저장 건수'가 통째로 거짓이 된다.
        // 섹션은 **실제로 보관된 값(latest)** 기준이다 — 요청이 도는 동안 이어서 고친
        // 섹션이 draft 에는 들어갔는데 지표에서만 빠지면 보관된 편집을 과소 보고한다.
        captureEditSaved(
          "unsupported",
          saved,
          changedResumeSections(initial, latest),
        );
      } else {
        // 서버 장애·오프라인도 편집을 잃을 이유는 아니다. 언마운트 핸들러에만 기대면
        // 탭을 그대로 닫았을 때(cleanup 미실행) 고친 내용이 통째로 사라진다.
        // dirty 는 그대로 두어 다음 저장/이탈 경로가 계속 살아 있게 한다.
        const latest = resumeRef.current ?? snapshot;
        const saved = writeDraft(versionId, latest);
        if (saved) {
          setPendingDraft(null);
        }
        toast.error("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
        captureEditSaved("failed", saved, changedResumeSections(initial, latest));
      }
    } finally {
      setSaving(false);
    }
  }, [resume, dirty, saving, versionId, initial, captureEditSaved]);

  const handleRegenerate = useCallback(async () => {
    if (!resume || regenerating) return;
    setRegenerating(true);
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
      const saved = writeDraft(versionId, resume);
      // 저장 버튼을 누른 적은 없지만 사용자에게는 "임시 저장했어요"라고 **말한다**.
      // 여기서 안 쏘면 안전하게 보관된 편집이 유실된 편집과 데이터상 구별되지 않고,
      // 실패(=편집 유실 직전)한 순간은 아예 어디에도 남지 않는다(FRT-114).
      captureEditSaved(
        "exit_draft",
        saved,
        changedResumeSections(initial, resume),
      );
      if (!saved) {
        toast.error("임시 저장에 실패했어요. 저장 후 나가주세요.");
        // 실패한 '나가기'는 이탈이 아니다 — 사용자는 화면에 그대로 남는다. 여기서
        // 중복 방지 플래그를 세우면 뒤이어 **진짜로** 떠날 때 보관된 편집이 안 남는다.
        return;
      }
      // 이동이 확정된 뒤에만 세운다 — 곧 이어질 언마운트가 같은 이탈을 또 세지 않도록.
      exitDraftFiredRef.current = true;
      toast("변경사항을 임시 저장했어요", "info");
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

  // Persist draft on any client-side navigation (unmount)
  useEffect(() => {
    return () => {
      if (dirtyRef.current && resumeRef.current) {
        const saved = writeDraft(versionId, resumeRef.current);
        // 상단 '나가기'만 출구가 아니다 — GNB 링크로 떠나도 페이지는 조용히 임시 저장한다.
        // 그 편집도 어디까지 갔는지는 같은 질문이라 같은 이벤트로 남긴다. 단 '나가기'는
        // 스스로 이동을 일으켜 여기로 이어지므로, 이미 쐈으면 두 번 세지 않는다.
        if (!exitDraftFiredRef.current) {
          exitDraftFiredRef.current = true;
          captureEditSaved(
            "exit_draft",
            saved,
            changedResumeSections(initialRef.current, resumeRef.current),
          );
        }
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

  // beforeunload when dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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
    return (
      <div className="flex min-h-[calc(100dvh-var(--gnb-h))] flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-title text-text-primary">
          {isNotFound
            ? "레쥬메를 찾을 수 없어요"
            : "레쥬메를 불러오지 못했어요"}
        </h2>
        <p className="text-body-sm text-text-secondary">
          {isNotFound
            ? "삭제되었거나 주소가 잘못된 것 같아요."
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
