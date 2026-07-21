"use client";

import { useEffect, useState } from "react";
import {
  formatPeriodString,
  inferGranularity,
  padToDay,
  parsePeriodString,
  truncateToMonth,
  type PeriodGranularity,
} from "@/lib/utils/period-format";
import { DatePicker } from "./date-picker";

interface PeriodPickerProps {
  label?: string;
  /** 라벨 아래 안내문. 다른 입력 블록의 guide 와 같은 위계로 렌더된다. */
  hint?: string;
  /** Stored format: "2023.03 ~ 2024.01" (월) · "2023.03.15 ~ 현재" (일) */
  value: string;
  onChange: (v: string) => void;
}

const GRANULARITIES: { key: PeriodGranularity; label: string }[] = [
  { key: "month", label: "월 단위" },
  { key: "day", label: "일 단위" },
];

export function PeriodPicker({ label, hint, value, onChange }: PeriodPickerProps) {
  const [start, setStart] = useState(() => parsePeriodString(value).start);
  const [end, setEnd] = useState(() => parsePeriodString(value).end);
  const [isCurrent, setIsCurrent] = useState(() => parsePeriodString(value).isCurrent);
  const [granularity, setGranularity] = useState<PeriodGranularity>(() => inferGranularity(value));

  useEffect(() => {
    onChange(formatPeriodString({ start, end, isCurrent }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, isCurrent]);

  const handleGranularity = (next: PeriodGranularity) => {
    if (next === granularity) return;
    // 일 → 월: 일 정밀도 절삭. 월 → 일: 1일로 채워 type=date 입력이 빈 컨트롤로
    // 보이거나 혼합 granularity로 직렬화되는 것을 막는다(사용자가 일을 조정).
    const convert = next === "month" ? truncateToMonth : padToDay;
    setStart(convert);
    setEnd(convert);
    setGranularity(next);
  };

  const mode = granularity === "day" ? "date" : "month";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <label className="text-field-label text-text-primary">{label}</label>
        ) : (
          <span />
        )}
        <div
          role="radiogroup"
          aria-label="기간 단위"
          className="flex items-center gap-1 flex-shrink-0"
        >
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              role="radio"
              aria-checked={granularity === g.key}
              onClick={() => handleGranularity(g.key)}
              className={[
                "px-2 py-0.5 rounded text-caption transition-colors",
                granularity === g.key
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-border",
              ].join(" ")}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      {hint ? <p className="text-caption text-text-tertiary">{hint}</p> : null}
      <div className="flex items-center gap-2">
        <DatePicker
          mode={mode}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          wrapperClassName="flex-1"
        />
        <span className="text-text-tertiary text-body flex-shrink-0">~</span>
        <DatePicker
          mode={mode}
          value={isCurrent ? "" : end}
          onChange={(e) => setEnd(e.target.value)}
          disabled={isCurrent}
          wrapperClassName="flex-1"
        />
        <label className="flex items-center gap-1.5 text-label text-text-secondary cursor-pointer flex-shrink-0 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="w-4 h-4 rounded accent-brand"
          />
          현재
        </label>
      </div>
    </div>
  );
}
