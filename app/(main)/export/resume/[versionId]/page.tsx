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
import { capture } from "@/lib/analytics";
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
import { reserveClientIds } from "./_components/editors/shared";
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

  const load = useCallback(async () => {
    // 새 버전 로드(재생성으로 이동해 온 경우 포함) 시 재생성 UI 상태를 초기화한다.
    // App Router가 versionId만 바뀔 때 동일 인스턴스를 재사용해도 '다시 만들기'
    // 버튼/다이얼로그가 잔존(영구 비활성)하지 않도록 여기서 리셋한다.
    setRegenerating(false);
    setRegenerateOpen(false);
    setLoading(true);
    setError(null);
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

  const dirty = useMemo(() => {
    if (!resume || !initial) return false;
    return JSON.stringify(resume) !== JSON.stringify(initial);
  }, [resume, initial]);

  // Sync refs during render so the unmount handler sees the latest values
  // even when client navigation fires before passive effects flush.
  dirtyRef.current = dirty;
  resumeRef.current = resume;

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
      isEmptySection(resume.기술및역량)
    );
  }, [resume]);

  const versionLabel = useMemo(() => {
    if (!resume) return "레쥬메";
    const shortId = versionId.slice(0, 8);
    const lang = resume.meta.language === "en" ? "🇺🇸" : "🇰🇷";
    return `레쥬메 #${shortId} ${lang}`;
  }, [resume, versionId]);

  const handleSave = useCallback(async () => {
    if (!resume || !dirty || saving) return;
    setSaving(true);
    const snapshot = resume;
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
    } catch (err) {
      if (err instanceof ResumeMutationUnsupportedError) {
        // Persist the freshest state — never overwrite a newer draft with a stale snapshot.
        const latest = resumeRef.current ?? snapshot;
        const saved = writeDraft(versionId, latest);
        if (saved) {
          setInitial(snapshot);
          toast("편집 저장 기능은 곧 제공될 예정이에요", "info");
        } else {
          toast.error("임시 저장도 실패했어요. 페이지를 닫지 마세요.");
        }
      } else {
        toast.error("저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSaving(false);
    }
  }, [resume, dirty, saving, versionId]);

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
        setExportOpen(false);
        handlePrint();
        return;
      }

      setExporting(format);
      try {
        const { buildResumeDocument } = await import(
          "@/lib/export/resume-document"
        );
        const { downloadBlob, resumeFileName } = await import(
          "@/lib/export/download"
        );
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
      if (!saved) {
        toast.error("임시 저장에 실패했어요. 저장 후 나가주세요.");
        return;
      }
      toast("변경사항을 임시 저장했어요", "info");
    }
    router.push(`${basePath}/export`);
  }, [dirty, resume, versionId, router, basePath]);

  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
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
        writeDraft(versionId, resumeRef.current);
      }
    };
  }, [versionId]);

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
    return <EmptyResumeState onContinueAnyway={() => setContinueAnyway(true)} />;
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

      {/* Mobile tab switcher */}
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
                ? "border-b-2 border-brand text-brand font-medium"
                : "border-b-2 border-transparent text-text-secondary",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100dvh-var(--gnb-h)-3.5rem)] md:h-[calc(100dvh-var(--gnb-h))] flex-col md:flex-row">
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
            <ResumeEditorPanel resume={resume} onChange={setResume} />
          </div>
        </aside>

        <main
          className={[
            "flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto bg-surface-secondary",
            mobileTab === "preview" ? "" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="p-5 sm:p-8">
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
