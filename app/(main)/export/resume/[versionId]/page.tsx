"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

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
import { isEmptySection, type ResumeVersion } from "@/types/resume";
import { DraftRestoreBanner } from "./_components/DraftRestoreBanner";
import { EmptyResumeState } from "./_components/EmptyResumeState";
import { ParsingWarningsBanner } from "./_components/ParsingWarningsBanner";
import { RegenerateConfirmDialog } from "./_components/RegenerateConfirmDialog";
import { ResumeDetailSkeleton } from "./_components/ResumeDetailSkeleton";
import { ResumeDetailTopBar } from "./_components/ResumeDetailTopBar";
import { ResumeEditorPanel } from "./_components/ResumeEditorPanel";
import { ResumePreview } from "./_components/ResumePreview";
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResume(versionId);
      setResume(data);
      setInitial(data);

      const draft = readDraft(versionId);
      if (draft && isDraftNewer(draft, data)) {
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

  const dirty = useMemo(() => {
    if (!resume || !initial) return false;
    return JSON.stringify(resume) !== JSON.stringify(initial);
  }, [resume, initial]);

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
    try {
      const updated = await updateResume(versionId, resume);
      setResume(updated);
      setInitial(updated);
      clearDraft(versionId);
      toast.success("저장됐어요");
    } catch (err) {
      if (err instanceof ResumeMutationUnsupportedError) {
        const saved = writeDraft(versionId, resume);
        if (saved) {
          setInitial(resume);
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
      const created = await createResume({ language: resume.meta.language });
      const newId = created.version_id;
      if (!newId) throw new Error("version_id missing");
      router.push(`/export/resume/${newId}`);
    } catch {
      toast.error("다시 만들기에 실패했어요. 잠시 후 다시 시도해주세요.");
      setRegenerating(false);
    }
  }, [resume, regenerating, router]);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

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

  // Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (!resume || !dirty) return;
        e.preventDefault();
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
          <Link href="/export">
            <Button variant="ghost" size="sm">
              익스포트로 돌아가기
            </Button>
          </Link>
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
        onSave={handleSave}
        onRegenerate={() => setRegenerateOpen(true)}
        onPrint={handlePrint}
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

      <RegenerateConfirmDialog
        open={regenerateOpen}
        submitting={regenerating}
        onClose={() => setRegenerateOpen(false)}
        onConfirm={handleRegenerate}
      />
    </div>
  );
}
