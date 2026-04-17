"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { getResume } from "@/lib/api/export-api";
import type { ResumeVersion } from "@/types/resume";
import { ResumeDetailSkeleton } from "./_components/ResumeDetailSkeleton";
import { ResumeDetailTopBar } from "./_components/ResumeDetailTopBar";
import { ResumeEditorPanel } from "./_components/ResumeEditorPanel";
import { ResumePreview } from "./_components/ResumePreview";

type MobileTab = "editor" | "preview";

interface PageProps {
  params: Promise<{ versionId: string }>;
}

export default function ResumeDetailPage({ params }: PageProps) {
  const { versionId } = use(params);
  const [resume, setResume] = useState<ResumeVersion | null>(null);
  const [initial, setInitial] = useState<ResumeVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResume(versionId);
      setResume(data);
      setInitial(data);
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

  const versionLabel = useMemo(() => {
    if (!resume) return "레쥬메";
    const shortId = versionId.slice(0, 8);
    const lang = resume.meta.language === "en" ? "🇺🇸" : "🇰🇷";
    return `레쥬메 #${shortId} ${lang}`;
  }, [resume, versionId]);

  const handleSave = useCallback(() => {
    // Wired in Block 9
  }, []);
  const handleRegenerate = useCallback(() => {
    // Wired in Block 9
  }, []);
  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  if (loading) return <ResumeDetailSkeleton />;

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
        saving={false}
        regenerating={false}
        onSave={handleSave}
        onRegenerate={handleRegenerate}
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

      <div className="flex h-[calc(100dvh-var(--gnb-h)-3.5rem)] flex-col md:flex-row">
        <aside
          className={[
            "no-print flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto border-border bg-surface md:max-w-[40%] md:flex-none md:basis-2/5 md:border-r",
            mobileTab === "editor" ? "" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="p-5 sm:p-6">
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
    </div>
  );
}
