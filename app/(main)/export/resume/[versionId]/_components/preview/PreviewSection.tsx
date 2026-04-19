"use client";

import { ReactNode } from "react";

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

export function PreviewBullets({ items }: { items: string[] }) {
  const filtered = items.filter((s) => s && s.trim());
  if (filtered.length === 0) return null;
  return (
    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-body-sm text-text-primary">
      {filtered.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function formatPeriod(
  start: string | null,
  end: string | null,
  raw?: string | null,
  ongoing?: boolean,
): string {
  if (raw && raw.trim()) return raw;
  const s = (start ?? "").trim();
  const e = ongoing ? "현재" : (end ?? "").trim();
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}
