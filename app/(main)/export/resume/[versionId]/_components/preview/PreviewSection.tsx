"use client";

import { ReactNode } from "react";

// 표기 규칙은 파일 내보내기(PDF·DOCX)와 공유한다 — 단일 출처는 lib/export/resume-format.
import { compactStrings } from "@/lib/export/resume-format";

export { formatPeriod } from "@/lib/export/resume-format";

interface PreviewSectionProps {
  title: string;
  children: ReactNode;
}

export function PreviewSection({ title, children }: PreviewSectionProps) {
  return (
    <section className="resume-section mt-7 first:mt-0">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-text-primary border-b border-border pb-1.5 mb-3">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function PreviewRow({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0 flex-1">{left}</div>
      {right && (
        <div className="shrink-0 text-right text-caption text-text-secondary">
          {right}
        </div>
      )}
    </div>
  );
}

/**
 * 불릿 묶음. 배열 부재를 스스로 견딘다(FRT-157) — 백엔드가 성과·담당업무 같은 필수 배열을
 * 빠뜨려도 화면이 백지가 되면 안 된다. 걸러내는 규칙은 파일 내보내기의 `bulletGroup` 과
 * 같은 `compactStrings` 를 쓴다 — 화면과 파일이 다른 판정을 하면 그 자체가 버그다.
 */
export function PreviewBullets({
  items,
}: {
  items: readonly string[] | null | undefined;
}) {
  const filtered = compactStrings(items);
  if (filtered.length === 0) return null;
  return (
    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-body-sm text-text-primary">
      {filtered.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

