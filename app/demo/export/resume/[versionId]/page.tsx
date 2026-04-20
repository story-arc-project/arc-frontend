"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/(main)/export/resume/[versionId]/print.css";
import { ResumeDetailTopBar } from "@/app/(main)/export/resume/[versionId]/_components/ResumeDetailTopBar";
import { ResumeEditorPanel } from "@/app/(main)/export/resume/[versionId]/_components/ResumeEditorPanel";
import { ResumePreview } from "@/app/(main)/export/resume/[versionId]/_components/ResumePreview";
import { reserveClientIds } from "@/app/(main)/export/resume/[versionId]/_components/editors/shared";
import type { ResumeVersion } from "@/types/resume";
import { demoResume, DEMO_RESUME_VERSION_ID } from "../../../_data/resume";

type MobileTab = "editor" | "preview";

// Prime client ids on module load so the editor is immediately interactive.
reserveClientIds(demoResume);

export default function DemoResumeDetailPage() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeVersion>(demoResume);
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  const handleBack = useCallback(() => {
    router.push("/demo/export");
  }, [router]);

  const versionLabel = `레쥬메 #${DEMO_RESUME_VERSION_ID.slice(0, 8)} 🇰🇷`;

  return (
    <div className="flex flex-col">
      <ResumeDetailTopBar
        versionLabel={versionLabel}
        dirty={false}
        saving={false}
        regenerating={false}
        onBack={handleBack}
        onSave={() => {}}
        onRegenerate={() => {}}
        onPrint={handlePrint}
      />

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
