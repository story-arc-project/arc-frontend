"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Dialog } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { ResumeExperiencePicker } from "@/components/features/export/ResumeExperiencePicker";
import { createResume } from "@/lib/api/export-api";
import { capture } from "@/lib/analytics";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";
import { useBasePath } from "@/lib/utils/use-base-path";
import { useExperiences } from "@/hooks/useExperiences";
import type { ResumeLanguage } from "@/types/resume";
import { ResumeGenerationOverlay } from "./ResumeGenerationOverlay";

interface CreateResumeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /**
   * 경험 선택 UI 노출 여부. 플래그(lib/export/flags.ts)는 **호출부**가 읽어 내려준다 —
   * 여기서 직접 읽으면 NEXT_PUBLIC_* 빌드타임 인라인 탓에 Storybook·테스트에서 항상 false 다.
   */
  experienceSelectionEnabled?: boolean;
}

const GENERATION_TIMEOUT_MS = 60_000;

export function CreateResumeModal({
  open,
  onClose,
  onCreated,
  experienceSelectionEnabled = false,
}: CreateResumeModalProps) {
  const [language, setLanguage] = useState<ResumeLanguage>("ko");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const basePath = useBasePath();

  const {
    experiences: apiExperiences,
    isLoading: isExperiencesLoading,
    error: experiencesError,
  } = useExperiences();

  // 최근에 손댄 기록부터 보여준다 — 방금 적은 경험을 찾으러 스크롤하지 않게.
  const experiences = useMemo(
    () =>
      apiExperiences
        .map(toExperienceV2)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [apiExperiences],
  );

  // 기본은 전체 선택 — 아무것도 건드리지 않으면 결과가 현행과 같아 회귀가 없고, 사용자는
  // "빼기"만 하면 된다. 그래서 상태를 "고른 id" 가 아니라 **제외한 id** 로 들고 초기값이 ∅ 이다
  // (목록 로드 후 전체를 선택 상태로 세팅하는 effect 가 필요 없어진다).
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(new Set());

  const selectedIds = useMemo(
    () => experiences.filter((e) => !excludedIds.has(e.id)).map((e) => e.id),
    [experiences, excludedIds],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setLanguage("ko");
      setSubmitting(false);
      setError(null);
      setExcludedIds(new Set());
    }
  }, [open]);

  // 무엇이 레쥬메에 들어갈지 확정할 수 없으면 생성을 막는다. 0개로 보내면 백엔드 생성기가
  // 입력 0건이라 error envelope 를 반환해 status=failed 레쥬메만 남는다.
  const blockedReason = !experienceSelectionEnabled
    ? null
    : isExperiencesLoading
      ? "경험을 불러오는 중이에요."
      : experiencesError
        ? "경험을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
        : experiences.length === 0
          ? "아직 기록한 경험이 없어요."
          : selectedIds.length === 0
            ? "레쥬메에 넣을 경험을 하나 이상 선택해 주세요."
            : null;

  const handleSubmit = async () => {
    if (blockedReason !== null) return;
    setError(null);
    setSubmitting(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, GENERATION_TIMEOUT_MS);

    try {
      await createResume(
        // 선택 기능이 꺼져 있으면 experience_ids 키 자체를 보내지 않는다 —
        // 계약상 부재 = 전체 경험이라 현행 동작이 그대로 유지된다.
        experienceSelectionEnabled
          ? { language, experienceIds: selectedIds }
          : { language },
        { signal: controller.signal },
      );
      // 익스포트 완료(FRT-19). experience_count 는 선택 기능이 켜졌을 때만 의미가 있다.
      capture("export_completed", {
        export_type: "resume",
        language,
        ...(experienceSelectionEnabled
          ? { experience_count: selectedIds.length }
          : {}),
      });
      // 생성은 비동기다 — 서버가 id 를 즉시 주더라도 본문(result)은 나중에 채워진다.
      // 생성 직후 상세로 이동하면 아직 준비 안 된 레쥬메를 로드해 "불러오지 못했어요"가 뜬다.
      // 상세로 튕기지 말고 목록에 남아 status 배지로 완료를 확인하게 한다("다시 만들기"와 대칭).
      toast("레쥬메를 만들고 있어요. 완료되면 목록에 표시돼요", "info");
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("생성이 오래 걸렸어요. 다시 시도해 주세요.");
      } else {
        setError("레쥬메 생성에 실패했어요. 다시 시도해 주세요.");
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
        className={experienceSelectionEnabled ? "max-w-lg" : "max-w-md"}
      >
        <div>
          <h2 className="text-title text-text-primary">새 레쥬메 만들기</h2>
          <p className="text-body-sm text-text-secondary mt-1">
            {experienceSelectionEnabled
              ? "선택한 경험을 바탕으로 AI가 레쥬메 초안을 만들어요."
              : "지금까지 기록한 모든 경험을 바탕으로 AI가 레쥬메 초안을 만들어요."}
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

          {experienceSelectionEnabled && (
            <div className="mt-5">
              {isExperiencesLoading ? (
                <p className="text-body-sm text-text-secondary">
                  경험을 불러오는 중이에요…
                </p>
              ) : experiencesError ? (
                <p className="text-body-sm text-error">
                  경험을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
                </p>
              ) : experiences.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
                  <p className="text-body-sm text-text-secondary">
                    아직 기록한 경험이 없어요.
                  </p>
                  <Link
                    href={`${basePath}/archive/new`}
                    className="text-body-sm text-brand font-medium underline-offset-2 hover:underline"
                  >
                    첫 경험 기록하러 가기
                  </Link>
                </div>
              ) : (
                <ResumeExperiencePicker
                  experiences={experiences}
                  excludedIds={excludedIds}
                  onToggle={(id) =>
                    setExcludedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onSelectAll={() => setExcludedIds(new Set())}
                  onClearAll={() =>
                    setExcludedIds(new Set(experiences.map((e) => e.id)))
                  }
                />
              )}
            </div>
          )}

          {/* 로딩·실패·경험 0개는 위 목록 자리가 이미 사유를 말하고 있다. 여기서는 목록이
              멀쩡히 보이는데도 만들기가 눌리지 않는 유일한 경우 — 0개 선택 — 만 설명한다. */}
          {experienceSelectionEnabled &&
            experiences.length > 0 &&
            selectedIds.length === 0 && (
              <p className="mt-3 text-caption text-text-tertiary">
                {blockedReason}
              </p>
            )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3 flex items-center justify-between gap-3"
            >
              <p className="text-body-sm text-error">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  handleSubmit();
                }}
                className="text-body-sm font-medium text-error underline-offset-2 hover:underline shrink-0"
              >
                다시 시도
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              취소
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={blockedReason !== null}
            >
              만들기
            </Button>
          </div>
        </div>
      </Dialog>

      <ResumeGenerationOverlay open={submitting} />
    </>
  );
}
