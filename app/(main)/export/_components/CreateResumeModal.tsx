"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { createResume } from "@/lib/api/export-api";
import type { ResumeLanguage } from "@/types/resume";
import { ResumeGenerationOverlay } from "./ResumeGenerationOverlay";

interface CreateResumeModalProps {
  open: boolean;
  onClose: () => void;
}

const GENERATION_TIMEOUT_MS = 60_000;

export function CreateResumeModal({ open, onClose }: CreateResumeModalProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<ResumeLanguage>("ko");
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setLanguage("ko");
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, GENERATION_TIMEOUT_MS);

    try {
      const created = await createResume(
        { language },
        { signal: controller.signal },
      );
      const versionId = created.version_id;
      if (!versionId) {
        throw new Error("version_id missing in response");
      }
      router.push(`/export/resume/${versionId}`);
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("생성이 오래 걸려요. 잠시 후 다시 시도해주세요.");
      } else {
        toast.error("레쥬메 생성에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
      setSubmitting(false);
    } finally {
      window.clearTimeout(timeoutId);
      abortRef.current = null;
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <>
      <Dialog
        open={open && !submitting}
        onClose={handleClose}
        ariaLabel="새 레쥬메 만들기"
        className="max-w-md"
      >
        <div>
          <h2 className="text-title text-text-primary">새 레쥬메 만들기</h2>
          <p className="text-body-sm text-text-secondary mt-1">
            지금까지 기록한 모든 경험을 바탕으로 AI가 레쥬메 초안을 만들어요.
          </p>

          <fieldset className="mt-5">
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
            <Button variant="ghost" size="sm" onClick={handleClose}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              만들기
            </Button>
          </div>
        </div>
      </Dialog>

      <ResumeGenerationOverlay open={submitting} />
    </>
  );
}
