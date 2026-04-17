"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { createResume } from "@/lib/api/export-api";
import type { ResumeLanguage } from "@/types/resume";

interface CreateResumeModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateResumeModal({ open, onClose }: CreateResumeModalProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<ResumeLanguage>("ko");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const created = await createResume({ language });
      const versionId = created.version_id;
      if (!versionId) {
        throw new Error("version_id missing in response");
      }
      router.push(`/export/resume/${versionId}`);
    } catch {
      toast.error("레쥬메 생성에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      ariaLabel="새 레쥬메 만들기"
      className="max-w-md"
    >
      <div>
        <h2 className="text-title text-text-primary">새 레쥬메 만들기</h2>
        <p className="text-body-sm text-text-secondary mt-1">
          지금까지 기록한 모든 경험을 바탕으로 AI가 레쥬메 초안을 만들어요.
        </p>

        <fieldset className="mt-5" disabled={submitting}>
          <legend className="text-body-sm text-text-primary font-medium mb-2">
            언어
          </legend>
          <div className="flex flex-col gap-2">
            {(
              [
                { value: "ko", label: "한국어" },
                { value: "en", label: "English" },
              ] as const
            ).map((opt) => {
              const selected = language === opt.value;
              return (
                <label
                  key={opt.value}
                  className={[
                    "flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
                    selected
                      ? "border-brand bg-surface-brand"
                      : "border-border hover:border-border-strong",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="resume-language"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setLanguage(opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={[
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                      selected ? "border-brand" : "border-border",
                    ].join(" ")}
                  >
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-brand" />
                    )}
                  </span>
                  <span className="text-body-sm text-text-primary">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "생성 중..." : "만들기"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
