"use client";

import { useState } from "react";
import { Button, Checkbox } from "@/components/ui";
import {
  activeConsentItems,
  initialConsentState,
  toggleConsent,
  setAllConsents,
  isAllActiveGranted,
  allRequiredGranted,
  buildConsentPayload,
  type ConsentId,
  type ConsentPayload,
} from "@/lib/auth/consent";

interface ConsentStepProps {
  onSubmit: (payload: ConsentPayload) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ConsentStep({ onSubmit, isLoading = false, error }: ConsentStepProps) {
  const [state, setState] = useState(initialConsentState());
  const [expanded, setExpanded] = useState<ConsentId | null>(null);

  const items = activeConsentItems();
  const allChecked = isAllActiveGranted(state);
  const canProceed = allRequiredGranted(state);

  return (
    <div>
      <h1 className="text-heading-2 text-text-primary mb-1">약관에 동의해주세요</h1>
      <p className="text-body text-text-secondary mb-6">필수 항목에 동의하면 가입이 완료돼요</p>

      {/* 전체 동의 */}
      <label className="flex items-center gap-3 p-4 mb-3 rounded-xl border-2 border-border cursor-pointer">
        <Checkbox
          checked={allChecked}
          onChange={() => setState((s) => setAllConsents(s, !isAllActiveGranted(s)))}
          aria-label="전체 동의"
        />
        <span className="text-label text-text-primary font-semibold">전체 동의</span>
      </label>

      {/* 항목별 */}
      <div className="flex flex-col gap-1 mb-6">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg">
            <div className="flex items-center gap-3 px-2 py-2.5">
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <Checkbox
                  checked={Boolean(state[item.id])}
                  onChange={() => setState((s) => toggleConsent(s, item.id))}
                  aria-label={item.label}
                />
                <span className="text-body-sm text-text-secondary">
                  <span className={item.required ? "text-brand" : "text-text-tertiary"}>
                    [{item.required ? "필수" : "선택"}]
                  </span>{" "}
                  {item.label}
                </span>
              </label>
              {(item.summary || item.detailHref) && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === item.id ? null : item.id))}
                  className="text-caption text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer shrink-0"
                >
                  {expanded === item.id ? "닫기" : "보기"}
                </button>
              )}
            </div>
            {expanded === item.id && (item.summary || item.detailHref) && (
              <div className="px-2 pb-3 text-caption text-text-tertiary flex flex-col gap-1">
                {item.summary && <p>{item.summary}</p>}
                {item.detailHref && (
                  <a
                    href={item.detailHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline w-fit"
                  >
                    전문 보기
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mb-3 text-body-sm text-error">{error}</p>}

      <Button
        onClick={() => onSubmit(buildConsentPayload(state))}
        disabled={!canProceed || isLoading}
        fullWidth
      >
        {isLoading ? "처리 중..." : "다음"}
      </Button>
    </div>
  );
}
