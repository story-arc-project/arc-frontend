"use client";

import { useState, useEffect } from "react";
import { DatePicker } from "./date-picker";

interface PeriodPickerProps {
  label?: string;
  /** Stored format: "2023.03 ~ 2024.01" or "2023.03 ~ 현재" */
  value: string;
  onChange: (v: string) => void;
}

export function PeriodPicker({ label, value, onChange }: PeriodPickerProps) {
  const toDash = (v: string) => v.replace(".", "-");
  const toDot = (v: string) => v.replace("-", ".");

  const [start, setStart] = useState(() => toDash(value.split("~")[0]?.trim() ?? ""));
  const [end, setEnd] = useState(() => {
    const e = value.split("~")[1]?.trim() ?? "";
    return e === "현재" ? "" : toDash(e);
  });
  const [isCurrent, setIsCurrent] = useState(() => value.includes("현재"));

  useEffect(() => {
    const startDot = toDot(start);
    const endDot = isCurrent ? "현재" : toDot(end);
    onChange(startDot && (isCurrent || end) ? `${startDot} ~ ${endDot}` : startDot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, isCurrent]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-label text-text-primary">{label}</label>}
      <div className="flex items-center gap-2">
        <DatePicker
          mode="month"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          wrapperClassName="flex-1"
        />
        <span className="text-text-tertiary text-body flex-shrink-0">~</span>
        <DatePicker
          mode="month"
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
